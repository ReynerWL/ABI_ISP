import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment } from './entities/payment.entity';
import { DataSource, Repository } from 'typeorm';
import { User } from '#/user/entities/user.entity';
import { Bank } from '#/bank/entities/bank.entity';
import { Paket } from '#/paket/entities/paket.entity';
import { InjectRepository } from '@nestjs/typeorm';

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
      relations: ['users'],
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
      relations: ['users'],
    });
  }

  async confirmPayment(paymentId: string) {
    // Logic to confirm a payment
    return await this.dataSource.manager.findOne(Payment, {
      where: { id: paymentId },
      relations: ['users'],
    });
  }

  async findAll(
    query?: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const qb = this.paymentRepository.createQueryBuilder('payment');

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

  findOne(id: string) {
    const payment = this.dataSource.manager.findOne(Payment, {
      where: { id },
      relations: ['users', 'pakets'],
    });
    return payment;
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
