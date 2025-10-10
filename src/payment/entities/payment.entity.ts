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
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  price: number;

  @Column({ type: 'text', nullable: true })
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';

  @Column({ type: 'text', nullable: true })
  buktiPembayaran: string; // URL or path to payment proof image

  @Column({ type: 'text', nullable: true, default: null})
  reason: string; // Reason for rejection if status is REJECTED

  @Column({ type: 'timestamp with time zone', nullable: true })
  start_date: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  due_date: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  confirmedAt: Date;

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
      return User;
    },
    (user) => {
      return user.payments;
    },
  )
  user?: User;

  @ManyToOne(
    () => {
      return Paket;
    },
    (paket) => {
      return paket.payments;
    },
  )
  paket?: Paket;

  @ManyToOne(
    () => {
      return Bank;
    },
    (bank) => {
      return bank.payments;
    },
  )
  bank?: Bank;
}
