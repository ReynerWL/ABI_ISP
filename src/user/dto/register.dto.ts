import { isNotEmpty, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  password: string;

  @IsNotEmpty()
  phone_number: string;

  @IsNotEmpty()
  alamat: string;

  @IsNotEmpty()
  photo_ktp: string;
}
