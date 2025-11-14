import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment } from './entities/payment.entity';
import { DataSource, LessThan, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { User, UserStatus } from '#/user/entities/user.entity';
import { Bank } from '#/bank/entities/bank.entity';
import { Paket } from '#/paket/entities/paket.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscription } from '#/subscription/entities/subscription.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import dayjs from 'dayjs';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private dataSource: DataSource,
  ) {}

async create(createPaymentDto: CreatePaymentDto) {
  const user = await this.dataSource.manager.findOne(User, {
    where: { id: createPaymentDto.usersId },
  });
  if (!user) {
    throw new Error('User not found');
  }

  const paket = await this.dataSource.manager.findOne(Paket, {
    where: { id: createPaymentDto.paketId },
  });
  if (!paket) {
    throw new Error('Paket not found');
  }

  const bank = await this.dataSource.manager.findOne(Bank, {
    where: { id: createPaymentDto.banksId },
  });
  if (!bank) {
    throw new Error('Bank not found');
  }

  // ✅ Check for existing PENDING payment with same paketId and no buktiPembayaran
  const existingPendingPayment = await this.dataSource.manager.findOne(Payment, {
    where: {
      user: user,
      paket: paket,
      status: 'PENDING',
      buktiPembayaran: null, // or '' if you store empty string
    },
  });

  // ✅ If found, reject it
  if (existingPendingPayment) {
    await this.dataSource.manager.update(Payment, existingPendingPayment.id, {
      status: 'REJECTED',
      reason: 'New payment created — old pending payment rejected',
    });
  }

  // ✅ Create new payment
  const payment = this.dataSource.manager.create(Payment, {
    ...createPaymentDto,
    user: user,
    paket: paket,
    bank: bank,
    status: 'PENDING', // New payment starts as PENDING
  });

  return await this.dataSource.manager.save(payment);
}

  async rejectPayment(paymentId: string, reason: string) {
    // Logic to reject a payment
    const payment = await this.dataSource.manager.findOne(Payment, {
      where: { id: paymentId },
    });

    //throw error 404
    if (!payment){
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Payment not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.dataSource.manager.update(Payment, paymentId, {
      status: 'REJECTED',
      reason: reason,
    });

    //Create a new payment with the same details but status PENDING
    const newPayment = this.dataSource.manager.create(Payment, {
      user: payment.user,
      paket: payment.paket,
      bank: payment.bank,
      price: payment.price,
      status: 'PENDING',
    });

    await this.dataSource.manager.save(newPayment);

    return await this.dataSource.manager.findOne(Payment, {
      where: { id: payment.id },
      relations: { user: true },
    });
  }

async confirmPayment(paymentId: string) {
  const payment = await this.dataSource.manager.findOne(Payment, {
    where: { id: paymentId },
    relations: { user: true, paket: true, bank: true },
  });

    if (!payment){
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Payment not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const paket = await this.dataSource.manager.findOne(Paket, {
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
    const bank = await this.dataSource.manager.findOne(Bank, {
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
  const latestSubscription = await this.dataSource.manager.findOne(Subscription, {
    where: { user: { id: payment.user.id } },
    relations: {user:true, paket:true},
  });

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

if (latestSubscription !== null) {
  await this.dataSource.manager.update(Subscription, latestSubscription.id, {
    start_date: startDateStr,
    due_date: dueDateStr,
    paket: paket,
    banks: bank,
  });
} else {
   await this.dataSource.manager.save(Subscription, {
    start_date: startDateStr,
    due_date: dueDateStr,
    paket: paket,
    banks: bank,
    user: payment.user,
  });
}
  await this.dataSource.manager.update(User, payment.user.id, {
    subscription: payment.user.subscription,
    paket: paket,
    status: UserStatus.AKTIF,
  });

  await this.paymentRepository.update(paymentId, {
    status: 'CONFIRMED',
    start_date: startDateStr,
    due_date: dueDateStr,
    paket: paket,
    bank: bank,
    paidAt: new Date(),
    confirmedAt: new Date(),
  });

  return await this.dataSource.manager.findOne(Payment, {
    where: { id: payment.id },
    relations: {user:{subscription:{paket:true}}, paket: true, bank: true }
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
      .leftJoinAndSelect('payment.paket', 'paket')

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
      const [monthPart, yearPart] = month.split('-').map(part => parseInt(part, 10));
      if (monthPart && yearPart) {
        qb.andWhere('EXTRACT(MONTH FROM payment.created_at) = :month', { month: monthPart });
        qb.andWhere('EXTRACT(YEAR FROM payment.created_at) = :year', { year: yearPart });
      }
    }

    if (bank) {
      qb.andWhere('bank.bank_name LIKE :bank', { bank:`%${bank}%`});
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
    try{
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
      .leftJoinAndSelect('user.paket', 'userPaket')

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
    return await this.dataSource.manager.findOneOrFail(Payment, {
      where: { id },
    relations: { user: {subscription:true}, paket: true,bank:true },
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
    updatedPayment.buktiPembayaran = updatePaymentDto.buktiPembayaran ?? payment.buktiPembayaran;
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
    console.log('[SubscriptionService] 🕐 Running daily subscription payment check...');

    try {
      const today = new Date();
      const twentyThreeDaysAgo = new Date(today);
      twentyThreeDaysAgo.setDate(today.getDate() - 23);

      const twentySevenDaysAgo = new Date(today);
      twentySevenDaysAgo.setDate(today.getDate() - 27);

      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);

      // Find subscriptions that started exactly 23, 27, or 30+ days ago
      const subscriptions = await this.dataSource.manager.find(Subscription, {
        where: [
          // 23 days old (7 days left)
          { start_date: LessThanOrEqual(twentyThreeDaysAgo) },
          // 27 days old (3 days left)
          { start_date: LessThanOrEqual(twentySevenDaysAgo) },
          // 30+ days old (expired)
          { start_date: LessThanOrEqual(thirtyDaysAgo) },
        ],
        relations: { user: true, paket: true, banks: true},
      });

      console.log(`[SubscriptionService] 📦 Found ${subscriptions.length} subscriptions to process`);

      for (const subscription of subscriptions) {
        const startDate = new Date(subscription.start_date);
        const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceStart >= 23 && daysSinceStart < 24) {
          console.log(`[SubscriptionService] 📅 7-day reminder for user ${subscription.user?.customerId}`);
          await this.createPaymentForSubscription(subscription.id, '7_day_reminder');
        } else if (daysSinceStart >= 27 && daysSinceStart < 28) {
          console.log(`[SubscriptionService] ⚠️ 3-day reminder for user ${subscription.user?.customerId}`);
          await this.createPaymentForSubscription(subscription.id, '3_day_reminder');
        } else if (daysSinceStart >= 30) {
          console.log(`[SubscriptionService] 🔴 Expiry for user ${subscription.user?.customerId}`);
          await this.createPaymentForSubscription(subscription.id, 'expiry');
        }
      }

      console.log('[SubscriptionService] ✅ Daily subscription payment check completed');
    } catch (error) {
      console.error('[SubscriptionService] ❌ Error in subscription payment check:', error.message);
    }
  }

  private async createPaymentForSubscription(
    subscriptionid: string,
    type: '7_day_reminder' | '3_day_reminder' | 'expiry'
  ) {
    const paymentRepo = this.dataSource.manager.getRepository(Payment);

    const subscription = await this.dataSource.manager.findOne(Subscription, {
      where: { id: subscriptionid },
      relations: { user: true, paket: true, banks: true },
    });
    
    try {
      // Check if a pending payment already exists for this subscription
      const existingPayment = await paymentRepo.findOne({
        where: {
          user: { id: subscription.user.id },
          status: 'PENDING',
        },
        order: {
          createdAt: 'DESC',
        },
      });

      if (existingPayment) {
        console.log(`[SubscriptionService] ℹ️ Pending payment already exists for subscription ${subscription.id}`);
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
      const savedPayment = await paymentRepo.save(payment);
      
      console.log(`[SubscriptionService] 💰 Created new payment #${savedPayment.id} for subscription ${subscription.id} (${type})`);
      
    } catch (error) {
      console.error(`[SubscriptionService] ❌ Failed to create payment for subscription ${subscription.id}:`, error.message);
    }
  }
}
