import { IsNotEmpty } from "class-validator";

export class CreatePaketDto {
  @IsNotEmpty()
  name: string;
  @IsNotEmpty()
  price: string;
  @IsNotEmpty()
  speed: string;
}
