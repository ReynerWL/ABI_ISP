import { Paket } from '#/paket/entities/paket.entity';
import { Payment } from '#/payment/entities/payment.entity';
import { Report } from '#/report/entities/report.entity';
import { Role } from '#/role/entities/role.entity';
import { Subscription } from '#/subscription/entities/subscription.entity';
import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PasswordResetToken } from './passwordresettoken';

export enum UserStatus {
  AKTIF = 'Aktif',
  NONAKTIF = 'Nonaktif',
  BARU = 'Baru',
  PENDING = 'Pending',
  DITOLAK = 'Ditolak',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  customerId: string;

  @Column({ nullable: true })
  email: string;

  @Column({
    nullable: true,
  })
  name: string;

  @Column({ nullable: true })
  phone_number: string;

  @Column({
    nullable: true,
  })
  birth_date: string;

  @Column({ select: false })
  @Exclude()
  password: string;

  @Column({ select: false })
  @Exclude()
  salt: string;

  @Column({
    nullable: true,
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @Column({
    type: 'text',
    nullable: true,
  })
  alamat: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  provinsi: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  kota: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  kecamatan: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  kelurahan: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  photo_ktp: string;

  @Column({
    nullable: true,
    default: false,
  })
  priority: boolean;

  @CreateDateColumn({
    type: 'timestamp with time zone',
    nullable: false,
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp with time zone',
    nullable: false,
  })
  updatedAt: Date;

  @DeleteDateColumn({
    type: 'timestamp with time zone',
    nullable: true,
  })
  deletedAt: Date | null;

  @ManyToOne(
    () => {
      return Role;
    },
    (role) => {
      return role.users;
    },
  )
  role: Role;

  @ManyToOne(
    () => {
      return Paket;
    },
    (paket) => {
      return paket.users;
    },
  )
  paket: Paket;

  @OneToMany(
    () => {
      return Payment;
    },
    (payment) => {
      return payment.user;
    },
  )
  payments: Payment[];

  @OneToOne(() => {
    return Subscription;
  })
  subscription: Subscription;

  @OneToMany(
    () => {
      return Report;
    },
    (report) => {
      return report.customer;
    },
  )
  reportCustomer?: Report[];

  @OneToMany(
    () => {
      return Report;
    },
    (report) => {
      return report.petugas;
    },
  )
  reportPetugas?: Report[];

  @OneToMany(() => PasswordResetToken, (token) => token.user)
  resetTokens: PasswordResetToken[];
}
