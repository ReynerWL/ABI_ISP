// src/WA/bot/wa.service.ts
import { Injectable } from '@nestjs/common';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, WASocket } from '@whiskeysockets/baileys';
import { menuHandler } from './menuHandler';
import { reminderTask, expirationTask } from './reminder';
import { paymentFlow } from './paymentFlow';

@Injectable()
export class WAService {
  private sock: WASocket;

  async start() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    const { version } = await fetchLatestBaileysVersion();
    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const jid = msg.key.remoteJid!;
      const content = msg.message;
      const text = content?.conversation || content?.extendedTextMessage?.text || '';
      const selectedButtonId = content?.buttonsResponseMessage?.selectedButtonId;

      if (content.imageMessage) {
        await paymentFlow.handleImage(this.sock, jid, msg);
        return;
      }

      await menuHandler(this.sock, jid, text.trim().toLowerCase(), selectedButtonId);
    });

    reminderTask(this.sock);
    expirationTask(this.sock);
  }

  async sendMessage(jid: string, text: string) {
    await this.sock.sendMessage(jid, { text });
  }
}
