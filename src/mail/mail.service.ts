// src/mail/mail.service.ts
import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { User } from '../user/entities/user.entity';
import { DataSource } from 'typeorm';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService, private dataSource: DataSource) {}

  async sendSubscriptionReminder(user_id: string, dueDate: Date) {
    const user = await this.dataSource.getRepository(User).findOne({where: {id: user_id}, relations:{paket:true}})
    await this.mailerService.sendMail({
      to: user.email,
      subject: '🔔 Subscription Reminder – Payment Due Soon',
      template: 'reminder',
      context: {
        name: user.name,
        packageName: user.paket?.name || 'Unknown Package',
        dueDate: dueDate.toLocaleDateString(),
        supportEmail: 'mbinet5758@gmail.com',
        companyName: 'MBI NET',
        year: new Date().getFullYear(),
      },
    });
  }

    async sendExpired(user_id: string, dueDate: Date) {
    const user = await this.dataSource.getRepository(User).findOne({where: {id: user_id}, relations:{paket:true}})
    await this.mailerService.sendMail({
      to: user.email,
      subject: '🔔 Subscription Expired – Please Renew',
      template: 'expired',
      context: {
        name: user.name,
        packageName: user.paket?.name || 'Unknown Package',
        dueDate: dueDate.toLocaleDateString(),
        supportEmail: 'mbinet5758@gmail.com',
        companyName: 'MBI NET',
        year: new Date().getFullYear(),
      },
    });
  }

  async sendPaymentSuccess(
    user_id: string,
    transactionId: string,
    renewalDate: Date,
  ) {
    const user = await this.dataSource.getRepository(User).findOne({where: {id: user_id}, relations:{paket:true}})
    await this.mailerService.sendMail({
      to: user.email,
      subject: '✅ Payment Confirmed – Service Renewed!',
      template: 'payment-success',
      context: {
        name: user.name,
        transactionId,
        renewalDate: renewalDate.toLocaleDateString(),
        packageName: user.paket?.name || 'Unknown Package',
        companyName: 'MBI NET',
        supportEmail: 'mbinet5758@gmail.com',
        year: new Date().getFullYear(),
      },
    });
  }

  async sendPaymentRejected(user_id: string, reason: string) {
    const user = await this.dataSource.getRepository(User).findOne({where: {id: user_id}, relations:{paket:true}})
    await this.mailerService.sendMail({
      to: user.email,
      subject: '❌ Payment Rejected – Action Required',
      template: 'payment-rejected',
      context: {
        name: user.name,
        reason,
        resubmitLink: `https://mbinet.click/riwayat-transaksi`,
        supportEmail: 'mbinet5758@gmail.com',
        companyName: 'MBI NET',
        year: new Date().getFullYear(),
      },
    });
  }
}
