// src/wa.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { SessionService } from './session';
import { MenuHandlerService } from './menuHandler';
import { ReminderService } from './reminder';
import { Logger } from '@nestjs/common';

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private client: any;
  private logger = new Logger('WhatsAppService');

  constructor(
    private sessionService: SessionService,
    private menuHandler: MenuHandlerService,
    private reminderService: ReminderService,
  ) {}

  async onModuleInit() {
    await this.startBot();
  }

  async startBot() {
    const { state, saveState } = await this.sessionService.loadAuthState();
    const { version } = await fetchLatestBaileysVersion();

    this.client = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys),
      },
      version,
      printQRInTerminal: true,
    });

    this.client.ev.on('creds.update', saveState);
    this.setupMessageHandler();
    this.reminderService.startSchedulers(this.client);
  }

  private setupMessageHandler() {
    this.client.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'close') {
        const shouldReconnect =
          lastDisconnect.error?.output?.statusCode !==
          DisconnectReason.loggedOut;
        this.logger.warn(`Connection closed. Reconnecting: ${shouldReconnect}`);
        if (shouldReconnect) {
          await this.startBot();
        }
      } else if (connection === 'open') {
        this.logger.log('Connected to WhatsApp');
      }
    });

    this.client.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      if (!msg.key.fromMe && msg.message) {
        const customerNumber = msg.key.remoteJid;
        await this.menuHandler.handleMessage(this.client, customerNumber, msg);
      }
    });
  }

  getClient() {
    return this.client;
  }
}
