import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment } from './entities/payment.entity';
import {
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
import dayjs from 'dayjs';
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
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Payment not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const paket = await this.PaketRepository.findOne({
      where: { id: payment.paket.id },
    });
    if (!paket) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Paket not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    const bank = await this.BankRepository.findOne({
      where: { id: payment.bank.id },
    });
    if (!bank) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Bank not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Get user's latest active subscription
    const user = await this.UserRepository.findOne({
      where: { id: payment.user?.id },
      relations: { paket: true, subscription: true },
    });
    console.log(user);
    const latestSubscription = await this.SubsRepository.findOne({
      where: { user: { id: user.subscription?.id } },
      relations: { user: true, paket: true },
    });
    console.log(latestSubscription);

    let startDate: Date;
    let dueDate: Date;

    if (!latestSubscription || latestSubscription.due_date < new Date()) {
      startDate = new Date();
      dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + 30); // 30 days from today
    } else {
      startDate = new Date(latestSubscription.due_date);
      dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + 30); // 30 days from previous end
    }

    const startDateStr = startDate.toISOString();
    const dueDateStr = dueDate.toISOString();

    if (latestSubscription === null) {
      const subs = this.SubsRepository.create({
        start_date: startDateStr,
        due_date: dueDateStr,
        paket: { id: paket.id },
        banks: { id: bank.id },
        user: { id: payment.user.id },
      });

      await this.UserRepository.update(payment.user.id, {
        subscription: { id: subs.id },
        paket: { id: paket.id },
        status: UserStatus.AKTIF,
      });
    } else {
      await this.SubsRepository.update(latestSubscription.id, {
        start_date: startDateStr,
        due_date: dueDateStr,
        paket: { id: paket.id },
        banks: { id: bank.id },
      });
    }

    await this.paymentRepository.update(paymentId, {
      status: 'CONFIRMED',
      start_date: startDateStr,
      due_date: dueDateStr,
      paket: { id: paket.id },
      bank: { id: bank.id },
      paidAt: new Date(),
      confirmedAt: new Date(),
    });

    setImmediate(() => {
      this.WaSvc.sendPaymentConfirmed(
        payment.user?.phone_number,
        payment.id,
        payment.user?.id,
      ).catch((err) => {
        console.error('Failed to send WA message:', err);
      });
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
    bank?: string,
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

    if (bank) {
      qb.andWhere('bank.bank_name LIKE :bank', { bank: `%${bank}%` });
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
      const qb = this.paymentRepository.createQueryBuilder('payment');
      qb.where('payment.user_id = :userId', { userId });

      if (query) {
        qb.andWhere('payment.id LIKE :query', { query: `%${query}%` });
      }

      if (status) {
        qb.andWhere('payment.status = :status', { status });
      }

      if (startDate && endDate) {
        qb.andWhere('payment.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      }

      qb.leftJoinAndSelect('payment.paket', 'paket')
        .leftJoinAndSelect('payment.bank', 'bank')
        .leftJoinAndSelect('payment.user', 'user')
        .leftJoinAndSelect('user.subscription', 'subscription')
        .leftJoinAndSelect('user.paket', 'userPaket');

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
    const payment = await this.paymentRepository.findOne({
      where: { id },
    });

    if (!payment) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'paket not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const updatedPayment = new Payment();
    updatedPayment.buktiPembayaran =
      updatePaymentDto.buktiPembayaran ?? payment.buktiPembayaran;
    updatedPayment.paidAt = new Date();
    Object.assign(updatePaymentDto, updatedPayment);
    await this.paymentRepository.update(id, updatePaymentDto);

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
      const twentyThreeDaysAgo = new Date(today);
      twentyThreeDaysAgo.setDate(today.getDate() - 23);

      const twentySevenDaysAgo = new Date(today);
      twentySevenDaysAgo.setDate(today.getDate() - 27);

      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);

      // Find subscriptions that started exactly 23, 27, or 30+ days ago
      const subscriptions = await this.SubsRepository.find({
        where: [
          // 23 days old (7 days left)
          { start_date: LessThanOrEqual(twentyThreeDaysAgo) },
          // 27 days old (3 days left)
          { start_date: LessThanOrEqual(twentySevenDaysAgo) },
          // 30+ days old (expired)
          { start_date: LessThanOrEqual(thirtyDaysAgo) },
        ],
        relations: { user: true, paket: true, banks: true },
      });

      console.log(
        `[SubscriptionService] 📦 Found ${subscriptions.length} subscriptions to process`,
      );

      for (const subscription of subscriptions) {
        const startDate = new Date(subscription.start_date);
        const daysSinceStart = Math.floor(
          (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysSinceStart >= 23 && daysSinceStart < 24) {
          console.log(
            `[SubscriptionService] 📅 7-day reminder for user ${subscription.user?.customerId}`,
          );
          await this.createPaymentForSubscription(
            subscription.id,
            '7_day_reminder',
          );
        } else if (daysSinceStart >= 27 && daysSinceStart < 28) {
          console.log(
            `[SubscriptionService] ⚠️ 3-day reminder for user ${subscription.user?.customerId}`,
          );
          await this.createPaymentForSubscription(
            subscription.id,
            '3_day_reminder',
          );
        } else if (daysSinceStart >= 30) {
          console.log(
            `[SubscriptionService] 🔴 Expiry for user ${subscription.user?.customerId}`,
          );
          await this.createPaymentForSubscription(subscription.id, 'expiry');
        }
      }

      console.log(
        '[SubscriptionService] ✅ Daily subscription payment check completed',
      );
    } catch (error) {
      console.error(
        '[SubscriptionService] ❌ Error in subscription payment check:',
        error.message,
      );
    }
  }

  private async createPaymentForSubscription(
    subscriptionid: string,
    type: '7_day_reminder' | '3_day_reminder' | 'expiry',
  ) {
    const subscription = await this.SubsRepository.findOne({
      where: { id: subscriptionid },
      relations: { user: true, paket: true, banks: true },
    });

    try {
      // Check if a pending payment already exists for this subscription
      const existingPayment = await this.paymentRepository.findOne({
        where: {
          user: { id: subscription.user.id },
          status: 'PENDING',
        },
        order: {
          createdAt: 'DESC',
        },
      });

      if (existingPayment) {
        console.log(
          `[SubscriptionService] ℹ️ Pending payment already exists for subscription ${subscription.id}`,
        );
        return;
      }

      // Create new payment
      const payment = new Payment();
      payment.user = subscription.user;
      payment.paket = subscription.paket;
      payment.bank = subscription.banks;
      payment.price = subscription.paket?.price || 0;
      payment.status = 'PENDING';
      payment.reason = `Auto-generated ${type} payment`;

      // Save payment
      const savedPayment = await this.paymentRepository.save(payment);

      console.log(
        `[SubscriptionService] 💰 Created new payment #${savedPayment.id} for subscription ${subscription.id} (${type})`,
      );
    } catch (error) {
      console.error(
        `[SubscriptionService] ❌ Failed to create payment for subscription ${subscription.id}:`,
        error.message,
      );
    }
  }
}
