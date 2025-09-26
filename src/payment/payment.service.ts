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
      pakets: paket,
      banks: bank,
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
    // Logic to confirm a payment
    const payment = await this.dataSource.manager.findOne(Payment, {
      where: { id: paymentId },
      relations: { user: { subscription: true }, pakets: true, banks: true },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    await this.dataSource.manager.update(Payment, paymentId, {
      status: 'CONFIRMED',
    });

    await this.dataSource.manager.update(
      Subscription,
      payment.user.subscription.id,
      {
        start_date: new Date(),
        due_date: new Date(new Date().setMonth(new Date().getMonth() + 1)),
        pakets: payment.pakets,
        banks: payment.banks,
      },
    );

    return await this.dataSource.manager.findOne(Payment, {
      where: { id: payment.id },
      relations: { user: true },
    });
  }

  // src/payment/payment.service.ts
  async findAll(
    query?: string,
    startDate?: string,
    endDate?: string,
    bankId?: string,
    paketId?: string,
    status?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.user', 'user')
      .leftJoinAndSelect('payment.bank', 'bank') // ← Join Bank
      .leftJoinAndSelect('payment.paket', 'paket'); // ← Join Paket

    // 🔹 Text Search (general query)
    if (query) {
      qb.andWhere(
        '(payment.id LIKE :query OR ' +
          'user.name LIKE :query OR ' +
          'user.customerId LIKE :query OR ' +
          'bank.name LIKE :query OR ' +
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

    // 🔹 Filter by Bank (exact match)
    if (bankId) {
      qb.andWhere('bank.id = :bankId', { bankId });
    }

    // 🔹 Filter by Paket (exact match)
    if (paketId) {
      qb.andWhere('paket.id = :paketId', { paketId });
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
    const qb = this.paymentRepository.createQueryBuilder('payment');

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

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    return await this.dataSource.manager.findOneOrFail(Payment, {
      where: { id },
      relations: { user: true, pakets: true },
    });
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
