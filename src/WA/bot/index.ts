// src/index.ts
import { NestFactory } from '@nestjs/core';
import { WhatsAppService } from './wa.service';
import { Logger } from '@nestjs/common';
import { WAModule } from '../wa.module';

async function bootstrap() {
  const app = await NestFactory.create(WAModule);
  const waService = app.get(WhatsAppService);
  const logger = new Logger('Bootstrap');

  try {
    await waService.startBot();
    logger.log('WhatsApp bot started successfully');
    await app.listen(3000);
  } catch (error) {
    logger.error('Failed to start WhatsApp bot', error.stack);
    process.exit(1);
  }
}

bootstrap();
