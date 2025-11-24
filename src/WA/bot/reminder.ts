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
    private menuHandler: MenuHandlerService, // ✅ Inject MenuHandlerService
    private dataSource: DataSource,
    private jwtService: JwtService,         // ✅ For secure links
    private mailservice: MailService
  ) {}

  /**
   * Called by main app to set WhatsApp client
   */
  startSchedulers(client: any) {
    this.whatsappClient = client;
  }

  /**
   * Run every day at 9 AM
   * Send reminders and check for expired subscriptions
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleDailyUserReminders() {
    if (!this.whatsappClient) {
      this.logger.warn('WhatsApp client not available. Skipping daily reminders.');
      return;
    }

    this.logger.log('⏰ Starting daily reminder checks...');

    try {
      // 1. Send subscription renewal reminders
      await this.sendSubscriptionReminders();

      // 2. Check for expired subscriptions
      await this.checkExpiredSubscriptions();

      this.logger.log('✅ Daily reminder checks completed successfully.');
    } catch (error) {
      this.logger.error('💥 Failed to run daily reminders', error.stack);
    }
  }

  /**
   * Send renewal reminders to users whose subscription is about to expire
   */
  private async sendSubscriptionReminders() {
    const today = new Date();
    
    // Find users whose subscription expires in 7 days or 3 days
    const reminderDates = [
      new Date(today).setDate(today.getDate() + 7), // 7 days from now
      new Date(today).setDate(today.getDate() + 3), // 3 days from now
    ];

    for (const dueDate of reminderDates) {
      const usersNeedingReminder = await this.dataSource.getRepository('User').find({
        where: {
          status: UserStatus.AKTIF, // Only active users
          subscription: {
            dueDate: new Date(dueDate), // Exactly on the due date
          },
        },
        relations: ['subscription'], // Load subscription relation
      });

      const daysLeft = Math.ceil((new Date(dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      for (const user of usersNeedingReminder) {
        try {
          // ✅ Send reminder via WhatsApp using MenuHandlerService
          await this.menuHandler.sendSubscriptionReminder(
            this.whatsappClient,
            `${user.phoneNumber}@c.us`, // Convert to WhatsApp JID
            daysLeft,
            user.id, // Pass user ID for token generation inside menuHandler if needed
          );

          await this.mailservice.sendSubscriptionReminder(
            user.id, new Date(dueDate)
          )

          this.logger.log(`📅 Sent ${daysLeft}-day reminder to ${user.phoneNumber} (User ID: ${user.id})`);
        } catch (error) {
          this.logger.error(`Failed to send reminder to ${user.phoneNumber}`, error.stack);
        }
      }
    }
  }

  /**
   * Check for expired subscriptions and send 'service expired' notice
   */
  private async checkExpiredSubscriptions() {
    const now = new Date();

    // Find users whose subscription has expired (dueDate < now) and are still marked as ACTIVE
    const expiredUsers = await this.dataSource.getRepository('User').find({
      where: {
        status: UserStatus.AKTIF, // Still marked active
        subscription: {
          dueDate: LessThan(now), // But due date has passed
        },
      },
      relations: ['subscription'],
    });

    for (const user of expiredUsers) {
      try {
        // ✅ Update user status to EXPIRED in the database
        await this.dataSource.getRepository('User').update(user.id, {
          status: UserStatus.NONAKTIF,
        });

        // ✅ Generate secure upload link for renewal
        const uploadLink = `https://mbinet.click/`;

        // ✅ Send 'service expired' notice via WhatsApp
        await this.menuHandler.sendServiceExpired(
          this.whatsappClient,
          `${user.phoneNumber}@c.us`,
          user.id, // Pass user ID if needed inside menuHandler
        );

        await this.mailservice.sendExpired(
          user.id, now
        )

        this.logger.log(`🔴 Marked subscription as expired for ${user.phoneNumber} (User ID: ${user.id})`);
      } catch (error) {
        this.logger.error(`Failed to process expired subscription for ${user.phoneNumber}`, error.stack);
      }
    }
  }

  /**
   * ✅ Generate a secure JWT token for payment upload
   */
  private async generateUploadToken(userId: string): Promise<string> {
    const payload = {
      sub: userId,
      action: 'upload_payment_proof',
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // Expires in 24 hours
    };

    return this.jwtService.sign(payload, {
      secret: process.env.JWT_UPLOAD_SECRET!, // Use a strong secret from environment
      algorithm: 'HS256',
    });
  }
}