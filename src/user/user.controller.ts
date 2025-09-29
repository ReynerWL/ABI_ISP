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
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ExtendedRequest } from '#/core/request';
import { RegisterDto } from './dto/register.dto';
import { Public } from '#/auth/public.decorator';
import { PaginationDto } from '#/utils/pagination.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return {
      data: await this.userService.create(createUserDto),
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
    @Query('query') query: string,
    @Query('status') status: string,
    @Query('start_date') start_date: string,
    @Query('end_date') end_date: string,
    @Query() paginationDto: PaginationDto,
  ) {
    const data = await this.userService.findAll(
      query,
      start_date,
      end_date,
      status,
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
  ) {
    return {
      data: await this.userService.update(id, updateUserDto),
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
