// src/reminder.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentFlowService } from './paymentFlow';
import { Logger } from '@nestjs/common';

@Injectable()
export class ReminderService {
  private logger = new Logger('ReminderService');
  private whatsappClient: any;

  constructor(private paymentFlow: PaymentFlowService) {}

  startSchedulers(client: any) {
    this.whatsappClient = client;
    this.logger.log('Reminder schedulers started');
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleDailyReminders() {
    if (!this.whatsappClient) return;

    this.logger.log('Sending daily payment reminders');
    await this.paymentFlow.sendPaymentReminders(this.whatsappClient);
  }

  @Cron('0 0 1 * * *') // 1st of every month at midnight
  async handleExpiredSubscriptions() {
    if (!this.whatsappClient) return;

    this.logger.log('Checking for expired subscriptions');
    await this.paymentFlow.checkExpiredSubscriptions(this.whatsappClient);
  }

  @Cron('0 0 9 25 * *') // 25th day of every month at 9 AM
  async handleSubscriptionReminders() {
    if (!this.whatsappClient) return;

    this.logger.log('Sending subscription renewal reminders');
    await this.paymentFlow.sendPaymentReminders(this.whatsappClient);
  }
}
