import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { Bank } from './entities/bank.entity';

@Injectable()
export class BankService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Bank)
    private readonly bankRepository: Repository<Bank>,
  ) {}

  async create(createBankDto: CreateBankDto) {
    // Check for duplicate bank name
    if (createBankDto.bank_name) {
      const exists = await this.bankRepository.findOne({
        where: { bank_name: createBankDto.bank_name },
      });
      if (exists) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'bank name already used',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const bank = this.bankRepository.create(createBankDto);
    const result = await this.bankRepository.save(bank);

    return {
      data: result,
    };
  }

  async findAll(query?: string, page: number = 1, limit: number = 10) {
    const qb = this.bankRepository.createQueryBuilder('bank');

    if (query) {
      qb.andWhere('bank.bank_name LIKE :query', { query: `%${query}%` });
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
    const bank = await this.bankRepository.findOne({
      where: { id },
    });

    if (!bank) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'bank not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return bank;
  }

  async update(id: string, updateBankDto: UpdateBankDto) {
    const bank = await this.bankRepository.findOne({
      where: { id },
    });

    if (!bank) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'bank not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (updateBankDto.bank_name) {
      const exists = await this.bankRepository.findOne({
        where: { bank_name: updateBankDto.bank_name },
      });
      if (exists && exists.id !== id) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'bank name already used',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    await this.bankRepository.update(id, updateBankDto);

    return {
      data: await this.bankRepository.findOne({ where: { id } }),
    };
  }

  async remove(id: string) {
    const bank = await this.bankRepository.findOne({
      where: { id },
    });

    if (!bank) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'bank not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.bankRepository.softDelete(id);

    return {
      message: 'Bank deleted successfully',
    };
  }
}
