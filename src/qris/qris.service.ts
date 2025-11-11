// src/qris/qris.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as QRCode from 'qrcode';

export interface QrisPaymentData {
  success: boolean;
  orderId: string;
  amount: number;
  qrCodeImage: string; // Base64 image
  expiresAt: Date;
  paymentUrl?: string;
}

@Injectable()
export class QrisService {
  private merchantCode = process.env.DUITKU_MERCHANT_CODE;
  private apiKey = process.env.DUITKU_API_KEY;
  private apiUrl = 'https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry';

  async createDynamicQris(
    packageName: string,
    amount: number,
    orderId: string,
  ): Promise<QrisPaymentData> {
    const signature = this.generateSignature(orderId, amount);

    const payload = {
      paymentAmount: amount,
      paymentMethod: '08', // QRIS
      merchantCode: this.merchantCode,
      productDetail: `Internet Package: ${packageName}`,
      merchantOrderId: orderId,
      customerVaName: 'Pelanggan ISP',
      callbackUrl:
        process.env.QRIS_CALLBACK_URL ||
        'http://localhost:3000/api/qris/callback',
      returnUrl:
        process.env.QRIS_RETURN_URL || 'http://localhost:3000/payment/success',
      signature,
    };

    try {
      const response = await axios.post(this.apiUrl, payload);
      const { qrString, reference } = response.data;

      // Convert QR string to base64 image
      const qrCodeImage = await QRCode.toDataURL(qrString);

      return {
        success: true,
        orderId: reference,
        amount,
        qrCodeImage,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        paymentUrl: qrString,
      };
    } catch (error) {
      console.error('QRIS API Error:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || 'Failed to generate QRIS code',
      );
    }
  }

  private generateSignature(orderId: string, amount: number): string {
    const data = `${this.merchantCode}${orderId}${amount}${this.apiKey}`;
    return require('crypto').createHash('sha256').update(data).digest('hex');
  }
}
