// src/WA/bot/menuHandler.ts
import { Injectable } from '@nestjs/common';
import { MenuUIService } from './menuUI';
import { UserService } from '../../user/user.service';
import { PaymentService } from '../../payment/payment.service';
import { DataSource } from 'typeorm';
import { Subscription } from '../../subscription/entities/subscription.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { MailService } from '../../mail/mail.service'; // ✅ Email integration
import { Logger } from '@nestjs/common';
import { User } from '#/user/entities/user.entity';
import { CreatePaymentDto } from '#/payment/dto/create-payment.dto';

@Injectable()
export class MenuHandlerService {
  private logger = new Logger('MenuHandlerService');
  private userStates = new Map<string, { stage: string; userId?: string; customerId?: string }>();

  constructor(
    private userService: UserService,
    private paymentService: PaymentService,
    private menuUI: MenuUIService,
    private mailService: MailService, // ✅ Inject MailService
    private dataSource: DataSource,
  ) {}

  async handleMessage(client: any, customerNumber: string, msg: any) {
    try {
      // Handle button responses
      if (msg.message?.buttonsResponseMessage) {
        const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
        await this.handleButtonResponse(client, customerNumber, buttonId);
        return;
      }

      // Handle text messages
      if (msg.message?.conversation) {
        const text = msg.message.conversation.trim();

        if (text.toLowerCase() === 'pay') {
          await this.menuUI.sendPaymentMenu(client, customerNumber);
          this.userStates.set(customerNumber, { stage: 'awaiting_cid' });
          return;
        }

        const userState = this.userStates.get(customerNumber);
        if (userState?.stage === 'awaiting_cid') {
          await this.handleCustomerId(client, customerNumber, text);
          return;
        }
      }

      // Handle image uploads (payment proof)
      if (msg.message?.imageMessage) {
        await this.handlePaymentProof(client, customerNumber, msg);
      }
    } catch (error) {
      this.logger.error(`Error handling message from ${customerNumber}`, error.stack);
      await client.sendMessage(customerNumber, {
        text: '❌ An error occurred. Please try again later or contact support.',
      });
    }
  }

  private async handleButtonResponse(client: any, customerNumber: string, buttonId: string) {
    switch (buttonId) {
      case 'pay':
        await this.menuUI.sendPaymentMenu(client, customerNumber);
        this.userStates.set(customerNumber, { stage: 'awaiting_cid' });
        break;
      case 'cid':
        await client.sendMessage(customerNumber, {
          text: '🆔 Please enter your Customer ID (e.g., CID12345):',
        });
        this.userStates.set(customerNumber, { stage: 'awaiting_cid' });
        break;
      case 'cancel':
        await this.menuUI.sendMainMenu(client, customerNumber);
        this.userStates.delete(customerNumber);
        break;
      default:
        await this.menuUI.sendMainMenu(client, customerNumber);
    }
  }

  private async handleCustomerId(client: any, customerNumber: string, text: string) {
    const match = text.match(/cid(\d+)/i);
    if (!match) {
      await client.sendMessage(customerNumber, {
        text: '❌ Invalid format. Please enter your Customer ID like CID12345.',
      });
      return;
    }

    const customerId = match[1];
    const user = await this.dataSource.manager.findOne(User, {
      where: { customerId: customerId },
      relations: ['paket'],
    });

    if (!user) {
      await client.sendMessage(customerNumber, {
        text: '❌ Customer ID not found. Please check and try again.',
      });
      return;
    }

    // Normalize phone numbers
    const userPhone = user.phone_number?.replace(/\D/g, '') || '';
    const senderPhone = customerNumber.replace(/@c\.us$/, '').replace(/\D/g, '');

    if (userPhone !== senderPhone) {
      await client.sendMessage(customerNumber, {
        text: '❌ Phone number mismatch. This Customer ID is registered to a different number.',
      });
      return;
    }

    this.userStates.set(customerNumber, {
      stage: 'awaiting_proof',
      userId: user.id,
      customerId: user.customerId,
    });

    await this.menuUI.sendCustomerVerification(
      client,
      customerNumber,
      user.name,
      user.paket?.name || 'Unknown Package',
    );
  }

  private async handlePaymentProof(client: any, customerNumber: string, msg: any) {
    const userState = this.userStates.get(customerNumber);

    if (!userState || userState.stage !== 'awaiting_proof' || !userState.userId) {
      await client.sendMessage(customerNumber, {
        text: '❌ Please start the payment process first. Reply with PAY to begin.',
      });
      return;
    }

    await client.sendMessage(customerNumber, {
      text: '🔄 Processing payment proof... Please wait.',
    });

    try {
      // Download image
      const imageBuffer = await client.downloadMediaMessage(msg);

      // Find latest subscription
      const subscription = await this.dataSource.manager.findOne(Subscription, {
        where: { user: { id: userState.userId } },
        relations: ['paket', 'bank'],
        order: { createdAt: 'DESC' },
      });

      if (!subscription) {
        await client.sendMessage(customerNumber, {
          text: '❌ No active subscription found. Please contact support.',
        });
        return;
      }

      // Create payment
      const paymentData: CreatePaymentDto = {
        usersId: userState.userId,
        buktiPembayaran: imageBuffer,
        status: 'pending',
        price: subscription.pakets[0]?.price || '',
        reason: '',
        paketsId: subscription.pakets[0]?.id || null,
        banksId: subscription.banks?.id || null,
      };

      const payment = await this.paymentService.create(paymentData);

      this.userStates.delete(customerNumber);

      // Send confirmation
      await client.sendMessage(customerNumber, {
        text: `✅ Payment proof received!\n\nYour payment is being verified.\nPayment ID: ${payment.id}\nExpected response within 24 hours.`,
      });

      // ✅ Send email notification to admin or user
      const user = await this.userService.findOne(userState.userId);
      if (user?.email) {
        await this.mailService.sendPaymentSuccess(user, payment.id, new Date());
      }

      this.logger.log(`Payment proof received from ${customerNumber}, Payment ID: ${payment.id}`);
    } catch (error) {
      this.logger.error(`Failed to process payment proof from ${customerNumber}`, error.stack);
      await client.sendMessage(customerNumber, {
        text: '❌ Failed to process payment proof. Please try sending the image again.',
      });
    }
  }
}