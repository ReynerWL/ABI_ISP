import { IsNotEmpty } from 'class-validator';

export class ForgetPasswordDto {
  @IsNotEmpty()
  token: string;

  @IsNotEmpty()
  new_password: string;
}
