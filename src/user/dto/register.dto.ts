import { isNotEmpty, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  email: string;
  @IsNotEmpty()
  phone_number: string;
  @IsNotEmpty()
  name: string;
  @IsNotEmpty()
  birth_date: Date;
  @IsNotEmpty()
  password: string;
  @IsNotEmpty()
  alamat: string;
  @IsNotEmpty()
  province: string;
  @IsNotEmpty()
  city: string;
  @IsNotEmpty()
  district: string;
  @IsNotEmpty()
  photo_ktp: string;
}
