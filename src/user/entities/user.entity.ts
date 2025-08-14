import { Paket } from '#/paket/entities/paket.entity';
import { Payment } from '#/payment/entities/payment.entity';
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

  @Exclude()
  @Column()
  password: string;

  @Exclude()
  @Column()
  salt: string;

  @Column({
    nullable: true,
    default: 'PENDING',
  })
  status: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  alamat: string;

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
      return payment.users;
    },
  )
  payments: Payment[];

  @OneToOne(() => {
    return Subscription;
  })
  subscription: Subscription;
}
