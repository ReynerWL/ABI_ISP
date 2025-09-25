import { IsNotEmpty } from 'class-validator';

export class ValidatePasswordTokenDto {
  @IsNotEmpty()
  token: string;
}
