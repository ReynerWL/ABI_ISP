// src/menuUI.ts
import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';

@Injectable()
export class MenuUIService {
  private logger = new Logger('MenuUIService');

  async sendMainMenu(client: any, to: string) {
    await client.sendMessage(to, {
      text: '👋 Welcome to ISP Customer Service\nWhat would you like to do?',
      footer: 'Select an option below',
      buttons: [
        {
          buttonId: 'pay',
          buttonText: { displayText: 'Make Payment' },
          type: 1,
        },
        {
          buttonId: 'status',
          buttonText: { displayText: 'Check Status' },
          type: 1,
        },
        {
          buttonId: 'support',
          buttonText: { displayText: 'Contact Support' },
          type: 1,
        },
      ],
      headerType: 1,
    });
  }

  async sendPaymentMenu(client: any, to: string) {
    await client.sendMessage(to, {
      text: '💳 Payment Options',
      footer: 'Select how you want to proceed',
      buttons: [
        {
          buttonId: 'cid',
          buttonText: { displayText: 'Enter Customer ID' },
          type: 1,
        },
        { buttonId: 'cancel', buttonText: { displayText: 'Cancel' }, type: 1 },
      ],
      headerType: 1,
    });
  }

  async sendCustomerVerification(
    client: any,
    to: string,
    name: string,
    packageType: string,
  ) {
    await client.sendMessage(to, {
      text: `✅ Verified Customer\n\nName: ${name}\nPackage: ${packageType}\n\nPlease send your payment proof (screenshot of transaction)`,
      footer: 'Send the image now',
    });
  }

  async sendPaymentSuccess(client: any, to: string) {
    await client.sendMessage(to, {
      text: '🎉 Payment Confirmed!\n\nThank you for your payment. Your service will continue without interruption.\n\nYour subscription is valid until the end of the month.',
      footer: 'ISP Customer Service',
    });
  }

  async sendPaymentRejected(client: any, to: string, reason: string) {
    await client.sendMessage(to, {
      text: `❌ Payment Rejected\n\nReason: ${reason}\n\nPlease send a valid payment proof.`,
      footer: 'Send new payment proof',
    });
  }

  async sendSubscriptionReminder(client: any, to: string, daysLeft: number) {
    await client.sendMessage(to, {
      text: `📅 Subscription Reminder\n\nYour subscription expires in ${daysLeft} day(s).\n\nPlease make your payment before the 1st of next month to avoid service interruption.`,
      footer: 'Reply with PAY to start payment process',
    });
  }

  async sendServiceExpired(client: any, to: string) {
    await client.sendMessage(to, {
      text: `⚠️ Service Suspended\n\nYour subscription has expired. Please make your payment immediately to restore service.\n\nReply with PAY to start payment process`,
      footer: 'Payment required to restore service',
    });
  }
}
