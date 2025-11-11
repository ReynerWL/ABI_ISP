import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserStatus } from '../entities/user.entity';
import { Optional } from '@nestjs/common';

export class CreateUserDto {
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  password: string;

  @IsNotEmpty()
  phone_number: string;

  @IsNotEmpty()
  alamat: string;

  @IsNotEmpty()
  photo_ktp: string;

  @IsNotEmpty()
  @IsEnum(UserStatus)
  status: UserStatus;

  @IsNotEmpty()
  role: string;

  @IsNotEmpty()
  priority: boolean;

  @IsNotEmpty()
  paketsId: string;

  @IsNotEmpty()
  bankId: string;

  @Optional()
  ip_address: string;
}

export class CreateAdminDto {
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  password: string;

  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  phone_number: string;

  @IsNotEmpty()
  status: UserStatus;
}