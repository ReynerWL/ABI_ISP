// src/paymentFlow.ts
import { Injectable } from '@nestjs/common';
import { MenuUIService } from './menuUI';
import { Logger } from '@nestjs/common';
import { PaymentService } from '#/payment/payment.service';
import { UserService } from '#/user/user.service';
import { DataSource } from 'typeorm';
import { User } from '#/user/entities/user.entity';

@Injectable()
export class PaymentFlowService {
  private logger = new Logger('PaymentFlowService');

  constructor(
    private paymentsService: PaymentService,
    private usersService: UserService,
    private menuUI: MenuUIService,
    private dataSource: DataSource,
  ) {}

  async confirmPayment(client: any, paymentId: string) {
    try {
      const payment = await this.paymentsService.confirmPayment(paymentId);
      const user = await this.usersService.findByCustomerId(
        payment.users[0].customerId,
      );

      if (user) {
        await this.menuUI.sendPaymentSuccess(
          client,
          `${user.phone_number}@c.us`,
        );
        await this.dataSource.manager.update(User, user.id, {
          status: 'ACTIVE',
        });
      }

      this.logger.log(`Payment confirmed for ${payment.users[0].customerId}`);
    } catch (error) {
      this.logger.error(`Failed to confirm payment ${paymentId}`, error.stack);
    }
  }

  async rejectPayment(client: any, paymentId: string, reason: string) {
    try {
      const payment = await this.paymentsService.rejectPayment(
        paymentId,
        reason,
      );
      const user = await this.usersService.findByCustomerId(
        payment.users[0].customerId,
      );

      if (user) {
        await this.menuUI.sendPaymentRejected(
          client,
          `${user.phone_number}@c.us`,
          reason,
        );
      }

      this.logger.log(`Payment rejected for ${payment.users[0].id}{reason}`);
    } catch (error) {
      this.logger.error(`Failed to reject payment ${paymentId}`, error.stack);
    }
  }

  async checkExpiredSubscriptions(client: any) {
    const expiredUsers = await this.dataSource.manager.find(User, {
      where: { status: 'EXPIRED' },
      relations: ['role'],
    });

    for (const user of expiredUsers) {
      try {
        await this.menuUI.sendServiceExpired(
          client,
          `${user.phone_number}@c.us`,
        );
        this.logger.log(`Sent service expired notice to ${user.phone_number}`);
      } catch (error) {
        this.logger.error(
          `Failed to notify ${user.phone_number} about expired subscription`,
          error.stack,
        );
      }
    }
  }

  async sendPaymentReminders(client: any) {
    const dueUsers = await this.dataSource.manager.find(User, {
      where: {
        status: 'ACTIVE',
      },
      relations: ['role'],
    });

    for (const user of dueUsers) {
      const daysLeft = this.calculateDaysLeft(user.subscription.due_date);
      try {
        await this.menuUI.sendSubscriptionReminder(
          client,
          `${user.phone_number}@c.us`,
          daysLeft,
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

  private calculateDaysLeft(endDate: Date): number {
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
