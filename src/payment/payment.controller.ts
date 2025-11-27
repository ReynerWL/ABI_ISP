import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Put,
  HttpStatus,
  Request,
  DefaultValuePipe,
  ParseIntPipe,
  HttpException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { ExtendedRequest } from '#/core/request';
import { SkipLogging } from '#/logging/skip-logging.decorator';
import { isUUID } from 'class-validator';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentService.create(createPaymentDto);
  }

  // src/payment/payment.controller.ts
  @Get()
  @SkipLogging()
  async findAll(
    @Query('query') query?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('month') month?: string,
    @Query('bank') bank?: string,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    return this.paymentService.findAll(
      query,
      startDate,
      endDate,
      month,
      bank,
      status,
      page,
      limit,
    );
  }

  @Get('user')
  @SkipLogging()
  findAllByUser(
    @Request() req: ExtendedRequest,
    @Query('query') query?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.paymentService.findAllByUser(
      req.user.id,
      query,
      status,
      startDate,
      endDate,
      Number(page),
      Number(limit),
    );
  }

  @Get(':id')
  async findOnePayment(@Param('id') id: string) {
    return {
      data: await this.paymentService.findOne(id),
      statusCode: HttpStatus.OK,
      message: 'Success',
    };
  }

  @Put('/rejected/:id')
  async rejectPayment(@Param('id') id: string, @Body('reason') reason: string) {
    return {
      data: await this.paymentService.rejectPayment(id, reason),
      statusCode: HttpStatus.OK,
      message: 'Success',
    };
  }

  @Put('/confirmed/:id')
  async confirmPayment(@Param('id') id: string) {
    if (id == null || !isUUID(id)){
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Payment not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      data: await this.paymentService.confirmPayment(id),
      statusCode: HttpStatus.OK,
      message: 'Success',
    };
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    return this.paymentService.update(id, updatePaymentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paymentService.remove(id);
  }
}
