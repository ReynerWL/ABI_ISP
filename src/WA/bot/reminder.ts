// src/reminder/reminder.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentFlowService } from './paymentFlow';
import { UserService } from '#/user/user.service';

@Injectable()
export class ReminderService {
  private logger = new Logger('ReminderService');
  private whatsappClient: any;

  constructor(
    private paymentFlow: PaymentFlowService,
    private userService: UserService,
  ) {}

  /**
   * Called by main app to set WhatsApp client
   */
  startSchedulers(client: any) {
    this.whatsappClient = client;
  }

  /**
   * Run every day at 9 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleDailyUserReminders() {
    if (!this.whatsappClient) return;

    const today = new Date();
    const users = await this.userService.findActiveUsers();

    for (const user of users) {
      const startDate = new Date(user.subscription?.start_date);
      if (!startDate || isNaN(startDate.getTime())) continue;

      const totalDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysLeft = 30 - totalDays;

      try {
        // 7 days before expiry → Day 23
        if (daysLeft === 7) {
          await this.paymentFlow.sendPaymentReminders(this.whatsappClient, user, '7_days');
          this.logger.log(`🔔 7-day renewal reminder sent to ${user.phone_number}`);
        }

        // 3 days before expiry → Day 27
        if (daysLeft === 3) {
          await this.paymentFlow.sendPaymentReminders(this.whatsappClient, user, '3_days');
          this.logger.log(`🔔 3-day renewal reminder sent to ${user.phone_number}`);
        }

        // On Day 30 → Expire & Notify
        if (totalDays >= 30 && user.status === 'ACTIVE') {
          await this.userService.markAsExpired(user.id);
          await this.paymentFlow.notifyExpired(this.whatsappClient, user);

          this.logger.log(`🔴 Subscription expired for ${user.phone_number}`);

          // Optional: Block internet via MikroTik
          // await this.mikrotikService.blockUser(user.customerId);
        }
      } catch (error) {
        this.logger.error(`Failed to process user ${user.phone_number}`, error.stack);
      }
    }
  }
}