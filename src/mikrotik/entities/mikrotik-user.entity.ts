// src/mikrotik/entities/mikrotik-user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from '#/user/entities/user.entity'; // Adjust path

@Entity('mikrotik_users')
export class MikroTikUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' }) // Cascade delete if main user is deleted
  @JoinColumn({ name: 'user_id' })
  user: User;
  
  @Column({ unique: true, name: 'user_id' }) // Link to your main User entity
  userId: string;
  
  @Column({ name: 'mikrotik_username', unique: true }) // Username on MikroTik
  mikrotikUsername: string;

  @Column({ name: 'ip_address' }) // IP Address assigned to the user
  ipAddress: string;

  @Column({ default: true }) // Is the user currently allowed internet access?
  isEnabled: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}