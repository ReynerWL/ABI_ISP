// src/log/log.module.ts
import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogService } from './log.service';
import { Log } from './log.entity';

@Global() // Make it global so other modules can inject LogService without importing
@Module({
  imports: [
    TypeOrmModule.forFeature([Log]), // Register Log entity
  ],
  providers: [LogService], // Provide LogService
  exports: [LogService],   // Export so other modules can inject it
})
export class LogModule {}