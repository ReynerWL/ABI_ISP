// src/session.ts
import { Injectable } from '@nestjs/common';
// import { useSingleFileAuthState, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import { promises as fs } from 'fs';
import { Logger } from '@nestjs/common';

const SESSION_FILE = 'whatsapp-session.json';

@Injectable()
export class SessionService {
  private logger = new Logger('SessionService');

  async loadAuthState() {
    try {
      if (await this.fileExists(SESSION_FILE)) {
        const content = await fs.readFile(SESSION_FILE, 'utf-8');
        const state = JSON.parse(content);
        this.logger.log('Session loaded from file');
        return {
          state,
          saveState: () => this.saveAuthState(state),
        };
      }
    } catch (error) {
      this.logger.error('Failed to load session', error.stack);
    }

    this.logger.log('Creating new session');
    return {
      state: { creds: {}, keys: {} },
      saveState: () => this.saveAuthState({ creds: {}, keys: {} }),
    };
  }

  private async saveAuthState(state: any) {
    try {
      await fs.writeFile(SESSION_FILE, JSON.stringify(state));
      this.logger.debug('Session saved to file');
    } catch (error) {
      this.logger.error('Failed to save session', error.stack);
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}