// src/WA/bot/wa.service.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
} from '@whiskeysockets/baileys';

import { SessionService } from './session.service';
import { MenuHandlerService } from './menuHandler';
import { ReminderService } from './reminder';

@Injectable()
export class WhatsAppService {
  private client: any;
  private qrCode: string | null = null;
  private connected: boolean = false;
  private reconnecting = false; // Prevent flood
  private logger = new Logger('WhatsAppService');
  private qrCodeRaw: string | null = null;

  constructor(
    private sessionService: SessionService,
    private menuHandler: MenuHandlerService,
    private reminderService: ReminderService,
  ) {}

  /**
   * Start the WhatsApp bot
   */
  async startBot() {
    try {
      const { state, saveState } = await this.sessionService.loadAuthState();
      const { version } = await fetchLatestBaileysVersion();

      this.client = makeWASocket({
        auth: state, // ✅ useMultiFileAuthState returns full state
        version,
        browser: Browsers.ubuntu('EDGE'), // ✅ Correct usage
        printQRInTerminal: false,
      });

      // Save credentials when updated
      this.client.ev.on('creds.update', saveState);

      // Handle connection events
      this.client.ev.on('connection.update', async (update) => {
        const { qr, connection, lastDisconnect } = update;

        if (qr) {
          try {
            const qrcode = await require('qrcode');
            this.qrCode = await qrcode.toDataURL(qr); // For image
            this.qrCodeRaw = qr; // Save raw string for ASCII
            this.connected = false;
            this.logger.log('📱 QR code generated for web');
          } catch (err) {
            this.logger.error('Failed to generate QR code', err);
          }
        }

        if (connection === 'open') {
          this.qrCode = null;
          this.connected = true;
          this.logger.log('✅ Connected to WhatsApp!');
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.logger.warn(
            `🔁 Connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`,
          );

          if (shouldReconnect && !this.reconnecting) {
            this.reconnecting = true;
            setTimeout(() => {
              this.startBot();
              this.reconnecting = false;
            }, 3000);
          } else {
            this.logger.warn('🛑 Bot logged out. Please scan QR again.');
            this.qrCode = null;
            this.connected = false;
          }
        }
      });

      // Handle incoming messages
      this.client.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.key.fromMe && msg.message) {
          const customerNumber = msg.key.remoteJid;
          await this.menuHandler.handleMessage(
            this.client,
            customerNumber,
            msg,
          );
        }
      });

      // Start scheduled jobs (reminders)
      this.reminderService.startSchedulers(this.client);
    } catch (error) {
      this.logger.error('Failed to start WhatsApp bot', error.stack);
    }
  }

  /**
   * Get QR code as data URL (for API)
   */
  getQrCode(): string | null {
    return this.qrCode;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.connected,
      qr: !!this.qrCodeRaw,
      qrCode: this.qrCode, // Base64 image (optional)
      qrCodeAscii: this.qrCodeRaw ? this.getQrCodeAscii() : null,
    };
  }
  /**
   * Get WA client instance
   */
  getClient() {
    return this.client;
  }

  /**
   * Logout and clear session
   */
  async logout() {
    if (this.client) {
      try {
        await this.client.logout();
        this.logger.log('📲 Logged out from WhatsApp');
      } catch (error) {
        this.logger.error('Error during logout', error);
      }
    }

    this.qrCode = null;
    this.connected = false;
    this.reconnecting = false;

    // Clear session files
    await this.sessionService.clearAuthState();
  }

  async getQrCodeAscii(): Promise<string | null> {
    if (!this.qrCodeRaw) return null;

    try {
      const qrcode = require('qrcode');
      const ascii = await qrcode.toString(this.qrCodeRaw, {
        type: 'terminal',
        small: true,
      });
      return ascii;
    } catch (error) {
      this.logger.error('Failed to generate QR ASCII', error);
      return null;
    }
  }
}
