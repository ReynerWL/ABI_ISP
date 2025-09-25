import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async findAll(@Query('this_year') this_year?: string) {
    const thisYear = this_year === 'false' ? false : true;
    // const data =  await this.dashboardService.listDashboard(thisYear)
    return {
      data: await this.dashboardService.listDashboard(thisYear),
      statusCode: HttpStatus.OK,
      message: 'Success',
    };
  }
}
