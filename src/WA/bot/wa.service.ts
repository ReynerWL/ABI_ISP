// src/WA/bot/wa.service.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  Browsers,
} from '@whiskeysockets/baileys';
import { SessionService } from './session';
import { MenuHandlerService } from './menuHandler';
import { ReminderService } from './reminder';

@Injectable()
export class WhatsAppService {
  private client: any;
  private qrCode: string | null = null;
  private connected: boolean = false;
  private logger = new Logger('WhatsAppService');

  constructor(
    private sessionService: SessionService,
    private menuHandler: MenuHandlerService,
    private reminderService: ReminderService,
  ) {}

  async startBot() {
    // Load session
    const { state, saveState } = await this.sessionService.loadAuthState();
    const { version } = await fetchLatestBaileysVersion();

    this.client = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys),
      },
      version,
      browser: Browsers.appropriate('Chrome'), // Or Browsers.appropriate('Firefox'), etc.
      printQRInTerminal: false, // 👈 Disabled — we want web QR
    });

    // Save credentials when updated
    this.client.ev.on('creds.update', saveState);

    // Handle connection events
    this.client.ev.on('connection.update', async (update) => {
      const { qr, connection, lastDisconnect } = update;

      if (qr) {
        // Generate QR code as data URL
        const qrcode = await import('qrcode');
        this.qrCode = await qrcode.toDataURL(qr);
        this.connected = false;
        this.logger.log('QR code generated for web');
      }

      if (connection === 'open') {
        this.qrCode = null;
        this.connected = true;
        this.logger.log('✅ Connected to WhatsApp');
      }

      if (connection === 'close') {
        this.connected = false;
        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !==
          DisconnectReason.loggedOut;

        this.logger.warn(`Connection closed. Reconnecting: ${shouldReconnect}`);

        if (shouldReconnect) {
          await this.startBot();
        } else {
          this.logger.warn('Bot logged out. Please scan QR again.');
        }
      }
    });

    // Handle incoming messages
    this.client.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      if (!msg.key.fromMe && msg.message) {
        const customerNumber = msg.key.remoteJid;
        await this.menuHandler.handleMessage(this.client, customerNumber, msg);
      }
    });

    // Start schedulers
    this.reminderService.startSchedulers(this.client);
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
      qr: !!this.qrCode,
      qrCode: this.qrCode, // Optional: include QR in status
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
        this.logger.log('Logged out from WhatsApp');
      } catch (error) {
        this.logger.error('Error during logout', error);
      }
    }
    this.qrCode = null;
    this.connected = false;

    // Clear session file
    await this.sessionService.clearAuthState();
  }
}
