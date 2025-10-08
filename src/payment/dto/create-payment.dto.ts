import { IsNotEmpty } from 'class-validator';

export class CreatePaymentDto {
  @IsNotEmpty()
  paketsId: string;
  @IsNotEmpty()
  banksId: string;
  @IsNotEmpty()
  price: number;
  @IsNotEmpty()
  usersId: string;
  @IsNotEmpty()
  start_date: Date;
  @IsNotEmpty()
  due_date: Date;
  @IsNotEmpty()
  buktiPembayaran: string;

  reason: string;
  
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
}
