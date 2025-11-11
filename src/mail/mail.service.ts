// src/mail/mail.service.ts
import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { User } from '../user/entities/user.entity';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendSubscriptionReminder(user: User, dueDate: Date) {
    await this.mailerService.sendMail({
      to: user.email,
      subject: '🔔 Subscription Reminder – Payment Due Soon',
      template: 'reminder',
      context: {
        name: user.name,
        packageName: user.paket?.name || 'Unknown Package',
        dueDate: dueDate.toLocaleDateString(),
        supportEmail: 'amartanet578@gmail.com',
        companyName: 'ABI_ISP',
        year: new Date().getFullYear(),
      },
    });
  }

  async sendPaymentSuccess(
    user: User,
    transactionId: string,
    renewalDate: Date,
  ) {
    await this.mailerService.sendMail({
      to: user.email,
      subject: '✅ Payment Confirmed – Service Renewed!',
      template: 'payment-success',
      context: {
        name: user.name,
        transactionId,
        renewalDate: renewalDate.toLocaleDateString(),
        packageName: user.paket?.name || 'Unknown Package',
        companyName: 'ABI_ISP',
        supportEmail: 'amartanet578@gmail.com',
        year: new Date().getFullYear(),
      },
    });
  }

  async sendPaymentRejected(user: User, reason: string) {
    await this.mailerService.sendMail({
      to: user.email,
      subject: '❌ Payment Rejected – Action Required',
      template: 'payment-rejected',
      context: {
        name: user.name,
        reason,
        resubmitLink: 'https://yourisp.com/pay',
        supportEmail: 'amartanet578@gmail.com',
        companyName: 'ABI_ISP',
        year: new Date().getFullYear(),
      },
    });
  }
}
