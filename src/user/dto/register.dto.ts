import { IsNotEmpty } from 'class-validator';

export class PaymentDto {
  @IsNotEmpty()
  paketsId: string;
  @IsNotEmpty()
  banksId: string;
  @IsNotEmpty()
  price: number;
  @IsNotEmpty()
  usersId: string;
  @IsNotEmpty()
  buktiPembayaran: string;
}

export class paymentDto {
  @IsNotEmpty()
  paketsId: string;
  @IsNotEmpty()
  banksId: string;
  @IsNotEmpty()
  price: number;
  @IsNotEmpty()
  usersId: string;
  @IsNotEmpty()
  buktiPembayaran: string;
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
  province: string;

  @IsNotEmpty()
  city: string;

  @IsNotEmpty()
  district: string;

  @IsNotEmpty()
  sub_district: string;

  @IsNotEmpty()
  photo_ktp: string;

  @IsNotEmpty()
  payment: PaymentDto;
}
