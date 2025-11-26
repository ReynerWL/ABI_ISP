// src/reminder/reminder.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JwtService } from '@nestjs/jwt'; // ✅ To generate secure upload links
import { DataSource, LessThan, MoreThanOrEqual } from 'typeorm';
import { MenuHandlerService } from './menuHandler';
import { UserService } from '#/user/user.service';
import { UserStatus } from '#/user/entities/user.entity';
import { MailService } from '#/mail/mail.service';

@Injectable()
export class ReminderService {
  private logger = new Logger('ReminderService');
  private whatsappClient: any;

  constructor(
    private menuHandler: MenuHandlerService,
    private dataSource: DataSource,
    private jwtService: JwtService,
    private mailservice: MailService,
  ) {}

  /**
   * Dipanggil oleh WhatsAppService setelah client ready.
   */
  startSchedulers(client: any) {
    this.whatsappClient = client;
  }

  /**
   * Cron: Setiap hari jam 9 pagi
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleDailyUserReminders() {
    if (!this.whatsappClient) {
      this.logger.warn(
        'WhatsApp client not available. Skipping daily reminders.',
      );
      return;
    }

    this.logger.log('⏰ Running daily reminders...');

    try {
      await this.sendSubscriptionReminders();
      await this.checkExpiredSubscriptions();

      this.logger.log('✅ Daily reminder checks finished.');
    } catch (error) {
      this.logger.error('💥 Daily reminders failed', error.stack);
    }
  }

  // ----------------------------------------------------------
  // Helper: Convert nomor → JID
  // ----------------------------------------------------------
  private toJid(phone: string): string {
    phone = phone.replace(/\D/g, '');
    if (!phone.endsWith('@c.us')) {
      return `${phone}@c.us`;
    }
    return phone;
  }

  // ----------------------------------------------------------
  // Kirim pengingat jatuh tempo
  // ----------------------------------------------------------
  private async sendSubscriptionReminders() {
    const today = new Date();

    const reminderDates = [
      new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // +7 hari
      new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), // +3 hari
    ];

    for (const dueDate of reminderDates) {
      const users = await this.dataSource.getRepository('User').find({
        where: {
          status: UserStatus.AKTIF,
          subscription: {
            dueDate: dueDate,
          },
        },
        relations: ['subscription'],
      });

      const daysLeft = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      for (const user of users) {
        try {
          const jid = this.toJid(user.phoneNumber);

          // Kirim WA melalui MenuHandler
          await this.menuHandler.sendSubscriptionReminder(
            this.whatsappClient,
            jid,
            daysLeft,
            user.id,
          );

          await this.mailservice.sendSubscriptionReminder(user.id, dueDate);

          this.logger.log(
            `📅 Sent ${daysLeft}-day reminder to ${user.phoneNumber} (ID: ${user.id})`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send reminder to ${user.phoneNumber}`,
            error.stack,
          );
        }
      }
    }
  }

  // ----------------------------------------------------------
  // Cek expired subscription
  // ----------------------------------------------------------
  private async checkExpiredSubscriptions() {
    const now = new Date();

    const expiredUsers = await this.dataSource.getRepository('User').find({
      where: {
        status: UserStatus.AKTIF,
        subscription: {
          dueDate: LessThan(now),
        },
      },
      relations: ['subscription'],
    });

    for (const user of expiredUsers) {
      try {
        // Update status database
        await this.dataSource.getRepository('User').update(user.id, {
          status: UserStatus.NONAKTIF,
        });

        const jid = this.toJid(user.phoneNumber);

        // Kirim WA expired notice
        await this.menuHandler.sendServiceExpired(
          this.whatsappClient,
          jid,
          user.id,
        );

        await this.mailservice.sendExpired(user.id, now);

        this.logger.log(
          `🔴 Marked expired & notified ${user.phoneNumber} (ID: ${user.id})`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to process expired user ${user.phoneNumber}`,
          error.stack,
        );
      }
    }
  }

  /**
   * (Masih opsional kalau mau dipakai lagi)
   * Generate token upload secure
   */
  private async generateUploadToken(userId: string): Promise<string> {
    const payload = {
      sub: userId,
      action: 'upload_payment_proof',
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    };

    return this.jwtService.sign(payload, {
      secret: process.env.JWT_UPLOAD_SECRET!,
      algorithm: 'HS256',
    });
  }
}
