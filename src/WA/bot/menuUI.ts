// src/WA/bot/menuUI.service.ts
import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';

@Injectable()
export class MenuUIService {
  private logger = new Logger('MenuUIService');

  // Main menu: numbered options
  async sendMainMenu(client: any, to: string) {
    await client.sendMessage(to, {
      text: `👋 Welcome to ISP Customer Service\n\nWhat would you like to do? Reply with:\n\n1️⃣ Account Status\n2️⃣ Pay / Upload Payment Proof\n3️⃣ Contact Support`,
    });
  }

  // Payment menu
  async sendPaymentMenu(client: any, to: string) {
    await client.sendMessage(to, {
      text: `💳 Make a Payment\n\nPlease reply with:\n\n📄 Enter your Customer ID (e.g., CID12345)\n📸 Or send your payment screenshot directly`,
    });
  }

  // After CID verification
  async sendCustomerVerification(
    client: any,
    to: string,
    name: string,
    packageType: string,
  ) {
    await client.sendMessage(to, {
      text: `✅ Verified: ${name}\n📦 Package: ${packageType}\n\n📌 Please send your payment proof (screenshot of transaction) now.`,
    });
  }

  // Success message
  async sendPaymentSuccess(client: any, to: string) {
    await client.sendMessage(to, {
      text: `🎉 Payment Confirmed!\n\nThank you for your payment. Your service will continue without interruption.\n\nYour subscription is valid until the end of the month.`,
    });
  }

  // Rejected
  async sendPaymentRejected(client: any, to: string, reason: string) {
    await client.sendMessage(to, {
      text: `❌ Payment Rejected\n\nReason: ${reason}\n\nPlease send a valid payment proof (e.g., bank transfer screenshot).`,
    });
  }

  // Reminder
  async sendSubscriptionReminder(client: any, to: string, daysLeft: number) {
    await client.sendMessage(to, {
      text: `📅 Subscription Reminder\n\nYour subscription expires in ${daysLeft} day(s).\n\nPlease make your payment before the 1st of next month to avoid disconnection.\n\nReply with PAY to start payment process.`,
    });
  }

  // Expired
  async sendServiceExpired(client: any, to: string) {
    await client.sendMessage(to, {
      text: `⚠️ Service Suspended\n\nYour subscription has expired. Please make your payment immediately to restore service.\n\nReply with PAY to start payment process.`,
    });
  }

  // Account status
  async sendAccountStatus(
    client: any,
    to: string,
    name: string,
    paket: string,
    status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'BANNED' | 'NEW',
    dueDate?: Date,
  ) {
    const statusMsg =
      status === 'ACTIVE'
        ? '🟢 Active – Internet is working'
        : status === 'INACTIVE'
        ? '🔴 Expired – Payment overdue'
        : '🟠 Blocked – Contact admin';

    const due = dueDate ? dueDate.toLocaleDateString() : 'End of month';

    await client.sendMessage(to, {
      text: `📊 Account Status\n\nName: ${name}\nPackage: ${paket}\nStatus: ${statusMsg}\nRenewal Date: ${due}\n\nNeed help? Reply with SUPPORT.`,
    });
  }

  // Support contact
  async sendSupportContact(client: any, to: string) {
    await client.sendMessage(to, {
      text: `📞 Customer Support\n\nFor assistance, contact us via:\n\n📱 WhatsApp: wa.me/6281234567890\n📧 Email: support@abiisp.com\n🕘 Hours: Mon-Fri, 8 AM - 5 PM\n\nWe'll respond as soon as possible.`,
    });
  }

  // Prompt for Customer ID
  async askForCustomerId(client: any, to: string) {
    await client.sendMessage(to, {
      text: `🆔 Please enter your Customer ID (e.g., CID12345) so we can verify your account.`,
    });
  }
}