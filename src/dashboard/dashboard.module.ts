import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { UserModule } from '#/user/user.module';

@Module({
  imports: [UserModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
