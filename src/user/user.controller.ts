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
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ExtendedRequest } from '#/core/request';
import { RegisterDto } from './dto/register.dto';
import { Public } from '#/auth/public.decorator';
import { PaginationDto } from '#/utils/pagination.dto';
import { RolesGuard } from '#/core/roles.guard';

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
  async createAdmin(@Body() createUserDto: CreateUserDto, @Request() req: ExtendedRequest) {
    return {
      data: await this.userService.createAdmin(createUserDto, req.user.roles),
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
  async findAll(
    @Request() req: ExtendedRequest,
    @Query('search') search: string,
    @Query('status') status: string,
    @Query('paket') paket: string[],
    @Query('sort_paket') sort_paket: string,
    @Query('start_date') start_date: string,
    @Query('end_date') end_date: string,
    @Query() paginationDto: PaginationDto,
  ) {
    const data = await this.userService.findAll(
      search,
      status,
      paket,
      sort_paket,
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

  @Get('detail')
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
      data: await this.userService.update(id, updateUserDto, req.user.roles),
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
      data: await this.userService.updateStatus(id,req.user.roles),
      statusCode: HttpStatus.OK,
      message: 'success',
    };
  }


  @Delete(':id')
  async remove(@Param('id') id: string) {
    return {
      data: await this.userService.remove(id),
      statusCode: HttpStatus.OK,
    };
  }
}
