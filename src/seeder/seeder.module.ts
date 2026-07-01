import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '#/user/entities/user.entity';
import { Role } from '#/role/entities/role.entity';
import { SeederService } from './seeder.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role])],
  providers: [SeederService],
  exports: [SeederService],
})
export class SeederModule {}
