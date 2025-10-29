import { IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @IsNotEmpty()
  paketId: string;
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

  @IsOptional()
  reason: string;
  
  @IsOptional()
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
}
