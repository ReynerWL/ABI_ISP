import { Optional } from '@nestjs/common';
import { IsNotEmpty } from 'class-validator';

export class PaymentDto {
  @IsNotEmpty()
  paketId: string;
  @IsNotEmpty()
  price: number;
  @IsNotEmpty()
  buktiPembayaran: string;
  @Optional()
  banksId: string;
}

export class RegisterDto {
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  phone_number: string;

  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  birth_date: string;

  @IsNotEmpty()
  password: string;

  @IsNotEmpty()
  alamat: string;

  @IsNotEmpty()
  provinsi: string;

  @IsNotEmpty()
  kota: string;

  @IsNotEmpty()
  kecamatan: string;

  @IsNotEmpty()
  kelurahan: string;

  @IsNotEmpty()
  photo_ktp: string;

  @IsNotEmpty()
  payment: PaymentDto;
}
