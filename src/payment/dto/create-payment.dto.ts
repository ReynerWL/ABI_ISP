import { IsNotEmpty } from 'class-validator';

export class CreatePaymentDto {
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
