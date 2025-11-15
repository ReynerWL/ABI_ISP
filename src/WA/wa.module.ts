// src/WA/wa.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Services
import { WhatsAppService } from './bot/wa.service';
import { SessionService } from './bot/session.service';
import { MenuHandlerService } from './bot/menuHandler';
import { MenuUIService } from './bot/menuUI';
import { ReminderService } from './bot/reminder';

// Entities
import { User } from '../user/entities/user.entity';
import { Payment } from '../payment/entities/payment.entity';

// Modules
import { UserModule } from '../user/user.module';
import { PaymentModule } from '../payment/payment.module';
import { MailModule } from '../mail/mail.module'; // 👈 Import MailModule
import { UserService } from '#/user/user.service';
import { PaymentService } from '#/payment/payment.service';
import { WhatsAppController } from './wa.controller';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Payment]),
    UserModule,
    PaymentModule,
    MailModule, // 👈 Provides MailService
  ],
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    SessionService,
    MenuHandlerService,
    MenuUIService,
    ReminderService,
    UserService,
    PaymentService,
    JwtService
  ],
  exports: [WhatsAppService],
})
export class WAModule {
  constructor(private readonly waService: WhatsAppService) {}

  async onModuleInit() {
    await this.waService.startBot();
  }
}
