import { IsNotEmpty } from 'class-validator';

export class CreateBankDto {
  @IsNotEmpty()
  bank_name: string;
  @IsNotEmpty()
  no_rekening: string;
  @IsNotEmpty()
  owner: string;
}
