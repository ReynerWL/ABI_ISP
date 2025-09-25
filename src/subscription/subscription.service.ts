import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { Subscription } from './entities/subscription.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {}

  async create(createSubscriptionDto: CreateSubscriptionDto) {
    const subscription = this.subscriptionRepository.create(
      createSubscriptionDto,
    );
    const result = await this.subscriptionRepository.save(subscription);

    return {
      data: result,
    };
  }

  async findAll(
    query?: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const qb = this.subscriptionRepository
      .createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.user', 'user')
      .leftJoinAndSelect('subscription.pakets', 'pakets')
      .leftJoinAndSelect('subscription.banks', 'banks');

    if (query) {
      qb.andWhere('user.id LIKE :query', { query: `%${query}%` });
    }

    if (startDate && endDate) {
      qb.andWhere('subscription.createdAt BETWEEN :startDate AND :endDate', {
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
    const subscription = await this.subscriptionRepository.findOne({
      where: { id },
      relations: ['user', 'pakets', 'banks'],
    });

    if (!subscription) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'subscription not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return subscription;
  }

  async update(id: string, updateSubscriptionDto: UpdateSubscriptionDto) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id },
    });

    if (!subscription) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'subscription not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.subscriptionRepository.update(id, updateSubscriptionDto);

    return {
      data: await this.subscriptionRepository.findOne({ where: { id } }),
    };
  }

  async remove(id: string) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id },
    });

    if (!subscription) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'subscription not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.subscriptionRepository.softDelete(id);

    return {
      message: 'Subscription deleted successfully',
    };
  }
}
