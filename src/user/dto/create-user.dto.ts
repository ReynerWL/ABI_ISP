import { isNotEmpty, IsNotEmpty } from 'class-validator';

export class CreateUserDto {
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

  @IsNotEmpty()
  status: 'ACTIVE'|'INACTIVE'|'PENDING'|'BANNED'|'NEW';

  @IsNotEmpty()
  role: string;

  @IsNotEmpty()
  priority: boolean;
}
