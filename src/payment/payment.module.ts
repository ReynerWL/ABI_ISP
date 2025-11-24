import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { User } from '#/user/entities/user.entity';
import { MenuHandlerService } from '#/WA/bot/menuHandler';
import { MenuUIService } from '#/WA/bot/menuUI';
import { MailService } from '#/mail/mail.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, User])],
  controllers: [PaymentController],
  providers: [PaymentService, MenuHandlerService, MenuUIService, MailService],
  exports: [PaymentModule],
})
export class PaymentModule {}
