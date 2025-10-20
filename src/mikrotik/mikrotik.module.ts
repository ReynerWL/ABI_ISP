// src/mikrotik/mikrotik.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikrotikService } from './mikrotik.service';
import { MikrotikController } from './mikrotik.controller';
import { MikroTikUser } from './entities/mikrotik-user.entity';
import { MikroTikConnection } from './entities/mikrotik-connection.entity';
import { User } from '#/user/entities/user.entity';
// Import User entity if needed for joins
// import { User } from '#/user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MikroTikUser, MikroTikConnection,User]),
  ],
  controllers: [MikrotikController],
  providers: [MikrotikService],
  exports: [MikrotikService], // Export if other modules need it
})
export class MikrotikModule {}