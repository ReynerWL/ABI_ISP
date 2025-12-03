// src/log/log.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Log } from './log.entity';

@Injectable()
export class LogService {
  private readonly logger = new Logger(LogService.name);

  constructor(
    @InjectRepository(Log)
    private readonly logRepository: Repository<Log>,
  ) {}

  async createLogEntry(data: any) {
    try {
      const log = new Log();
      log.data = data;
      const savedLog = await this.logRepository.save(log);
      await this.logRepository.create(savedLog)
      this.logger.debug(`✅ Log entry saved with ID: ${savedLog.id}`);
      return savedLog;
    } catch (error) {
      this.logger.error('❌ Failed to save log entry', error.stack);
      throw error; // Re-throw so interceptor can catch and log the DB error
    }
  }

  // Optional: Add methods to query logs
  async findAll(role: string, page: number = 1, limit: number = 10) {
    if (role.toLowerCase() !== 'superadmin') {
      throw new Error('Unauthorized');
    }

    const [data, total] = await this.logRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  async findOne(id: string) {
    return this.logRepository.findOne({ where: { id } });
  }
}
