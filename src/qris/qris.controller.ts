// src/qris/qris.controller.ts
import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { QrisService } from './qris.service';

@Controller('api/qris')
export class QrisController {
  constructor(private readonly qrisService: QrisService) {}

  @Get('generate')
  async generateQris(
    @Query('package') packageName: string,
    @Query('amount') amountStr: string,
    @Query('orderId') orderId?: string,
  ) {
    const amount = parseInt(amountStr, 10);

    if (!packageName || isNaN(amount) || amount <= 0) {
      throw new HttpException(
        'Missing or invalid parameters: ?package=...&amount=...',
        HttpStatus.BAD_REQUEST,
      );
    }

    const id = orderId || `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    try {
      const result = await this.qrisService.createDynamicQris(packageName, amount, id);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'QRIS generation failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('test')
  testEnv() {
    return {
      duitkuMerchantCode: process.env.DUITKU_MERCHANT_CODE ? '✅ Set' : '❌ Not set',
      duitkuApiKey: process.env.DUITKU_API_KEY ? '✅ Set' : '❌ Not set',
      callbackUrl: process.env.QRIS_CALLBACK_URL,
      env: process.env.NODE_ENV,
    };
  }
}