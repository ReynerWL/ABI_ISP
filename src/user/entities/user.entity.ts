import { Role } from '#/role/entities/role.entity';
import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
}
