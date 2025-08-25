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

  @Column()
  price: string;

  @Column({ type: 'text', nullable: true })
  status: string; // PENDING, CONFIRMED, REJECTED

  @Column({ type: 'text', nullable: true })
  buktiPembayaran: string; // URL or path to payment proof image

  @Column({ type: 'text', nullable: true })
  reason: string; // Reason for rejection if status is REJECTED

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
  pakets?: Paket;

  @ManyToOne(
    () => {
      return Bank;
    },
    (bank) => {
      return bank.payments;
    },
  )
  banks?: Bank;
}
