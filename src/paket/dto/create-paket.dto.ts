import { IsNotEmpty } from 'class-validator';

export class CreatePaketDto {
  @IsNotEmpty()
  name: string;
  @IsNotEmpty()
  price: number;
  @IsNotEmpty()
  speed: string;
}
