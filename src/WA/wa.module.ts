// src/WA/wa.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { WhatsAppService } from './bot/wa.service';

@Module({
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WAModule implements OnModuleInit {
  constructor(private readonly waService: WhatsAppService) {}

  async onModuleInit() {
    await this.waService.startBot(); // Start bot when app starts
  }
}
