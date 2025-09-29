// src/WA/bot/paymentFlow.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { MenuUIService } from './menuUI';
import { PaymentService } from '../../payment/payment.service';
import { UserService } from '../../user/user.service';
import { DataSource } from 'typeorm';
import { User, UserStatus } from '../../user/entities/user.entity';
import { MailService } from '../../mail/mail.service';
import { Payment } from '#/payment/entities/payment.entity';

@Injectable()
export class PaymentFlowService {
  private logger = new Logger('PaymentFlowService');

  constructor(
    private paymentService: PaymentService,
    private userService: UserService,
    private menuUI: MenuUIService,
    private mailService: MailService,
    private dataSource: DataSource,
  ) {}

  /**
   * Confirm payment → activate service
   */
  async confirmPayment(client: any, paymentId: string) {
    try {
      const payment = await this.dataSource.manager.findOne(Payment, {
        where: { id: paymentId },
        relations: ['user'],
      });

      if (!payment || !payment.user) {
        this.logger.warn(`Payment not found or no user linked: ${paymentId}`);
        return;
      }

      const user = payment.user;

      // Update user status
      await this.dataSource.manager.update(User, user.id, {
        status: UserStatus.AKTIF,
      });

      // Notify user
      await this.menuUI.sendPaymentSuccess(client, `${user.phone_number}@c.us`);
      await this.mailService.sendPaymentSuccess(user, payment.id, new Date());

      this.logger.log(`✅ Payment confirmed for ${user.customerId}`);
    } catch (error) {
      this.logger.error(`Failed to confirm payment ${paymentId}`, error.stack);
    }
  }

  /**
   * Reject payment → keep expired
   */
  async rejectPayment(client: any, paymentId: string, reason: string) {
    try {
      // Update status first
      await this.paymentService.rejectPayment(paymentId, reason);

      const payment = await this.dataSource.manager.findOne(Payment, {
        where: { id: paymentId },
        relations: ['user'],
      });

      if (!payment || !payment.user) return;

      const user = payment.user;

      // Notify user
      await this.menuUI.sendPaymentRejected(
        client,
        `${user.phone_number}@c.us`,
        reason,
      );
      await this.mailService.sendPaymentRejected(user, reason);

      this.logger.log(`❌ Payment rejected for ${user.customerId}: ${reason}`);
    } catch (error) {
      this.logger.error(`Failed to reject payment ${paymentId}`, error.stack);
    }
  }

  /**
   * Daily checker: send reminders at Day 23 (7 left) and Day 27 (3 left)
   */
  async sendPaymentReminders(client: any) {
    const users = await this.userService.findActiveUsers();

    const today = new Date();
    for (const user of users) {
      if (!user.subscription?.start_date) continue;

      const daysSinceStart = this.daysSince(user.subscription.start_date);
      const daysLeft = 30 - daysSinceStart;

      try {
        // 7 days before expiry → Day 23
        if (daysLeft === 7) {
          await this.menuUI.sendSubscriptionReminder(
            client,
            `${user.phone_number}@c.us`,
            7,
          );
          await this.mailService.sendSubscriptionReminder(
            user,
            this.addDays(today, 7),
          );
          this.logger.log(`📅 7-day reminder sent to ${user.phone_number}`);
        }

        // 3 days before expiry → Day 27
        if (daysLeft === 3) {
          await this.menuUI.sendSubscriptionReminder(
            client,
            `${user.phone_number}@c.us`,
            3,
          );
          await this.mailService.sendSubscriptionReminder(
            user,
            this.addDays(today, 3),
          );
          this.logger.log(`⚠️ 3-day reminder sent to ${user.phone_number}`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to send reminder to ${user.phone_number}`,
          error.stack,
        );
      }
    }
  }

  /**
   * Daily checker: expire users on Day 30+
   */
  async checkExpiredSubscriptions(client: any) {
    const users = await this.userService.findActiveUsers();

    for (const user of users) {
      if (!user.subscription?.start_date) continue;

      const daysSinceStart = this.daysSince(user.subscription.start_date);

      if (daysSinceStart >= 30) {
        // Mark as expired
        await this.dataSource.manager.update(User, user.id, {
          status: UserStatus.NONAKTIF,
        });

        // Notify
        await this.menuUI.sendServiceExpired(
          client,
          `${user.phone_number}@c.us`,
        );
        await this.mailService.sendSubscriptionReminder(user, new Date()); // Optional: "expired" email

        this.logger.log(`🔴 Subscription expired for ${user.phone_number}`);
      }
    }
  }

  /**
   * Notify a specific user that their service is expired
   */
  async notifyExpired(client: any, user: User) {
    try {
      await this.menuUI.sendServiceExpired(client, `${user.phone_number}@c.us`);
      await this.mailService.sendSubscriptionReminder(user, new Date());
      this.logger.log(`Sent expired notice to ${user.phone_number}`);
    } catch (error) {
      this.logger.error(
        `Failed to notify expired user ${user.phone_number}`,
        error.stack,
      );
    }
  }

  // Helper: Days since date
  private daysSince(date: Date | string): number {
    const start = new Date(date);
    const today = new Date();
    const diffTime = today.getTime() - start.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  // Helper: Add days
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
