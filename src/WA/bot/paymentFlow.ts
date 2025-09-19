// src/WA/bot/paymentFlow.ts
import { Injectable, Logger } from '@nestjs/common';
import { MenuUIService } from './menuUI';
import { PaymentService } from '../../payment/payment.service';
import { UserService } from '../../user/user.service';
import { DataSource } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { MailService } from '../../mail/mail.service'; // ✅ Add this
import { Payment } from '#/payment/entities/payment.entity';

@Injectable()
export class PaymentFlowService {
  private logger = new Logger('PaymentFlowService');

  constructor(
    private paymentService: PaymentService,
    private userService: UserService,
    private menuUI: MenuUIService,
    private mailService: MailService, // ✅ Inject MailService
    private dataSource: DataSource,
  ) {}

  async confirmPayment(client: any, paymentId: string) {
    try {
      // Get payment with user
      const payment = await this.dataSource.manager.findOne(Payment, {
        where: { id: paymentId },
        relations: ['user'],
      });

      if (!payment) {
        this.logger.warn(`Payment not found: ${paymentId}`);
        return;
      }

      const user = await this.userService.findOne(payment.user.id);
      if (!user) return;

      // Update user status
      await this.dataSource.manager.update(User, user.id, {
        status: 'ACTIVE',
      });

      // Send WhatsApp
      await this.menuUI.sendPaymentSuccess(client, `${user.phone_number}@c.us`);

      // Send Email
      await this.mailService.sendPaymentSuccess(user, payment.id, new Date());

      this.logger.log(`Payment confirmed for ${user.customerId}`);
    } catch (error) {
      this.logger.error(`Failed to confirm payment ${paymentId}`, error.stack);
    }
  }

  async rejectPayment(client: any, paymentId: string, reason: string) {
    try {
      // First reject in DB
      await this.paymentService.rejectPayment(paymentId, reason);

      // Then fetch updated payment
      const payment = await this.dataSource.manager.findOne(Payment, {
        where: { id: paymentId },
        relations: ['user'],
      });

      if (!payment) return;

      const user = await this.userService.findOne(payment.user.id);
      if (!user) return;

      // Send WhatsApp
      await this.menuUI.sendPaymentRejected(
        client,
        `${user.phone_number}@c.us`,
        reason,
      );

      // Send Email
      await this.mailService.sendPaymentRejected(user, reason);

      this.logger.log(`Payment rejected for ${payment.user.id}: ${reason}`); // ✅ Fixed typo
    } catch (error) {
      this.logger.error(`Failed to reject payment ${paymentId}`, error.stack);
    }
  }

  async checkExpiredSubscriptions(client: any) {
    const expiredUsers = await this.dataSource.manager.find(User, {
      where: { status: 'INACTIVE' },
      relations: ['role'],
    });

    for (const user of expiredUsers) {
      try {
        await this.menuUI.sendServiceExpired(
          client,
          `${user.phone_number}@c.us`,
        );
        await this.mailService.sendSubscriptionReminder(user, new Date()); // ✅ Optional: send expired email

        this.logger.log(`Sent service expired notice to ${user.phone_number}`);
      } catch (error) {
        this.logger.error(
          `Failed to notify ${user.phone_number} about expired subscription`,
          error.stack,
        );
      }
    }
  }

  async sendPaymentReminders(
    client: any,
    user: User,
    type: '7_days' | '3_days',
  ) {
    const dueUsers = await this.dataSource.manager.find(User, {
      where: { id: user.id },
      relations: ['role', 'subscription'], // ✅ Load subscription
    });

    const messages = {
      '7_days': `📅 Reminder: Your subscription will renew in 7 days!\n\nPlease prepare your payment to avoid disconnection.`,
      '3_days': `⚠️ Urgent: Your subscription ends in 3 days!\n\nPlease renew now to keep your internet active.`,
    };

    await client.sendMessage(`${user.phone_number}@c.us`, {
      text: messages[type],
    });

    for (const user of dueUsers) {
      if (!user.subscription?.due_date) continue;

      const daysLeft = this.calculateDaysLeft(user.subscription.due_date);
      if (daysLeft > 5) continue; // Only remind if 5 days or less

      try {
        await this.menuUI.sendSubscriptionReminder(
          client,
          `${user.phone_number}@c.us`,
          daysLeft,
        );

        // Send email reminder
        await this.mailService.sendSubscriptionReminder(
          user,
          user.subscription.due_date,
        );

        this.logger.log(
          `Sent payment reminder to ${user.phone_number} (${daysLeft} days left)`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send reminder to ${user.phone_number}`,
          error.stack,
        );
      }
    }
  }

  async notifyExpired(client: any, user: User) {
    try {
      await this.menuUI.sendServiceExpired(client, `${user.phone_number}@c.us`);
      await this.mailService.sendSubscriptionReminder(user, new Date()); // ✅ Optional: send expired email

      this.logger.log(`Sent service expired notice to ${user.phone_number}`);
    } catch (error) {
      this.logger.error(
        `Failed to notify ${user.phone_number} about expired subscription`,
        error.stack,
      );
    }
  }

  private calculateDaysLeft(endDate: Date | string): number {
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffTime = end.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
