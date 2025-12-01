// src/WA/bot/session.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SessionService {
  private logger = new Logger('SessionService');

  // Lokasi session resmi WWebJS akan disimpan di:
  // <project>/whatsapp-session/.wwebjs_auth/
  private basePath = path.join(process.cwd(), 'whatsapp-session');
  private authPath = path.join(this.basePath, '.wwebjs_auth');

  ensureDir() {
    if (!fs.existsSync(this.authPath)) {
      fs.mkdirSync(this.authPath, { recursive: true });
      this.logger.log(`📁 Created session dir: ${this.authPath}`);
    }
  }

  getAuthPath() {
    this.ensureDir();
    return this.authPath;
  }

  /**
   * Membersihkan state auth secara penuh
   */
  async clearAuthState() {
    this.logger.warn('🧹 Clearing WhatsApp auth state...');

    const folder = this.authPath;

    if (fs.existsSync(folder)) {
      try {
        fs.rmSync(folder, { recursive: true, force: true });
        this.logger.log(`🗑️ Deleted: ${folder}`);
      } catch (err) {
        this.logger.error('Failed removing auth folder:', err);
      }
    }

    // Recreate folder agar LocalAuth bisa menulis ulang
    fs.mkdirSync(folder, { recursive: true });

    this.logger.log('📁 Auth folder recreated');
  }
}
