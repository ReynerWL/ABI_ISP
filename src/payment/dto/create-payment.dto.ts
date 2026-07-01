import { IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @IsNotEmpty()
  paketId: string;
  @IsOptional()
  banksId?: string;
  @IsNotEmpty()
  price: number;
  @IsNotEmpty()
  usersId: string;
  @IsOptional()
  start_date: Date;
  @IsOptional()
  due_date: Date;
  @IsNotEmpty()
  buktiPembayaran: string;

  @IsOptional()
  reason: string;
  
  @IsOptional()
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
}
