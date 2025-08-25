import { Bank } from '#/bank/entities/bank.entity';
import { Paket } from '#/paket/entities/paket.entity';
import { User } from '#/user/entities/user.entity';
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

@Entity()
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'time with time zone', nullable: true })
  due_date: Date;

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

  @OneToOne(
    () => {
      return User;
    },
    (user) => {
      return user.subscription;
    },
  )
  user: User;

  @OneToMany(
    () => {
      return Paket;
    },
    (paket) => {
      return paket.subscriptions;
    },
  )
  pakets?: Paket[];

  @ManyToOne(
    () => {
      return Bank;
    },
    (bank) => {
      return bank.subscriptions;
    },
  )
  banks?: Bank;
}
