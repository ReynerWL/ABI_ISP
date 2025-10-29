import { IsNotEmpty, IsOptional } from 'class-validator';
import { User, UserStatus } from '../entities/user.entity';

export class UpdateUserDto {

  @IsOptional()
  email: string;

  @IsOptional()
  phone_number: string;

  @IsOptional()
  name: string;

  @IsOptional()
  password: string;

  @IsOptional()
  alamat: string;

  @IsOptional()
  photo_ktp: string;

  @IsOptional()
  paketsId: string;

  @IsOptional()
  bankId: string;

  @IsOptional()
  status: UserStatus;

  @IsOptional()
  ip_address: string;
}
