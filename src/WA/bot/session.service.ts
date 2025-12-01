// src/WA/bot/session.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const SESSION_DIRNAME = 'whatsapp-session';

@Injectable()
export class SessionService {
  private logger = new Logger('SessionService');
  private sessionPath = path.join(process.cwd(), SESSION_DIRNAME);

  ensureDir() {
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
      this.logger.log(`📁 Created session directory: ${this.sessionPath}`);
    }
  }

  getSessionPath() {
    this.ensureDir();
    return this.sessionPath;
  }

  /**
   * Reset session completely (hapus folder session dan buat ulang)
   */
  // src/WA/bot/session.service.ts (clearAuthState)
  async clearAuthState(): Promise<void> {
    const tries = 6;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const attemptRemove = () => {
      // Use rmSync with force, but wrap in try to return error if resource busy
      try {
        if (fs.existsSync(this.sessionPath)) {
          fs.rmSync(this.sessionPath, { recursive: true, force: true });
        }
        // recreate folder so LocalAuth has a place to write
        fs.mkdirSync(this.sessionPath, { recursive: true });
        return true;
      } catch (e) {
        // If EBUSY or EPERM, caller will retry
        throw e;
      }
    };

    for (let i = 0; i < tries; i++) {
      try {
        attemptRemove();
        this.logger.log(`🧹 Session directory cleared: ${this.sessionPath}`);
        return;
      } catch (err) {
        const msg = (err as Error).message ?? err;
        this.logger.warn(`clearAuthState attempt ${i + 1} failed: ${msg}`);
        // small backoff
        await sleep(300 + i * 200);
        continue;
      }
    }

    // Last resort: throw, caller can decide to force kill processes
    throw new Error(
      `Failed to clear session at ${this.sessionPath} after ${tries} attempts`,
    );
  }
}