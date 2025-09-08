// src/mikrotik/mikrotik.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { RouterOSAPI } from 'node-routeros';

@Injectable()
export class MikrotikService {
  private logger = new Logger('MikrotikService');

  private async getClient() {
    const api = new RouterOSAPI({
      host: process.env.MIKROTIK_HOST,
      user: process.env.MIKROTIK_USER,
      password: process.env.MIKROTIK_PASSWORD,
      port: parseInt(process.env.MIKROTIK_PORT ?? '', 10) || 8728,
    });
    await api.connect();
    return api;
  }

  async blockUser(username: string): Promise<boolean> {
    try {
      const api = await this.getClient();
      const users = await api.write('/ip/hotspot/user/print', [
        '?name=' + username,
      ]);

      if (users.length === 0) {
        this.logger.warn(`MikroTik: User not found: ${username}`);
        return false;
      }

      await api.write('/ip/hotspot/user/disable', [
        '.id=' + users[0]['.id'],
      ]);

      this.logger.log(`MikroTik: Blocked user ${username}`);
      await api.close();
      return true;
    } catch (error) {
      this.logger.error(`MikroTik: Failed to block ${username}`, error.stack);
      return false;
    }
  }

  async unblockUser(username: string): Promise<boolean> {
    try {
      const api = await this.getClient();
      const users = await api.write('/ip/hotspot/user/print', [
        '?name=' + username,
      ]);

      if (users.length === 0) return false;

      await api.write('/ip/hotspot/user/enable', [
        '.id=' + users[0]['.id'],
      ]);

      this.logger.log(`MikroTik: Unblocked user ${username}`);
      await api.close();
      return true;
    } catch (error) {
      this.logger.error(`MikroTik: Failed to unblock ${username}`, error.stack);
      return false;
    }
  }

  async getUserStatus(username: string): Promise<{ active: boolean; uptime?: string }> {
    try {
      const api = await this.getClient();
      const activeUsers = await api.write('/ip/hotspot/active/print', [
        '?user=' + username,
      ]);
      await api.close();

      return {
        active: activeUsers.length > 0,
        uptime: activeUsers[0]?.uptime,
      };
    } catch (error) {
      this.logger.error(`MikroTik: Failed to get status for ${username}`, error.stack);
      return { active: false };
    }
  }
}