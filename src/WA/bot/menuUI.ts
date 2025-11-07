// src/WA/bot/menuUI.service.ts
import { UserStatus } from '#/user/entities/user.entity';
import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';

@Injectable()
export class MenuUIService {
  private logger = new Logger('MenuUIService');

  /**
   * Send subscription renewal reminder
   */
  async sendSubscriptionReminder(
    client: any,
    to: string,
    daysLeft: number,
    uploadLink: string, // ✅ Add the upload link
  ) {
    await client.sendMessage(to, {
      text: `📅 Subscription Reminder\n\nYour subscription expires in ${daysLeft} day(s).\n\nTo avoid disconnection:\n1. Prepare your payment\n2. Upload proof using this link: ${uploadLink}\n\nYour service will remain active after successful verification.`,
    });
  }

  /**
   * Send service expired notice
   */
  async sendServiceExpired(client: any, to: string, uploadLink: string) {
    await client.sendMessage(to, {
      text: `⚠️ Service Suspended\n\nYour subscription has expired. Please renew immediately.\n\nUpload payment proof: ${uploadLink}\n\nYour service will be restored within 24 hours after verification.`,
    });
  }

  /**
   * Send payment confirmation success
   */
  async sendPaymentSuccess(client: any, to: string, transactionId: string) {
    await client.sendMessage(to, {
      text: `🎉 Payment Confirmed!\n\nTransaction ID: ${transactionId}\n\nYour service has been restored. Thank you for your payment!\n\nNeed help? Contact us anytime.`,
    });
  }

  /**
   * Send payment rejection notice
   */
  async sendPaymentRejected(client: any, to: string, reason: string, uploadLink: string) {
    await client.sendMessage(to, {
      text: `❌ Payment Rejected\n\nReason: ${reason}\n\nPlease resubmit a valid payment proof using this link: ${uploadLink}\n\nContact support if you need assistance.`,
    });
  }

  /**
   * Send account status summary (when triggered by admin/system)
   */
  async sendAccountStatus(
    client: any,
    to: string,
    name: string,
    paket: string,
    status: UserStatus,
    dueDate?: Date,
  ) {
    const statusMsg =
      status === UserStatus.AKTIF
        ? '🟢 Active – Internet is working'
        : status === UserStatus.NONAKTIF
          ? '🔴 Expired – Payment overdue'
          : '🟠 Blocked – Contact admin';

    const due = dueDate ? dueDate.toLocaleDateString() : 'End of month';

    await client.sendMessage(to, {
      text: `📊 Account Status Update\n\nName: ${name}\nPackage: ${paket}\nStatus: ${statusMsg}\nRenewal Date: ${due}\n\nQuestions? Contact support.`,
    });
  }

  /**
   * Send support contact info (when triggered by system)
   */
  async sendSupportContact(client: any, to: string) {
    await client.sendMessage(to, {
      text: `📞 Need Help?\n\nContact our support team:\n\n📱 WhatsApp: wa.me/6281234567890\n📧 Email: support@yourisp.com\n🕐 Hours: Mon-Fri, 8 AM - 5 PM`,
    });
  }

  /**
   * Send welcome message (when user first registers, triggered by system)
   */
  async sendWelcomeMessage(client: any, to: string, name: string, uploadLink: string) {
    await client.sendMessage(to, {
      text: `👋 Welcome, ${name}!\n\nThank you for choosing YourISP.\n\nTo activate your service:\n1. Make your payment\n2. Upload proof here: ${uploadLink}\n\nEnjoy fast internet!`,
    });
  }

  /**
   * Send payment reminder for overdue invoices
   */
  async sendOverduePaymentReminder(
    client: any,
    to: string,
    daysOverdue: number,
    uploadLink: string,
  ) {
    await client.sendMessage(to, {
      text: `⚠️ Overdue Payment Alert\n\nYour payment is ${daysOverdue} day(s) overdue.\n\nTo prevent service interruption:\n1. Pay immediately\n2. Upload proof: ${uploadLink}\n\nAct now to avoid disconnection.`,
    });
  }
}