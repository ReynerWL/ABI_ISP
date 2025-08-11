// src/WA/wa.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { WAService } from './bot/wa.service';

@Module({
  providers: [WAService],
  exports: [WAService],
})
export class WAModule implements OnModuleInit {
  constructor(private readonly waService: WAService) {}

  async onModuleInit() {
    await this.waService.start(); // Start bot when app starts
  }
}
