// src/WA/bot/session.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const SESSION_DIR = 'baileys_auth_info';

@Injectable()
export class SessionService {
  private logger = new Logger('SessionService');

  private getSessionPaths(): string[] {
    const root = process.cwd();
    return [
      path.join(root, SESSION_DIR),
      // Legacy paths
      path.join(root, 'mbinet-wa.data.json'),
      path.join(root, 'mbinet-wa'),
      path.join(root, 'whatsapp-session'),
      path.join(root, '.wwebjs_auth'),
    ];
  }

  async clearAuthState(): Promise<void> {
    const tries = 6;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    for (const sessionPath of this.getSessionPaths()) {
      for (let i = 0; i < tries; i++) {
        try {
          if (!fs.existsSync(sessionPath)) break; // nothing to clean

          const stat = fs.statSync(sessionPath);
          if (stat.isDirectory()) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(sessionPath);
          }

          this.logger.log(`🧹 Removed session data: ${sessionPath}`);
          break;
        } catch (err) {
          const msg = (err as Error).message ?? err;
          this.logger.warn(
            `clearAuthState attempt ${i + 1} for ${sessionPath} failed: ${msg}`,
          );
          await sleep(300 + i * 200);
        }
      }
    }

    this.logger.log('🧹 Session cleanup complete');
  }
}