import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  import { User } from './user.entity';
  
  @Entity('password_reset_token')
  export class PasswordResetToken {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column()
    email: string;
  
    @Column()
    token: string;
  
    @Column()
    status: 'active' | 'inactive';
  
    @Column({ type: 'timestamp' })
    expired_date: Date;
  
    @ManyToOne(() => User, (user) => user.id, { onDelete: 'CASCADE' })
    user: User;
  
    @CreateDateColumn({
      type: 'timestamp with time zone',
    })
    createdAt: Date;
  
    @UpdateDateColumn({
      type: 'timestamp with time zone',
    })
    updatedAt: Date;
  }
  