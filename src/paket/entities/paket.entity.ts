import { Payment } from '#/payment/entities/payment.entity';
import { Report } from '#/report/entities/report.entity';
import { Subscription } from '#/subscription/entities/subscription.entity';
import { User } from '#/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Paket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  price: string;

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
      return User;
    },
    (user) => {
      return user.paket;
    },
  )
  users?: User[];

  @OneToMany(
    () => {
      return Payment;
    },
    (payment) => {
      return payment.pakets;
    },
  )
  payments?: Payment[];

  @ManyToOne(
    () => {
      return Subscription;
    },
    (subscription) => {
      return subscription.pakets;
    },
  )
  subscriptions?: Subscription;

  @OneToMany(
    () => {
      return Report;
    },
    (report) => {
      return report.paket;
    },
  )
  reports?: Report[];
}
