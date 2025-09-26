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
    if (!this.whatsappClient) {
      this.logger.warn('WhatsApp client not available. Skipping daily reminders.');
      return;
    }

    try {
      // ✅ Send 7-day and 3-day reminders (checks internally)
      await this.paymentFlow.sendPaymentReminders(this.whatsappClient);

      // ✅ Expire subscriptions on day 30+
      await this.paymentFlow.checkExpiredSubscriptions(this.whatsappClient);

      this.logger.log('✅ Daily user reminders and expiry check completed.');
    } catch (error) {
      this.logger.error('❌ Failed to run daily reminders', error.stack);
    }
  }
}