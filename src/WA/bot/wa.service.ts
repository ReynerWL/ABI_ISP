// src/WA/bot/wa.service.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
} from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode';
import { SessionService } from './session.service';
import { MenuHandlerService } from './menuHandler';
import { ReminderService } from './reminder';
@Injectable()
export class WhatsAppService {
  private client: any;
  private qrCode: string | null = null;
  private connected: boolean = false;
  private reconnecting = false;
  private logger = new Logger('WhatsAppService');

  constructor(
    private sessionService: SessionService,
    private menuHandler: MenuHandlerService, // ✅ Only for sending notifications
    private reminderService: ReminderService, // ✅ For cron jobs
  ) {}

  async startBot() {
    try {
      this.logger.log('🚀 Initiating WhatsApp bot startup...');
      this.qrCode = null;
      this.connected = false;

      // Cleanup old client if exists
      if (this.client) {
        try {
          await this.client.logout?.();
        } catch (err) {
          this.logger.warn('⚠️ Error during old client logout', err?.message);
        }
        this.client = null;
      }

      const { state, saveState } = await this.sessionService.loadAuthState();
      const { version } = await fetchLatestBaileysVersion();

      this.client = makeWASocket({
        auth: state,
        version,
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: false,
      });

      this.client.ev.on('creds.update', saveState);

      this.client.ev.on('connection.update', async (update) => {
        const { qr, connection, lastDisconnect } = update;

        if (qr) {
          this.logger.log('📱 QR code received.');
          try {
            this.qrCode = await qrcode.toDataURL(qr);
            this.connected = false;
            this.logger.log('✅ QR code generated.');
          } catch (err) {
            this.logger.error('❌ QR generation failed', err);
            this.qrCode = null;
          }
        }

        if (connection === 'open') {
          this.logger.log('✅ Connected to WhatsApp!');
          this.qrCode = null;
          this.connected = true;
          // ✅ Start reminder schedulers after connection opens
          this.reminderService.startSchedulers(this.client);
        }

        if (connection === 'close') {
          this.logger.warn('⚠️ Connection closed.');
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.logger.log(`🔁 Reconnecting: ${shouldReconnect} (Code: ${statusCode})`);

          if (shouldReconnect && !this.reconnecting) {
            this.reconnecting = true;
            setTimeout(async () => {
              try {
                await this.startBot();
              } catch (err) {
                this.logger.error('Reconnection failed:', err);
              } finally {
                this.reconnecting = false;
              }
            }, 5000);
          } else {
            this.logger.warn('🛑 Logged out. QR will be available on next start.');
            this.qrCode = null;
            this.connected = false;
          }
        }
      });

      // ❌ REMOVED: No more incoming message handler
      // this.client.ev.on('messages.upsert', ...)

    } catch (error) {
      this.logger.error('💥 Bot startup failed', error.stack);
      this.qrCode = null;
      this.connected = false;
      this.client = null;
    }
  }

  getQrCode(): string | null {
    return this.qrCode;
  }

  getStatus() {
    return {
      connected: this.connected,
      hasQrCode: !!this.qrCode,
      qrCode: this.qrCode,
    };
  }

  getClient() {
    return this.client;
  }

  async logout() {
    this.logger.log('🚪 Logging out...');
    if (this.client) {
      try {
        await this.client.logout();
        this.logger.log('✅ Logout command sent.');
      } catch (err) {
        this.logger.warn('⚠️ Error during logout', err?.message);
      }
      this.client = null;
    }

    this.qrCode = null;
    this.connected = false;
    this.reconnecting = false;

    await this.sessionService.clearAuthState();
    this.logger.log('✅ Logout completed.');
  }
}