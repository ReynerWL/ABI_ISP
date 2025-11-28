import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from '#/role/entities/role.entity';
import { Payment } from '#/payment/entities/payment.entity';
import { WhatsAppService } from '#/WA/bot/wa.service';
import { SessionService } from '#/WA/bot/session.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '#/mail/mail.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Payment])],
  controllers: [UserController],
  providers: [UserService, WhatsAppService, SessionService,JwtService,MailService],
  exports: [UserModule],
})
export class UserModule {}
