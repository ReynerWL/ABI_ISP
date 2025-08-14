import { Injectable } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment } from './entities/payment.entity';
import { DataSource } from 'typeorm';

@Injectable()
export class PaymentService {
  constructor(
    private dataSource: DataSource
  ) {}

  create(createPaymentDto: CreatePaymentDto) {
    return 'This action adds a new payment';
  }

  async createPayment(createPaymentDto: CreatePaymentDto) {
    // Logic to create a payment
    return `Payment created with details: ${JSON.stringify(createPaymentDto)}`;
  }

  async rejectPayment(paymentId: string, reason: string) {
    // Logic to reject a payment
     return await this.dataSource.manager.findOne(Payment, {
      where: { id: paymentId },
      relations: ['users'],
    });
  }

  async confirmPayment(paymentId: string) {
    // Logic to confirm a payment
    return await this.dataSource.manager.findOne(Payment, {
      where: { id: paymentId },
      relations: ['users'],
    });
  }

  findAll() {
    return `This action returns all payment`;
  }

  findOne(id: number) {
    return `This action returns a #${id} payment`;
  }

  update(id: number, updatePaymentDto: UpdatePaymentDto) {
    return `This action updates a #${id} payment`;
  }

  remove(id: number) {
    return `This action removes a #${id} payment`;
  }
}
