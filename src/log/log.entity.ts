import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('logs')
export class Log {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb' }) // PostgreSQL
  data: any;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}