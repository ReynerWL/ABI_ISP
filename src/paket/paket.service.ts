import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreatePaketDto } from './dto/create-paket.dto';
import { UpdatePaketDto } from './dto/update-paket.dto';
import { Paket } from './entities/paket.entity';

@Injectable()
export class PaketService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Paket)
    private readonly paketRepository: Repository<Paket>,
  ) {}

  async create(createPaketDto: CreatePaketDto) {
    // Check for duplicate paket name
    if (createPaketDto.name) {
      const exists = await this.paketRepository.findOne({
        where: { name: createPaketDto.name },
      });
      if (exists) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'paket name already used',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const paket = this.paketRepository.create(createPaketDto);
    const result = await this.paketRepository.save(paket);

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
    const qb = this.paketRepository.createQueryBuilder('paket');

    if (query) {
      qb.andWhere('paket.name LIKE :query', { query: `%${query}%` });
    }

    if (startDate && endDate) {
      qb.andWhere('paket.createdAt BETWEEN :startDate AND :endDate', {
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
    const paket = await this.paketRepository.findOne({
      where: { id },
    });

    if (!paket) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'paket not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return paket;
  }

  async update(id: string, updatePaketDto: UpdatePaketDto) {
    const paket = await this.paketRepository.findOne({
      where: { id },
    });

    if (!paket) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'paket not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (updatePaketDto.name) {
      const exists = await this.paketRepository.findOne({
        where: { name: updatePaketDto.name },
      });
      if (exists && exists.id !== id) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'paket name already used',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    await this.paketRepository.update(id, updatePaketDto);

    return {
      data: await this.paketRepository.findOne({ where: { id } }),
    };
  }

  async remove(id: string) {
    const paket = await this.paketRepository.findOne({
      where: { id },
    });

    if (!paket) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'paket not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.paketRepository.softDelete(id);

    return {
      message: 'Paket deleted successfully',
    };
  }
}