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

  @Optional()
  birth_date: string

  @IsNotEmpty()
  photo_ktp: string;

  @IsNotEmpty()
  @IsEnum(UserStatus)
  status: UserStatus;

  @IsNotEmpty()
  role: string;

  @Optional()
  bukti_pembayaran: string

  @IsNotEmpty()
  priority: boolean;

  @IsNotEmpty()
  paketsId: string;

  @IsNotEmpty()
  bankId: string;

  @Optional()
  ip_address: string;

  @Optional()
  provinsi: string;

  @Optional()
  kota: string;

  @Optional()
  kecamatan: string;

  @Optional()
  kelurahan: string;

  @IsNotEmpty()
  is_pelanggan_lama: boolean;

  @Optional()
  pelanggan_lama: PelangganLamaDto;
}

export class PelangganLamaDto {
  @Optional()
  buktipembayaran: string;

  @Optional()
  start_date: Date;

  @Optional()
  due_date: Date;

  @Optional()
  paid_at: Date;
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
