import { Payment } from '#/payment/entities/payment.entity';
import { Subscription } from '#/subscription/entities/subscription.entity';
import { User } from '#/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Bank {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  bank_name: string;

  @Column({ type: 'text', nullable: true })
  no_rekening: string;

  @Column({ type: 'text', nullable: true })
  owner: string;

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

  @OneToMany(
    () => {
      return Payment;
    },
    (payment) => {
      return payment.banks;
    },
  )
  payments?: Payment[];

  @OneToMany(
    () => {
      return Subscription;
    },
    (subscription) => {
      return subscription.banks;
    },
  )
  subscriptions?: Subscription[];
}
