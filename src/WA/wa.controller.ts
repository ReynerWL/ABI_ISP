// src/WA/wa.controller.ts
import { Controller, Get, Post, HttpCode, Query } from '@nestjs/common';
import { WhatsAppService } from './bot/wa.service';
import { Public } from '#/auth/public.decorator';

@Controller('wa')
export class WhatsAppController {
  constructor(private waService: WhatsAppService) {}

  @Public()
  @Get('qr')
  async getQR() {
    const status = this.waService.getStatus();
    const qrCodeAscii = await this.waService.getQrCodeAscii();
    console.log(qrCodeAscii);

    return {
      connected: status.connected,
      qr: status.qr, // Will be string or null
      qrCode: status.qrCode, // Base64 image (optional)
    };
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

  @Public()
  @Get('test-message')
  @HttpCode(200)
  async sendTestMessage(
    @Query('to') to: string,
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      // Normalize phone number
      const phoneNumber = this.normalizePhone(to);
      if (!phoneNumber) {
        return {
          success: false,
          error:
            'Invalid phone number format. Use international format (e.g., 6281234567890)',
        };
      }

      const fullJid = `${phoneNumber}@c.us`;

      // Get WhatsApp client
      const client = this.waService.getClient();
      if (!client) {
        return {
          success: false,
          error: 'WhatsApp bot is not connected',
        };
      }

      await client.sendMessage(fullJid, {
        text: 'What would you like to do?',
        footer: 'Tap to select',
        title: 'Main Menu',
        buttonText: 'Open Menu',
        sections: [
          {
            rows: [
              { title: '📊 Check Usage', rowId: 'usage' },
              { title: '🛒 Buy Package', rowId: 'buy' },
              { title: '📞 Contact Support', rowId: 'support' },
            ],
          },
        ],
        listType: 1,
      });
      return {
        success: true,
        message: `Test message sent to ${fullJid}`,
      };
    } catch (error) {
      console.error('Failed to send test message:', error);
      return {
        success: false,
        error: 'Failed to send message: ' + error.message,
      };
    }
  }

  private normalizePhone(phone: string): string | null {
    const cleaned = phone?.replace(/\D/g, '');
    // Basic validation: at least 8 digits, starts with valid country code
    if (!cleaned || cleaned.length < 8) return null;
    return cleaned;
  }
}
