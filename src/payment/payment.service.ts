import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment } from './entities/payment.entity';
import { DataSource, Repository } from 'typeorm';
import { User } from '#/user/entities/user.entity';
import { Bank } from '#/bank/entities/bank.entity';
import { Paket } from '#/paket/entities/paket.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscription } from '#/subscription/entities/subscription.entity';

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
      where: { id: createPaymentDto.paketsId },
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
    const payment = this.dataSource.manager.create(Payment, {
      ...createPaymentDto,
      user: user,
      paket: paket,
      bank: bank,
      status: 'PENDING',
    });
    return await this.dataSource.manager.save(payment);
  }

  async rejectPayment(paymentId: string, reason: string) {
    // Logic to reject a payment
    const payment = await this.dataSource.manager.findOne(Payment, {
      where: { id: paymentId },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    await this.dataSource.manager.update(Payment, paymentId, {
      status: 'REJECTED',
      reason: reason,
    });
    return await this.dataSource.manager.findOne(Payment, {
      where: { id: payment.id },
      relations: { user: true },
    });
  }

async confirmPayment(paymentId: string) {
  const payment = await this.dataSource.manager.findOne(Payment, {
    where: { id: paymentId },
    relations: ['user', 'paket', 'bank'],
  });

  if (!payment) {
    throw new Error('Payment not found');
  }

  // Get user's latest active subscription
  const latestSubscription = await this.dataSource.manager.findOne(Subscription, {
    where: { user: { id: payment.user.id } },
    order: { start_date: 'DESC' },
    relations: ['user'],
  });

  let startDate: Date;
  let dueDate: Date;

  if (!latestSubscription || latestSubscription.due_date < new Date()) {
    // 🆕 First-time or expired → Start today
    startDate = new Date();
    dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + 30); // 30 days from today
  } else {
    // 🔁 Renewal → Start after old due date
    startDate = new Date(latestSubscription.due_date);
    dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + 30); // 30 days from previous end
  }

  // ✅ Convert to ISO string for PostgreSQL compatibility
  const startDateStr = startDate.toISOString();
  const dueDateStr = dueDate.toISOString();

  // ✅ Create new subscription
  await this.dataSource.manager.save(Subscription, {
    start_date: startDateStr,
    due_date: dueDateStr,
    pakets: payment.paket,
    banks: payment.bank,
    user: payment.user,
  });

  // ✅ Update payment status
  await this.paymentRepository.update(paymentId, {
    status: 'CONFIRMED',
    start_date: startDateStr,
    due_date: dueDateStr,
  });

  return await this.dataSource.manager.findOne(Payment, {
    where: { id: payment.id },
    relations: {user:{subscription:true}, paket: true, bank: true }
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

    // 🔹 Text Search (general query)
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

    if (month){
      qb.andWhere('EXTRACT(MONTH FROM payment.createdAt) = :month', { month });
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
    startDate?: string,
    endDate?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try{const qb = this.paymentRepository.createQueryBuilder('payment');

    qb.where('payment.usersId = :userId', { userId });

    if (query) {
      qb.andWhere('payment.id LIKE :query', { query: `%${query}%` });
    }

    if (startDate && endDate) {
      qb.andWhere('payment.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    qb.leftJoinAndSelect('payment.pakets', 'pakets')
      .leftJoinAndSelect('payment.banks', 'banks')
      .leftJoinAndSelect('payment.user', 'user')
      .leftJoinAndSelect('user.subscription', 'subscription')

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  } catch (error) {
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
}
