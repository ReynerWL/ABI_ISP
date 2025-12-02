import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment } from './entities/payment.entity';
import {
  Between,
  DataSource,
  LessThan,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { User, UserStatus } from '#/user/entities/user.entity';
import { Bank } from '#/bank/entities/bank.entity';
import { Paket } from '#/paket/entities/paket.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscription } from '#/subscription/entities/subscription.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as ExcelJS from 'exceljs';
import { WhatsAppService } from '#/WA/bot/wa.service';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly UserRepository: Repository<User>,
    @InjectRepository(Bank)
    private readonly BankRepository: Repository<Bank>,
    @InjectRepository(Paket)
    private readonly PaketRepository: Repository<Paket>,
    @InjectRepository(Subscription)
    private readonly SubsRepository: Repository<Subscription>,
    private WaSvc: WhatsAppService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto) {
    const user = await this.UserRepository.findOne({
      where: { id: createPaymentDto.usersId },
    });
    if (!user) {
      throw new Error('User not found');
    }

    const paket = await this.PaketRepository.findOne({
      where: { id: createPaymentDto.paketId },
    });
    if (!paket) {
      throw new Error('Paket not found');
    }

    const bank = await this.BankRepository.findOne({
      where: { id: createPaymentDto.banksId },
    });
    if (!bank) {
      throw new Error('Bank not found');
    }

    // ✅ Check for existing PENDING payment with same paketId and no buktiPembayaran
    const existingPendingPayment = await this.paymentRepository.findOne({
      where: {
        user: user,
        paket: paket,
        status: 'PENDING',
        buktiPembayaran: null, // or '' if you store empty string
      },
    });

    // ✅ If found, reject it
    if (existingPendingPayment) {
      await this.paymentRepository.update(existingPendingPayment.id, {
        status: 'REJECTED',
        reason: 'New payment created — old pending payment rejected',
      });
    }

    const dueDate = new Date(new Date().setDate(new Date().getDate() + 30));

    const newPayment = new Payment();
    newPayment.bank = bank;
    newPayment.user = user;
    ((newPayment.paket = paket), (newPayment.price = createPaymentDto.price));
    newPayment.buktiPembayaran = createPaymentDto.buktiPembayaran;
    newPayment.start_date = createPaymentDto.start_date || new Date();
    newPayment.due_date = createPaymentDto.due_date || dueDate;
    newPayment.status = createPaymentDto.status || 'PENDING';
    newPayment.paidAt = new Date();

    // ✅ Create new payment
    const payment = this.paymentRepository.create(newPayment);

    return await this.paymentRepository.findOne({
      where: { id: payment.id },
      relations: { paket: true, bank: true, user: true },
    });
  }

  async rejectPayment(paymentId: string, reason: string) {
    // Logic to reject a payment
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: { user: true, paket: true, bank: true },
    });

    //throw error 404
    if (!payment) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Payment not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.paymentRepository.update(paymentId, {
      status: 'REJECTED',
      reason: reason,
    });

    //Create a new payment with the same details but status PENDING
    const newPayment = this.paymentRepository.create({
      user: { id: payment.user.id },
      paket: { id: payment.paket.id },
      bank: { id: payment.bank.id },
      price: payment.price,
      status: 'PENDING',
    });

    await this.paymentRepository.save(newPayment);

    this.WaSvc.sendPaymentRejected(
      payment.user?.phone_number,
      reason,
      payment.user?.id,
    ).catch((err) => {
      console.error('Failed to send WA message:', err);
    });

    return await this.paymentRepository.findOne({
      where: { id: payment.id },
      relations: { user: true },
    });
  }

  async confirmPayment(paymentId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: { user: true, paket: true, bank: true },
    });

    if (!payment) {
      throw new HttpException(
        { statusCode: HttpStatus.NOT_FOUND, error: 'Payment not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    const paket = await this.PaketRepository.findOne({
      where: { id: payment.paket.id },
    });

    const bank = await this.BankRepository.findOne({
      where: { id: payment.bank.id },
    });

    if (!paket || !bank) {
      throw new HttpException(
        { statusCode: HttpStatus.NOT_FOUND, error: 'Paket or Bank not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    // GET USER + SUBSCRIPTION
    const user = await this.UserRepository.findOne({
      where: { id: payment.user?.id },
      relations: { subscription: true },
    });

    // GET LATEST SUBSCRIPTION (BENAR)
    const latestSubscription = await this.SubsRepository.findOne({
      where: { user: { id: user.id } },
      order: { due_date: 'DESC' },
    });

    let startDate: Date;
    let dueDate: Date;

    // IF USER NO SUBSCRIPTION → START NOW
    if (!latestSubscription || latestSubscription.due_date < new Date()) {
      startDate = new Date();
    } else {
      // EXTEND FROM LAST END DATE
      startDate = new Date(latestSubscription.due_date);
    }

    dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + 30);

    const startDateStr = startDate.toISOString();
    const dueDateStr = dueDate.toISOString();

    let subscriptionId: string;

    // ⛔ FIX: LATEST SUBSCRIPTION NULL → CREATE NEW ONE
    if (!latestSubscription) {
      const newSub = this.SubsRepository.create({
        start_date: startDateStr,
        due_date: dueDateStr,
        paket: { id: paket.id },
        banks: { id: bank.id },
        user: { id: user.id },
      });

      const created = await this.SubsRepository.save(newSub);
      subscriptionId = created.id;

      // Update user → SET subscription
      await this.UserRepository.update(user.id, {
        subscription: { id: subscriptionId },
        paket: { id: paket.id },
        status: UserStatus.AKTIF,
      });
    } else {
      // IF SUBS EXISTS → UPDATE
      await this.SubsRepository.update(latestSubscription.id, {
        start_date: startDateStr,
        due_date: dueDateStr,
        paket: { id: paket.id },
        banks: { id: bank.id },
      });

      subscriptionId = latestSubscription.id;
    }

    // UPDATE PAYMENT
    await this.paymentRepository.update(paymentId, {
      status: 'CONFIRMED',
      start_date: startDateStr,
      due_date: dueDateStr,
      paket: { id: paket.id },
      bank: { id: bank.id },
      paidAt: new Date(),
      confirmedAt: new Date(),
    });

    // UPDATE USER STATUS → AKTIF
    await this.UserRepository.update(user.id, {
      status: UserStatus.AKTIF,
    });

    // SEND WA
    setImmediate(() => {
      this.WaSvc.sendPaymentConfirmed(
        user.phone_number,
        payment.id,
        user.id,
      ).catch((err) => console.error('Failed to send WA:', err));
    });

    return await this.paymentRepository.findOne({
      where: { id: payment.id },
      relations: {
        user: { subscription: { paket: true } },
        paket: true,
        bank: true,
      },
    });
  }

  // src/payment/payment.service.ts
  async findAll(
    query?: string,
    startDate?: string,
    endDate?: string,
    month?: string,
    bank_id?: string,
    status?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.user', 'user')
      .leftJoinAndSelect('user.subscription', 'subscription')
      .leftJoinAndSelect('payment.bank', 'bank')
      .leftJoinAndSelect('payment.paket', 'paket');

    if (query) {
      qb.andWhere(
        '(user.name LIKE :query OR ' +
          'user.customerId LIKE :query OR ' +
          'paket.name LIKE :query)',
        { query: `%${query}%` },
      );
    }

    // 🔹 Date Range Filter
    if (startDate && endDate) {
      qb.andWhere('payment.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    if (month) {
      const [monthPart, yearPart] = month
        .split('-')
        .map((part) => parseInt(part, 10));
      if (monthPart && yearPart) {
        qb.andWhere('EXTRACT(MONTH FROM payment.created_at) = :month', {
          month: monthPart,
        });
        qb.andWhere('EXTRACT(YEAR FROM payment.created_at) = :year', {
          year: yearPart,
        });
      }
    }

    if (bank_id) {
      qb.andWhere('bank.id = :bank_id', { bank_id: `${bank_id}` });
    }

    // 🔹 Filter by Status (exact match)
    if (status) {
      qb.andWhere('payment.status = :status', { status });
    }

    // 🔹 Pagination
    qb.skip((page - 1) * limit)
      .take(limit)
      .orderBy('payment.createdAt', 'DESC');

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAllByUser(
    userId: string,
    query?: string,
    status?: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const qb = this.paymentRepository
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.paket', 'paket')
        .leftJoinAndSelect('payment.bank', 'bank')
        .leftJoinAndSelect('payment.user', 'user')
        .leftJoinAndSelect('user.subscription', 'subscription')
        .leftJoinAndSelect('user.paket', 'userPaket')
        .where('payment.user_id = :userId', { userId });

      // 🔍 QUERY SEARCH ON MULTIPLE FIELDS
      if (query) {
        qb.andWhere(
          `
        (
          payment.id LIKE :query OR
          user.name LIKE :query OR
          user.customerId LIKE :query OR
          paket.name LIKE :query OR
          bank.name LIKE :query
        )
        `,
          { query: `%${query}%` },
        );
      }

      // 🔖 FILTER STATUS
      if (status) {
        qb.andWhere('payment.status = :status', { status });
      }

      // 📅 FILTER DATE RANGE
      if (startDate && endDate) {
        qb.andWhere('payment.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      }

      // ORDER DESC / latest first
      qb.orderBy('payment.createdAt', 'DESC');

      // PAGINATION
      qb.skip((page - 1) * limit).take(limit);

      const [data, total] = await qb.getManyAndCount();

      return {
        data,
        total,
        page,
        limit,
      };
    } catch (error) {
      console.log(error);
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'There is an error with your query',
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async exportPaymentsToExcel(
    status?: string,
    startDate?: string,
    endDate?: string,
    bankId?: string,
    paketId?: string,
    customerId?: string,
  ) {
    try {
      const qb = this.paymentRepository
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.paket', 'paket')
        .leftJoinAndSelect('payment.bank', 'bank')
        .leftJoinAndSelect('payment.user', 'user');

      // 🔖 Filter status
      if (status) {
        qb.andWhere('payment.status = :status', { status });
      }

      // 📅 Filter date range
      if (startDate && endDate) {
        qb.andWhere('payment.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      }

      // 🏦 Filter by bank ID
      if (bankId) {
        qb.andWhere('payment.bank_id = :bankId', { bankId });
      }

      // 📦 Filter by paket ID
      if (paketId) {
        qb.andWhere('payment.paket_id = :paketId', { paketId });
      }

      // 👤 Filter by Customer ID
      if (customerId) {
        qb.andWhere('user.customerId LIKE :customerId', {
          customerId: `%${customerId}%`,
        });
      }

      const data = await qb.getMany();

      // ---------------- EXCEL PROCESS ----------------
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Payments');

      sheet.columns = [
        { header: 'Payment ID', key: 'id', width: 30 },
        { header: 'Customer ID', key: 'customerId', width: 20 },
        { header: 'User', key: 'user', width: 25 },
        { header: 'Package', key: 'paket', width: 20 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Bank', key: 'bank', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created At', key: 'createdAt', width: 25 },
      ];

      data.forEach((p) => {
        sheet.addRow({
          id: p.id,
          customerId: p.user?.customerId,
          user: p.user?.name,
          paket: p.paket?.name,
          bank: p.bank?.bank_name,
          amount: p.price,
          status: p.status,
          createdAt: p.createdAt,
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      console.log(error);
      throw new HttpException(
        'Failed to export data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string) {
    try {
      return await this.paymentRepository.findOneOrFail({
        where: { id },
        relations: { user: { subscription: true }, paket: true, bank: true },
      });
    } catch (error) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'payment not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async update(id: string, updatePaymentDto: UpdatePaymentDto) {
    const payment = await this.paymentRepository.findOne({ where: { id } });

    if (!payment) {
      throw new HttpException(
        { statusCode: HttpStatus.NOT_FOUND, error: 'Payment not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    const oldProof = payment.buktiPembayaran;
    const newProof = updatePaymentDto.buktiPembayaran;

    // === LOGIC SEDERHANA: KAPAN HARUS KIRIM NOTIF ADMIN ===
    const shouldNotify =
      newProof != null && // user upload bukti
      newProof !== oldProof; // dan berbeda dari sebelumnya

    // UPDATE FIELDS
    const updatedPayment: Partial<Payment> = {
      buktiPembayaran: newProof ?? oldProof, // kalau tidak ada upload, tetap pakai lama
    };

    // jika bukti baru → set paidAt
    if (shouldNotify) {
      updatedPayment.paidAt = new Date();
    }

    await this.paymentRepository.update(id, updatedPayment);

    // === KIRIM NOTIF ADMIN JIKA ADA BUKTI BARU ===
    if (shouldNotify) {
      this.WaSvc.sendNewPaymentNotificationToAdmins(id).catch((err) =>
        console.error('Failed sending WA admin notif:', err),
      );
    }

    return {
      data: await this.paymentRepository.findOne({ where: { id } }),
    };
  }

  async remove(id: string) {
    const payment = this.paymentRepository.findOne({
      where: { id },
    });

    if (!payment) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'payment not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    await this.paymentRepository.softDelete(id);

    return {
      message: 'payment deleted successfully',
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleSubscriptionPayments() {
    console.log(
      '[SubscriptionService] 🕐 Running daily subscription payment check...',
    );

    try {
      const today = new Date();
      const startOfToday = new Date(today.setHours(0, 0, 0, 0));

      const d23 = new Date(startOfToday.getTime() - 23 * 86400000);
      const d27 = new Date(startOfToday.getTime() - 27 * 86400000);
      const d30 = new Date(startOfToday.getTime() - 30 * 86400000);

      // ✔ Query subscriptions by exact date (00:00 → 23:59)
      const subs = await this.SubsRepository.find({
        where: [
          {
            start_date: Between(
              new Date(d23),
              new Date(d23.setHours(23, 59, 59, 999)),
            ),
          },
          {
            start_date: Between(
              new Date(d27),
              new Date(d27.setHours(23, 59, 59, 999)),
            ),
          },
          { start_date: LessThanOrEqual(d30) },
        ],
      });

      console.log(
        `[SubscriptionService] 📦 Found ${subs.length} subscriptions`,
      );

      for (const sub of subs) {
        const start = new Date(sub.start_date);
        const todayMid = new Date(startOfToday);

        const daysSinceStart = Math.floor(
          (todayMid.getTime() - start.getTime()) / 86400000,
        );

        if (daysSinceStart === 23) {
          await this.createPaymentForSubscription(sub.id, '7_day_reminder');
        } else if (daysSinceStart === 27) {
          await this.createPaymentForSubscription(sub.id, '3_day_reminder');
        } else if (daysSinceStart >= 30) {
          await this.createPaymentForSubscription(sub.id, 'expiry');
        }
      }

      console.log(
        '[SubscriptionService] ✅ Daily subscription payment check completed',
      );
    } catch (error) {
      console.error('[SubscriptionService] ❌ Error:', error);
    }
  }

  private async createPaymentForSubscription(
    subscriptionId: string,
    type: '7_day_reminder' | '3_day_reminder' | 'expiry',
  ) {
    try {
      // 1. Cari user berdasarkan subscription
      const user = await this.UserRepository.findOne({
        where: { subscription: { id: subscriptionId } },
        relations: { subscription: true, paket: true },
      });

      if (!user) {
        console.error(
          `[SubscriptionService] ❌ No user found for subscription ${subscriptionId}`,
        );
        return;
      }

      // 2. Cek pending payment terakhir
      const existingPayment = await this.paymentRepository.findOne({
        where: { user: { id: user.id }, status: 'PENDING' },
        order: { createdAt: 'DESC' },
      });

      if (existingPayment) {
        console.log(
          `[SubscriptionService] ℹ️ Pending payment already exists for ${subscriptionId}`,
        );
        return;
      }

      // 3. Buat payment baru
      const payment = this.paymentRepository.create({
        user,
        paket: user.paket,
        price: user.paket?.price || 0,
        status: 'PENDING',
        reason: `Auto-generated ${type} payment`,
      });

      const saved = await this.paymentRepository.save(payment);

      await this.UserRepository.update(user.id, {
        status: UserStatus.PENDING,
      });

      console.log(
        `[SubscriptionService] 💰 Created payment #${saved.id} for subscription ${subscriptionId} (${type})`,
      );
    } catch (error) {
      console.error(
        `[SubscriptionService] ❌ Failed to create payment for subscription ${subscriptionId}:`,
        error.message,
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async disableExpiredSubscriptions() {
    console.log('[SubscriptionService] 🕐 Checking expired subscriptions...');

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // normalize 00:00:00

      // Cari user yang punya subscription expired & masih aktif
      const expiredUsers = await this.UserRepository.find({
        where: {
          status: UserStatus.AKTIF,
          subscription: {
            due_date: LessThan(today),
          },
        },
        relations: { subscription: true },
      });

      console.log(
        `[SubscriptionService] 🔍 Found ${expiredUsers.length} expired active users`,
      );

      for (const user of expiredUsers) {
        await this.UserRepository.update(user.id, {
          status: UserStatus.NONAKTIF,
        });

        console.log(
          `[SubscriptionService] 🔴 User ${user.customerId} marked NONAKTIF (expired)`,
        );
      }

      console.log(
        '[SubscriptionService] ✅ Expired subscription check complete',
      );
    } catch (error) {
      console.error(
        '[SubscriptionService] ❌ Error in disableExpiredSubscriptions:',
        error.message,
      );
    }
  }
}
