// src/mikrotik-log/entities/mikrotik-log.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('mikrotik_logs')
export class MikrotikLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: 'BLOCK' | 'UNBLOCK' | 'VOUCHER_CREATE' | 'VOUCHER_USE';

  @Column()
  target: string; // username or voucher code

  @Column({ nullable: true })
  userId: number;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  adminNote: string;

  @CreateDateColumn()
  createdAt: Date;
}