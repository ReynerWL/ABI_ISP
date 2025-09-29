import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserStatus } from '../entities/user.entity';

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
  @IsEnum(UserStatus)
  status: UserStatus;

  @IsNotEmpty()
  role: string;

  @IsNotEmpty()
  priority: boolean;
}
