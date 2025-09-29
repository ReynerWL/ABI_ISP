// src/qris/qris.module.ts
import { Module } from '@nestjs/common';
import { QrisController } from './qris.controller';
import { QrisService } from './qris.service';

@Module({
  controllers: [QrisController],
  providers: [QrisService],
  exports: [QrisService],
})
export class QrisModule {}
