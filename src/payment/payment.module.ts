import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { User } from '#/user/entities/user.entity';
import { MailModule } from '#/mail/mail.module';
import { WAModule } from '#/WA/wa.module';
import { JwtService } from '@nestjs/jwt';
import { Bank } from '#/bank/entities/bank.entity';
import { Paket } from '#/paket/entities/paket.entity';
import { Subscription } from '#/subscription/entities/subscription.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, User, Bank, Paket, Subscription]),
    MailModule,
    WAModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, JwtService],
  exports: [PaymentModule],
})
export class PaymentModule {}
