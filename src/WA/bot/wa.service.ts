// src/WA/bot/wa.service.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
  ConnectionState, // For better type hinting
} from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode';
import { SessionService } from './session.service';
import { MenuHandlerService } from './menuHandler';
import { ReminderService } from './reminder';

@Injectable()
export class WhatsAppService {
  private client: ReturnType<typeof makeWASocket> | null = null; // Stronger typing
  private qrCode: string | null = null; // Stores Base64 data URL
  private connected: boolean = false;
  private reconnecting = false;
  private logger = new Logger('WhatsAppService');

  constructor(
    private readonly sessionService: SessionService, // Mark as readonly
    private readonly menuHandler: MenuHandlerService,
    private readonly reminderService: ReminderService,
  ) {}

  /**
   * Starts or restarts the WhatsApp bot.
   * Ensures a clean state before initiating a new connection attempt.
   */
  async startBot() {
    // --- CRITICAL: Reset state at the beginning of *every* start attempt ---
    this.logger.log('🚀 Initiating WhatsApp bot startup sequence...');
    this.qrCode = null; // Clear any previous QR code
    this.connected = false;

    // If there's an existing client, try to close it cleanly first.
    // Inside startBot(), before creating a new client
    if (this.client) {
      this.logger.debug('🧹 Cleaning up previous client instance...');
      try {
        // Attempt logout if the client seems potentially connected.
        // Baileys handles internal state and errors.
        this.logger.debug('📤 Requesting client logout...');
        await this.client.logout?.(); // Use optional chaining
        this.logger.debug(
          '✅ Logout command sent (or client was already disconnected).',
        );
      } catch (cleanupErr) {
        // Catch errors from logout (e.g., network issues, already disconnected)
        this.logger.warn(
          '⚠️ Error during client logout (might be already disconnected)',
          cleanupErr?.message,
        );
        // Do not rethrow, continue cleanup
      } finally {
        // Crucially drop the reference to the old client
        // Do NOT call removeAllListeners() here without an event name
        this.client = null;
        this.logger.debug('🧹 Previous client instance dereferenced.');
      }
    }
    // --- Proceed to loadAuthState and makeWASocket ---

    try {
      // --- Load a fresh auth state ---
      // This will load existing session if files are present, or prepare for a new one if not.
      const { state, saveState } = await this.sessionService.loadAuthState();
      const { version } = await fetchLatestBaileysVersion();

      this.logger.log('🔌 Creating new WhatsApp socket...');
      this.client = makeWASocket({
        auth: state,
        version,
        // Use a standard browser identifier
        browser: Browsers.macOS('Chrome'), // Or Browsers.ubuntu('Chrome')
        printQRInTerminal: false,
        // Optional: Add timeouts for robustness
        // connectTimeoutMs: 20_000,
        // keepAliveIntervalMs: 30_000,
      });

      // Hook up credential saving
      this.client.ev.on('creds.update', saveState);

      // --- Connection Event Handler ---
      this.client.ev.on(
        'connection.update',
        async (update: Partial<ConnectionState>) => {
          const { qr, connection, lastDisconnect } = update;

          if (qr) {
            this.logger.log('📱 QR code string received.');
            try {
              // --- ONLY Generate Base64 PNG Data URL ---
              this.qrCode = await qrcode.toDataURL(qr, {
                errorCorrectionLevel: 'M',
              }); // Specify ECC if desired
              this.connected = false; // Explicitly mark as not connected while QR exists
              this.logger.log('✅ QR Code Base64 generated and stored.');
              // --- END Generation ---
            } catch (err) {
              this.logger.error('❌ Failed to generate QR code Base64', err);
              this.qrCode = null; // Explicitly clear on error
            }
          }

          if (connection === 'connecting') {
            this.logger.log('🔄 Attempting to connect to WhatsApp...');
          }

          if (connection === 'open') {
            this.logger.log(
              '🎉 Successfully connected and authenticated to WhatsApp!',
            );
            this.qrCode = null; // Clear QR on successful connection
            this.connected = true;
            // Start your application logic here (e.g., schedulers)
            this.reminderService.startSchedulers(this.client); // Start only after confirmed open
          }

          if (connection === 'close') {
            this.logger.warn(
              `⚠️ Connection closed. Reason: ${lastDisconnect?.error?.message || 'Unknown'}`,
            );
            let statusCode: number | undefined;

            if (lastDisconnect?.error && 'output' in lastDisconnect.error) {
              this.reconnecting = true;
              this.logger.log('🕒 Scheduling reconnection in 5 seconds...');
              setTimeout(async () => {
                try {
                  await this.startBot(); // Recursive restart
                } catch (reconnectErr) {
                  this.logger.error(
                    'Reconnection attempt failed:',
                    reconnectErr,
                  );
                } finally {
                  this.reconnecting = false; // Always release the lock
                }
              }, 5000);
            } else if (lastDisconnect?.error) {
              this.logger.warn(
                '🛑 Session logged out. QR code will be regenerated on next start.',
              );
              this.qrCode = null;
              this.connected = false;
              // Do NOT automatically restart here. Wait for manual startBot() call.
            } else {
              this.logger.warn(
                '🛑 Connection closed permanently (e.g., connection lost, restart needed).',
              );
              this.qrCode = null;
              this.connected = false;
            }

            const shouldReconnect =
              statusCode !== DisconnectReason.loggedOut &&
              statusCode !== DisconnectReason.connectionClosed;

            this.logger.log(
              `🔁 Should attempt reconnection: ${shouldReconnect} (Code: ${statusCode})`,
            );
          }
        },
      );

      // --- Message Event Handler ---
      this.client.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.key.fromMe && msg.message) {
          const customerNumber = msg.key.remoteJid;
          await this.menuHandler.handleMessage(
            this.client!,
            customerNumber,
            msg,
          ); // Assert non-null after 'open'
        }
      });

      // Note: ReminderService.startSchedulers is now called only on 'open' connection
    } catch (error) {
      this.logger.error(
        '💥 Fatal error during bot startup sequence',
        error.stack,
      );
      // Potentially trigger a delayed restart here on fatal errors?
      // But be careful not to create infinite loops.
      this.qrCode = null;
      this.connected = false;
      this.client = null; // Ensure cleanup on fatal error
    }
  }

  /**
   * Gets the current QR code as a Base64 data URL string.
   * Returns null if not available (e.g., connected, disconnected, not generated yet).
   */
  getQrCode(): string | null {
    return this.qrCode;
  }

  /**
   * Gets the current connection status.
   */
  getStatus() {
    return {
      connected: this.connected,
      hasQrCode: !!this.qrCode,
      qrCode: this.qrCode, // The actual Base64 string or null
    };
  }

  /**
   * Gets the Baileys client instance (if connected).
   */
  getClient() {
    return this.client;
  }

  /**
   * Performs a full logout from WhatsApp Web and clears local session files.
   * The next call to `startBot()` should generate a new QR code.
   */
  async logout() {
    this.logger.log('🚪 Initiating logout procedure...');
    let logoutSuccessful = false;
    if (this.client) {
      try {
        this.logger.log('📤 Sending logout command to WhatsApp Web...');
        await this.client.logout(); // Await the logout
        this.logger.log('✅ Logout command sent successfully to WhatsApp Web.');
      } catch (error) {
        // Logout can fail if already disconnected, that's often okay.
        this.logger.warn(
          '⚠️ Error during logout command (might already be disconnected)',
          error?.message,
        );
        // Do not prevent session clearing based on this
      } finally {
        // Ensure client is dereferenced regardless of logout outcome
        // Do NOT call removeAllListeners() here without an event name
        this.client = null; // Drop reference
      }
    } else {
      this.logger.log('ℹ️ No active client found to logout from.');
    }
    // --- Continue with internal state reset and session clearing ---
    this.qrCode = null;
    this.connected = false;
    this.reconnecting = false;
    this.logger.log('🗑️ Clearing local session files...');
    await this.sessionService.clearAuthState();
    this.logger.log('✅ Logout procedure completed. Session cleared.');

    if (logoutSuccessful) {
      this.logger.log('🗑️ Clearing local session files...');
      // --- KEY: Await the session clearing ---
      await this.sessionService.clearAuthState(); // Delete session files from disk
      this.logger.log(
        '✅ Logout procedure completed. Session cleared. Ready for new QR generation on next start.',
      );
    } else {
      this.logger.error(
        '❌ Logout procedure failed. Session might not be fully cleared.',
      );
    }
    // The next call to `startBot()` should now generate a new QR because:
    // 1. Session files are gone (if logout/clear successful).
    // 2. Internal state (`qrCode`, `connected`) is reset.
    // 3. `loadAuthState()` will create a fresh session if needed.
  }
}
