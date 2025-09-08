// src/WA/wa.controller.ts
import { Controller, Get, Post, HttpCode } from '@nestjs/common';
import { WhatsAppService } from './bot/wa.service';

@Controller('api/wa')
export class WhatsAppController {
  constructor(private waService: WhatsAppService) {}

  @Get('qr')
  async getQR() {
    const qr = this.waService.getQrCode();

    if (!qr) {
      const status = this.waService.getStatus();
      if (status.connected) {
        return { connected: true, message: 'Bot is already connected' };
      } else {
        return { connected: false, message: 'Connecting...' };
      }
    }

    return { 
      connected: false, 
      qr: qr // data:image/png;base64,...
    };
  }

  @Get('status')
  getStatus() {
    return this.waService.getStatus();
  }

  @Post('logout')
  @HttpCode(200)
  async logout() {
    await this.waService.logout();
    return { message: 'Logged out. Scan QR to reconnect.' };
  }
}