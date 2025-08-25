import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { Report } from './entities/report.entity';

@Injectable()
export class ReportService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
  ) {}

  async create(createReportDto: CreateReportDto) {
    const report = this.reportRepository.create(createReportDto);
    const result = await this.reportRepository.save(report);

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
    const qb = this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.customer', 'customer')
      .leftJoinAndSelect('report.petugas', 'petugas')
      .leftJoinAndSelect('report.paket', 'paket');

    if (query) {
      qb.andWhere('report.lokasi LIKE :query OR report.note LIKE :query', {
        query: `%${query}%`,
      });
    }

    if (startDate && endDate) {
      qb.andWhere('report.createdAt BETWEEN :startDate AND :endDate', {
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
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['customer', 'petugas', 'paket'],
    });

    if (!report) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'report not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return report;
  }

  async update(id: string, updateReportDto: UpdateReportDto) {
    const report = await this.reportRepository.findOne({
      where: { id },
    });

    if (!report) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'report not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.reportRepository.update(id, updateReportDto);

    return {
      data: await this.reportRepository.findOne({ where: { id } }),
    };
  }

  async remove(id: string) {
    const report = await this.reportRepository.findOne({
      where: { id },
    });

    if (!report) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'report not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.reportRepository.softDelete(id);

    return {
      message: 'Report deleted successfully',
    };
  }
}
