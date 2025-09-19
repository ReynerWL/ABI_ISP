import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePaymentDto {
  // @IsNotEmpty()
  // email: string;
  // @IsNotEmpty()
  // phone_number: string;
  // @IsNotEmpty()
  // name: string;
  // @IsNotEmpty()
  // birth_date: Date;
  // @IsNotEmpty()
  // province: string;
  // @IsNotEmpty()
  // city: string;
  // @IsNotEmpty()
  // district: string;
  // @IsNotEmpty()
  // photo_ktp: string;
  @IsNotEmpty()
  paketsId: string;
  @IsNotEmpty()
  banksId: string;
  @IsNotEmpty()
  price: string;
  @IsNotEmpty()
  usersId: string;


  buktiPembayaran:string;
  reason: string;
  status: string;
}
