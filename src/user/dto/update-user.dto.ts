import { IsNotEmpty } from 'class-validator';

export class UpdateUserDto {
@IsNotEmpty()
  email: string;
  @IsNotEmpty()
  phone_number: string;
  @IsNotEmpty()
  name: string;
  @IsNotEmpty()
  password: string;
  @IsNotEmpty()
  alamat: string;
  @IsNotEmpty()
  photo_ktp: string;
}
