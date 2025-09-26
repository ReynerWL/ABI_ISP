import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendTokenDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
