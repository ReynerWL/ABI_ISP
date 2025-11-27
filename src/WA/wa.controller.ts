// src/WA/wa.controller.ts
import { Controller, Get, Post, HttpCode, Body, Query, BadRequestException } from '@nestjs/common';
import { WhatsAppService } from './bot/wa.service';
import { Public } from '#/auth/public.decorator';
import { SkipLogging } from '#/logging/skip-logging.decorator';

@Controller('wa')
export class WhatsAppController {
  constructor(private waService: WhatsAppService) {}

  @Public()
  @Get('qr')
  @SkipLogging()
  getQrCode() {
    const dataUrl = this.waService.getQrCode();
    if (dataUrl) return { qrCodeDataUrl: dataUrl };
    return { qrCodeDataUrl: null, message: 'No QR available (maybe connected already).' };
  }

  @Public()
  @Get('status')
  @SkipLogging()
  getStatus() {
    return this.waService.getStatus();
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout() {
    await this.waService.logout();
    return { message: 'Logged out and session cleared.' };
  }

  // @Public()
  // @Post('restart')
  // @HttpCode(200)
  // async restart() {
  //   await this.waService.restart();
  //   return { message: 'Restart initiated.' };
  // }

  // example endpoint to send message via bot
  @Public()
  @Post('send')
  @HttpCode(200)
  async send(@Body() body: { to: string; message: string }) {
    const { to, message } = body;
    if (!to || !message) throw new BadRequestException('to and message required');
    await this.waService.sendMessage(to, message);
    return { success: true };
  }
}
