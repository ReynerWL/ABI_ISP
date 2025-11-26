// src/WA/bot/wa.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import * as path from 'path';
import { SessionService } from './session.service';
import { MenuHandlerService } from './menuHandler';
import { ReminderService } from './reminder';

@Injectable()
export class WhatsAppService {
  private client: Client | null = null;
  private qrCodeDataUrl: string | null = null;
  private connected = false;
  private starting = false;
  private reconnecting = false;
  private logger = new Logger('WhatsAppService');

  constructor(
    private readonly sessionService: SessionService,
    private readonly menuHandler: MenuHandlerService,
    private readonly reminderService: ReminderService,
  ) {}

  getQrCode() {
    return this.qrCodeDataUrl;
  }

  getStatus() {
    return {
      connected: this.connected,
      qrAvailable: !!this.qrCodeDataUrl,
      isLoggedOut: !this.connected && !this.qrCodeDataUrl,
    };
  }

  /**
   * Start the whatsapp-web.js client
   */
  async startBot(): Promise<void> {
    if (this.starting) {
      this.logger.log('Start already in progress, skip.');
      return;
    }
    this.starting = true;

    try {
      this.logger.log('🚀 Starting whatsapp-web.js client...');

      // ---- FIX: jangan buat dataPath manual ----
      // LocalAuth akan menyimpan ke ./LocalAuth/default

      if (this.client) {
        try {
          await this.client.destroy();
        } catch {}
        this.client = null;
      }

      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: 'main', // nama session WA
        }),
        puppeteer: {
          headless: true,
          executablePath: undefined, // biarkan puppeteer pilih chromium bawaan
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-features=WebRtcHideLocalIpsWithMdns',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ],
        },
      });

      // ---- QR code event ----
      this.client.on('qr', async (qr) => {
        this.qrCodeDataUrl = await qrcode.toDataURL(qr);
        this.logger.log('📌 QR ready.');
      });

      // ---- Ready (Connected) ----
      this.client.on('ready', () => {
        this.logger.log('✅ WhatsApp connected.');
        this.connected = true;
        this.qrCodeDataUrl = null;

        // sambungkan client ke feature lain
        this.menuHandler.setGlobalClient?.(this.client);
        this.reminderService.startSchedulers?.(this.client);
      });

      // ---- Authenticated ----
      this.client.on('authenticated', () => {
        this.logger.log('🔐 Authenticated with WhatsApp.');
      });

      // ---- Auth failure ----
      this.client.on('auth_failure', (msg) => {
        this.logger.error('⚠️ Auth failure:', msg);
        this.qrCodeDataUrl = null;
      });

      // ---- Disconnected ----
      this.client.on('disconnected', async (reason) => {
        this.logger.warn(`⚠️ Disconnected: ${reason}`);
        this.connected = false;
        this.qrCodeDataUrl = null;

        // Prevent concurrent reconnect flows
        if (this.reconnecting) {
          this.logger.log('Already handling reconnect/cleanup, skip.');
          return;
        }
        this.reconnecting = true;

        try {
          // 1) Try graceful shutdown of client and browser
          try {
            this.logger.log('Attempting graceful destroy of client...');
            await this.client.destroy().catch((e) => {
              this.logger.warn('destroy() warning (ignored):', e?.message ?? e);
            });
          } catch (e) {
            this.logger.warn(
              'Error while destroying client (ignored):',
              e?.message ?? e,
            );
          }

          // 2) If puppeteer browser still present, attempt to close it
          try {
            const browser = (this.client as any)?.pupBrowser;
            if (browser) {
              this.logger.log('Closing puppeteer browser...');
              await browser.close().catch((e) => {
                this.logger.warn(
                  'browser.close() warning (ignored):',
                  e?.message ?? e,
                );
              });
            }
          } catch (e) {
            this.logger.warn(
              'Error closing browser (ignored):',
              e?.message ?? e,
            );
          }

          // 3) Wait & retry to ensure OS releases file handles
          const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
          let cleaned = false;
          const maxAttempts = 6;
          for (let i = 0; i < maxAttempts; i++) {
            try {
              // attempt to clear session safely via sessionService (has its own retry logic)
              await this.sessionService.clearAuthState();
              cleaned = true;
              break;
            } catch (err) {
              this.logger.warn(
                `clearAuthState attempt ${i + 1} failed:`,
                (err as Error).message ?? err,
              );
              // on Windows, file locks usually release after small delay
              await wait(500 + i * 200);
            }
          }

          if (!cleaned) {
            this.logger.error(
              'Failed to clean session after retries. Will attempt restart without cleaning.',
            );
            // Optionally try to force kill chrome processes (windows) — see helper below
            try {
              // await this.tryKillChromiumProcesses().catch((e) => {
              //   this.logger.warn(
              //     'Force-kill chromium failed (ignored):',
              //     e?.message ?? e,
              //   );
              // });
              // attempt clear again
              await this.sessionService.clearAuthState();
              cleaned = true;
            } catch (e) {
              this.logger.error(
                'Final clearAuthState failed:',
                (e as Error).message ?? e,
              );
            }
          }

          // 4) Start bot again after short delay so QR will appear
          await new Promise((r) => setTimeout(r, 800));
          this.logger.log('Restarting client after disconnect cleanup...');
          try {
            await this.startBot();
          } catch (e) {
            this.logger.error('Restart failed:', (e as Error).message ?? e);
          }
        } finally {
          this.reconnecting = false;
        }
      });

      await this.client.initialize();
      this.logger.log('Client initialization triggered.');
    } catch (e) {
      this.logger.error('Failed to start WA client:', e);
    } finally {
      this.starting = false;
    }
  }

  async logout() {
    this.logger.log('Logout requested...');

    try {
      if (this.client) {
        // 1. Logout LocalAuth
        try {
          await (this.client as any)?.authStrategy?.logout();
        } catch (err) {
          this.logger.warn('LocalAuth logout failed or already cleared.');
        }

        // 2. Destroy chromium
        try {
          await this.client.destroy();
        } catch {}

        this.client = null;
        this.connected = false;
        this.qrCodeDataUrl = null;
      }

      this.logger.log('Logout complete.');

      // 🌟 FIX PALING PENTING
      // Langsung start ulang → WA akan memicu QR baru
      setTimeout(() => this.startBot(), 1000);
    } catch (error) {
      this.logger.error('Logout error:', error);
    }
  }

  async restart(): Promise<void> {
    this.logger.log('Restart requested...');
    try {
      await this.logout();
    } catch (e) {
      this.logger.warn(
        'Error during logout in restart',
        (e as Error).message ?? e,
      );
    }
    await new Promise((r) => setTimeout(r, 500));
    await this.startBot();
  }

  // helper to send simple text message
  async sendMessage(to: string, content: string) {
    if (!this.client || !this.connected)
      throw new Error('WhatsApp client not connected');
    // whatsapp-web.js expects number with @c.us for personal or @g.us for groups (or full jid)
    const jid = to.includes('@') ? to : `${to}@c.us`;
    return this.client.sendMessage(jid, content);
  }

  // helper to send media (example)
  async sendMedia(
    to: string,
    mediaBuffer: Buffer,
    filename: string,
    mimetype?: string,
  ) {
    if (!this.client || !this.connected)
      throw new Error('WhatsApp client not connected');
    const media = new MessageMedia(
      mimetype || 'application/octet-stream',
      mediaBuffer.toString('base64'),
      filename,
    );
    const jid = to.includes('@') ? to : `${to}@c.us`;
    return this.client.sendMessage(jid, media);
  }
}
