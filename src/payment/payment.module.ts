import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { User } from '#/user/entities/user.entity';
import { MailService } from '#/mail/mail.service';
import { WhatsAppService } from '#/WA/bot/wa.service';
import { SessionService } from '#/WA/bot/session.service';
import { JwtService } from '@nestjs/jwt';
import { Bank } from '#/bank/entities/bank.entity';
import { Paket } from '#/paket/entities/paket.entity';
import { Subscription } from '#/subscription/entities/subscription.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, User,Bank,Paket,Subscription])],
  controllers: [PaymentController],
  providers: [PaymentService,MailService, WhatsAppService, SessionService,JwtService],
  exports: [PaymentModule],
})
export class PaymentModule {}
