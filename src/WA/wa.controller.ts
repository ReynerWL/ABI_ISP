// src/WA/wa.controller.ts
import { Controller, Get, Post, HttpCode, Query } from '@nestjs/common';
import { WhatsAppService } from './bot/wa.service';
import { Public } from '#/auth/public.decorator';

@Controller('wa')
export class WhatsAppController {
  constructor(private waService: WhatsAppService) {}

  @Public()
@Get('qr')
getQrCode() {
  const base64DataUrl = this.waService.getQrCode();
  if (base64DataUrl) {
     return { qrCodeDataUrl: base64DataUrl }; // e.g., { qrCodeDataUrl: "data:image/png;base64,iVBOR..." }
  } else {
     return { message: 'No QR code available. Bot might be connected or disconnected.' };
  }
}

  @Public()
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


  private normalizePhone(phone: string): string | null {
    const cleaned = phone?.replace(/\D/g, '');
    // Basic validation: at least 8 digits, starts with valid country code
    if (!cleaned || cleaned.length < 8) return null;
    return cleaned;
  }
}
