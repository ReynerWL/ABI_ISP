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
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentService.create(createPaymentDto);
  }

  @Get()
  findAll(
    @Query('query') query?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.paymentService.findAll(
      query,
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
      message: "Success",
    }
  }

  @Put('/rejected/:id')
  async rejectPayment(@Param('id') id: string, @Body('reason') reason:string){
    return{
      data: await this.paymentService.rejectPayment(id, reason),
      statusCode: HttpStatus.OK,
      message: "Success"
    }
  }

  @Put('/confirmed/:id')
  async confirmPayment(@Param('id') id: string){
    return{
      data: await this.paymentService.confirmPayment(id),
      statusCode: HttpStatus.OK,
      message: "Success"
    }
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    return this.paymentService.update(id, updatePaymentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paymentService.remove(id);
  }
}
