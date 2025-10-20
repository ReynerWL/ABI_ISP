import { IsNotEmpty } from 'class-validator';
import { User, UserStatus } from '../entities/user.entity';

export class UpdateUserDto {

  email: string;

  phone_number: string;

  name: string;

  password: string;

  alamat: string;

  photo_ktp: string;

  paketsId: string;

  bankId: string;

  status: UserStatus;

  ip_address: string;
}
