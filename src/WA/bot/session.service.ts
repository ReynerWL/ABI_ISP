// src/WA/bot/session.service.ts
import { Injectable } from '@nestjs/common';
import { useMultiFileAuthState, Browsers } from '@whiskeysockets/baileys';
import { promises as fs } from 'fs';
import { Logger } from '@nestjs/common';

const SESSION_DIR = './whatsapp-session'; // Directory (not file)

@Injectable()
export class SessionService {
  private logger = new Logger('SessionService');

  async loadAuthState() {
    try {
      // Ensure session directory exists
      await this.ensureDir(SESSION_DIR);

      // ✅ This handles everything: keys, creds, encryption, etc.
      const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

      return {
        state,
        saveState: async () => {
          await saveCreds(); // Save both creds and keys
          this.logger.debug(`🔐 Session saved to ${SESSION_DIR}`);
        },
      };
    } catch (error) {
      this.logger.error('Failed to load multi-file auth state', error.stack);
      throw error;
    }
  }

  private async ensureDir(path: string) {
    try {
      await fs.access(path);
    } catch {
      await fs.mkdir(path, { recursive: true });
      this.logger.log(`📁 Created session directory: ${path}`);
    }
  }

  async clearAuthState() {
    const fs = await import('fs').then((m) => m.promises);
    try {
      await fs.rm(SESSION_DIR, { recursive: true, force: true });
      this.logger.log('🗑️ Session directory deleted');
    } catch (error) {
      this.logger.error('Failed to delete session', error);
    }
  }
}
