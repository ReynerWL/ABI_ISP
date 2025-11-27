import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WhatsAppService } from './bot/wa.service';
import { SessionService } from './bot/session.service';

import { User } from '../user/entities/user.entity';
import { Payment } from '../payment/entities/payment.entity';

import { UserModule } from '../user/user.module';
import { PaymentModule } from '../payment/payment.module';
import { MailModule } from '../mail/mail.module';

import { WhatsAppController } from './wa.controller';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    forwardRef(() => MailModule),
  ],

  controllers: [WhatsAppController],

  providers: [
    WhatsAppService,
    SessionService,
    JwtService,
  ],

  exports: [
    WhatsAppService,
  ],
})
export class WAModule {
  constructor(private readonly waService: WhatsAppService) {}

  async onModuleInit() {
    await this.waService.startBot();
  }
}
