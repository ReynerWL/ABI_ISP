// src/menuHandler.ts
import { Injectable } from '@nestjs/common';
import { MenuUIService } from './menuUI';
import { Logger } from '@nestjs/common';
import { UserService } from '#/user/user.service';
import { PaymentService } from '#/payment/payment.service';

@Injectable()
export class MenuHandlerService {
  private logger = new Logger('MenuHandlerService');
  private userStates = new Map<
    string,
    { stage: string; customerId?: string }
  >();

  constructor(
    private usersService: UserService,
    private paymentsService: PaymentService,
    private menuUI: MenuUIService,
  ) {}

  async handleMessage(client: any, customerNumber: string, msg: any) {
    try {
      // Handle button responses
      if (msg.message?.buttonsResponseMessage) {
        const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
        await this.handleButtonResponse(client, customerNumber, buttonId);
        return;
      }

      // Remove or comment out list handling if not used
      // if (msg.message?.listResponseMessage) { ... }

      // Handle text messages
      if (msg.message?.conversation) {
        const text = msg.message.conversation.trim().toLowerCase();

        if (text === 'pay' || text.includes('pay')) {
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
      this.logger.error(
        `Error handling message from ${customerNumber}`,
        error.stack,
      );
      await client.sendMessage(customerNumber, {
        text: '❌ An error occurred. Please try again later or contact support.',
      });
    }
  }

  private async handleButtonResponse(
    client: any,
    customerNumber: string,
    buttonId: string,
  ) {
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

  private async handleCustomerId(
    client: any,
    customerNumber: string,
    text: string,
  ) {
    const customerId = text.replace(/\D/g, '');
    if (!customerId || customerId.length < 5) {
      await client.sendMessage(customerNumber, {
        text: '❌ Invalid Customer ID format. Please enter a valid ID (e.g., CID12345)',
      });
      return;
    }

    const user = await this.usersService.findOne(customerId);

    if (!user) {
      await client.sendMessage(customerNumber, {
        text: '❌ Customer ID not found. Please check and try again.',
      });
      return;
    }

    if (
      user.phone_number.replace(/\D/g, '') !==
      customerNumber.replace(/@c\.us$/, '').replace(/\D/g, '')
    ) {
      await client.sendMessage(customerNumber, {
        text: '❌ Phone number mismatch. This Customer ID is registered to a different number.',
      });
      return;
    }

    this.userStates.set(customerNumber, {
      stage: 'awaiting_proof',
      customerId: `CID${customerId}`,
    });

    await this.menuUI.sendCustomerVerification(
      client,
      customerNumber,
      user.name,
      user.paket?.name,
    );
  }

  private async handlePaymentProof(
    client: any,
    customerNumber: string,
    msg: any,
  ) {
    const userState = this.userStates.get(customerNumber);

    if (
      !userState ||
      userState.stage !== 'awaiting_proof' ||
      !userState.customerId
    ) {
      await client.sendMessage(customerNumber, {
        text: '❌ Please start the payment process first. Reply with PAY to begin.',
      });
      return;
    }

    await client.sendMessage(customerNumber, {
      text: '🔄 Processing payment proof... Please wait.',
    });

    try {
      // Get image buffer
      const imageBuffer = await client.downloadMediaMessage(msg);

      // Create payment record
      const payment = await this.paymentsService.createPayment({
        customerId: userState.customerId,
        proofImage: imageBuffer,
        status: 'pending',
      });

      this.userStates.delete(customerNumber);

      await client.sendMessage(customerNumber, {
        text: '✅ Payment proof received!\n\nYour payment is now being verified. You will receive a confirmation within 24 hours.',
      });
    } catch (error) {
      this.logger.error(
        `Failed to process payment proof from ${customerNumber}`,
        error.stack,
      );
      await client.sendMessage(customerNumber, {
        text: '❌ Failed to process payment proof. Please try sending the image again.',
      });
    }
  }
}
