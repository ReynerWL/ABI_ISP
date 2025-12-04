import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreatePaketDto } from './dto/create-paket.dto';
import { UpdatePaketDto } from './dto/update-paket.dto';
import { Paket } from './entities/paket.entity';
import { PaginationDto } from '#/utils/pagination.dto';
import { User } from '#/user/entities/user.entity';

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

    return result;
  }

  async findAll(
    query?: string,
    status?: boolean,
    order: 'ASC' | 'DESC' = 'DESC',
    paginationDto?: PaginationDto,
  ) {
    const { page, limit } = paginationDto;

    const qb = this.paketRepository.createQueryBuilder('paket');

    if (query) {
      qb.andWhere('paket.name LIKE :query', { query: `%${query}%` });
    }

    if (status != undefined || null) {
      qb.andWhere('paket.status = :status', { status });
    }

    qb.orderBy('paket.price', order);

    if (paginationDto) {
      qb.skip((page - 1) * limit).take(limit);
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const paket = await this.paketRepository.findOne({
      where: { id },
    });

    if (!paket) {
      throw new NotFoundException('Data Paket tidak ditemukan');
    }

    return paket;
  }

  async PaketActive(id: string) {
    const paket = await this.paketRepository.findOne({ where: { id: id } });
    if (!paket) {
      throw new NotFoundException('Data Paket tidak ditemukan');
    }
    await this.paketRepository.update(paket.id, { status: true });
    return await this.paketRepository.findOne({ where: { id: paket.id } });
  }

  async PaketInactive(id: string) {
    const paket = await this.paketRepository.findOne({ where: { id: id } });
    if (!paket) {
      throw new NotFoundException('Data Paket tidak ditemukan');
    }
    await this.paketRepository.update(id, { status: false });
    return await this.paketRepository.findOne({ where: { id: paket.id } });
  }

  async update(id: string, updatePaketDto: UpdatePaketDto) {
    const paket = await this.paketRepository.findOne({
      where: { id },
    });

    if (!paket) {
      throw new NotFoundException('Data Paket tidak ditemukan');
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

  async remove(id: string, role: string) {
    // cek apakah paket ada
    const paket = await this.paketRepository.findOne({ where: { id } });
    
    if (role != "SUPERADMIN"){
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Akses Ditolak Bukan Super Admin',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (!paket) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Paket tidak ditemukan',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // cek apakah ada user yang masih menggunakan paket ini
    const userUsingPaket = await this.dataSource.manager.findOne(User,{
      where: { paket: { id } },
    });

    if (userUsingPaket) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error:
            'Ada user yang menggunakan paket ini. Paket tidak bisa dihapus, hanya bisa dinonaktifkan.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Jika aman → soft delete
    await this.paketRepository.softDelete(id);

    return {
      message: 'Paket berhasil dihapus',
    };
  }
}
