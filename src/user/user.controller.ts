import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpStatus,
  Query,
  Request,
  ParseUUIDPipe,
  Put,
  UseGuards,
  Res,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateAdminDto, CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ExtendedRequest } from '#/core/request';
import { RegisterDto } from './dto/register.dto';
import { Public } from '#/auth/public.decorator';
import { PaginationDto } from '#/utils/pagination.dto';
import { RolesGuard } from '#/core/roles.guard';
import { SkipLogging } from '#/logging/skip-logging.decorator';
import { Response } from 'express';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @UseGuards(RolesGuard)
  async create(@Body() createUserDto: CreateUserDto) {
    return {
      data: await this.userService.create(createUserDto),
      statusCode: HttpStatus.CREATED,
      message: 'success',
    };
  }

  @Post('create-admin')
  @UseGuards(RolesGuard)
  async createAdmin(
    @Body() createUserDto: CreateAdminDto,
    @Request() req: ExtendedRequest,
  ) {
    return {
      data: await this.userService.createAdmin(createUserDto, req.user.role),
      statusCode: HttpStatus.CREATED,
      message: 'success',
    };
  }

  @Public()
  @Post('register')
  async regiter(@Body() registerDto: RegisterDto) {
    return {
      data: await this.userService.register(registerDto),
      statusCode: HttpStatus.CREATED,
      message: 'success',
    };
  }

  @Get()
  @SkipLogging()
  async findAll(
    @Request() req: ExtendedRequest,
    @Query('search') search: string,
    @Query('status') status: string,
    @Query('paket_speed') paket_speed: string,
    @Query('paket') paket: string,
    @Query('role') role: string,
    @Query('created_at') created_at: string,
    @Query('start_date') start_date: string,
    @Query('end_date') end_date: string,
    @Query() paginationDto: PaginationDto,
  ) {
    const data = await this.userService.findAll(
      search,
      status,
      paket_speed,
      paket,
      role,
      created_at,
      start_date,
      end_date,
      paginationDto,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'success',
      ...data,
    };
  }

  @Get('export')
  @SkipLogging()
  async exportUsers(
    @Query('paket_id') paket_id?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res() res?: Response,
  ) {
    const file = await this.userService.exportUsersToExcel(
      paket_id,
      status,
      startDate,
      endDate,
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="export_users.xlsx"',
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.send(file);
  }

  @Get('detail')
  @SkipLogging()
  async findOneByUser(@Request() req: ExtendedRequest) {
    return {
      data: await this.userService.findOneByUser(req.user.id),
      statusCode: HttpStatus.OK,
      message: 'success',
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return {
      data: await this.userService.findOne(id),
      statusCode: HttpStatus.OK,
      message: 'success',
    };
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: ExtendedRequest,
  ) {
    return {
      data: await this.userService.update(id, updateUserDto, req.user.role),
      statusCode: HttpStatus.OK,
      message: 'success',
    };
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExtendedRequest,
  ) {
    return {
      data: await this.userService.updateStatus(id, req.user.role),
      statusCode: HttpStatus.OK,
      message: 'success',
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: ExtendedRequest) {
    return {
      data: await this.userService.remove(id, req.user.role),
      statusCode: HttpStatus.OK,
    };
  }
}
