import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from '#/role/entities/role.entity';
import { Payment } from '#/payment/entities/payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Payment])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserModule],
})
export class UserModule {}
