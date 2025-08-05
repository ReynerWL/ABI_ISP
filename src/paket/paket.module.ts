import { Module } from '@nestjs/common';
import { PaketService } from './paket.service';
import { PaketController } from './paket.controller';

@Module({
  controllers: [PaketController],
  providers: [PaketService],
})
export class PaketModule {}
