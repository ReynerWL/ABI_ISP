import { Module } from '@nestjs/common';
import { PaketService } from './paket.service';
import { PaketController } from './paket.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Paket } from './entities/paket.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Paket])],
  controllers: [PaketController],
  providers: [PaketService],
})
export class PaketModule {}
