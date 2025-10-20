import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Log } from './log.entity';

@Injectable()
export class LogService {
  constructor(
    @InjectRepository(Log)
    private logRepository: Repository<Log>,
  ) {}

  async createLogEntry(data: any) {
    const log = new Log();
    log.data = data;
    return await this.logRepository.save(log);
  }
}