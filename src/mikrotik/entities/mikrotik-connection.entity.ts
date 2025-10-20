// src/mikrotik/entities/mikrotik-connection.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('mikrotik_connections')
export class MikroTikConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // E.g., "Main Office", "Backup"

  @Column()
  host: string; // IP or hostname

  @Column()
  username: string;

  @Column()
  password: string; // Consider encrypting this

  @Column({ type: 'int', default: 80 }) // REST API port, often 80 or 443
  port: number;

  @Column({ default: true }) // Is this connection active?
  isActive: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}