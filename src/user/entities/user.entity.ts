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
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PasswordResetToken } from './passwordresettoken';
import { sub } from 'date-fns';
import { MikroTikUser } from '#/mikrotik/entities/mikrotik-user.entity';

export enum UserStatus {
  AKTIF = 'Aktif',
  NONAKTIF = 'Nonaktif',
  BARU = 'Baru',
  PENDING = 'Pra-Aktif',
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
    default: UserStatus.BARU,
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

  @Column({ nullable: true, unique: true })
  ip_address: string;

  @Column({ nullable: true, type: 'timestamp with time zone' })
  last_login: Date;

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

  @OneToOne(() => Subscription, subscription => subscription.user, {
    eager: true, // Optional: auto-load subscription with user
    cascade: true, // Optional: save/update subscription when saving user
  })
  @JoinColumn({ name: 'subscription_id' }) // This creates the FK column in `users`
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

  @Column({ nullable: true })
  reset_token: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  reset_token_expired: Date;

  @OneToMany(() => PasswordResetToken, (token) => token.user)
  resetTokens: PasswordResetToken[];

  @OneToOne(() => MikroTikUser, (mikrotikUser) => mikrotikUser.user)
  mikrotikUser: MikroTikUser;
}
