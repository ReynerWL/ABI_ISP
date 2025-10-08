// src/WA/bot/menuHandler.service.ts
import { Injectable } from '@nestjs/common';
import { MenuUIService } from './menuUI';
import { UserService } from '../../user/user.service';
import { PaymentService } from '../../payment/payment.service';
import { DataSource } from 'typeorm';
import { Subscription } from '../../subscription/entities/subscription.entity';
import { MailService } from '../../mail/mail.service';
import { MinioStorageService } from '../../file/minio_storage';
import { Logger } from '@nestjs/common';
import { User } from '#/user/entities/user.entity';
import { CreatePaymentDto } from '#/payment/dto/create-payment.dto';

@Injectable()
export class MenuHandlerService {
  private logger = new Logger('MenuHandlerService');
  private userStates = new Map<
    string,
    { stage: string; userId?: string; customerId?: string }
  >();

  constructor(
    private userService: UserService,
    private paymentService: PaymentService,
    private menuUI: MenuUIService,
    private mailService: MailService,
    private minioService: MinioStorageService,
    private dataSource: DataSource,
  ) {}

  async handleMessage(client: any, customerNumber: string, msg: any) {
    try {
      // Handle text messages
      if (msg.message?.conversation) {
        const text = msg.message.conversation.trim().toLowerCase();
        await this.handleTextMessage(client, customerNumber, text);
        return;
      }

      // Handle image uploads (payment proof)
      if (msg.message?.imageMessage) {
        await this.handlePaymentProof(client, customerNumber, msg);
        return;
      }

      // Default fallback
      await this.menuUI.sendMainMenu(client, customerNumber);
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

  private async handleTextMessage(
    client: any,
    customerNumber: string,
    text: string,
  ) {
    const userState = this.userStates.get(customerNumber);

    // Normalize input
    const is = (...values: string[]) => values.some((v) => text === v);
    const startsWith = (...values: string[]) =>
      values.some((v) => text.startsWith(v));

    // --- Ongoing Flow ---
    if (userState) {
      switch (userState.stage) {
        case 'awaiting_cid_or_proof':
          if (startsWith('cid')) {
            await this.handleCustomerId(client, customerNumber, text);
          } else {
            await client.sendMessage(customerNumber, {
              text: 'ℹ️ Please enter your Customer ID (e.g., CID12345) first.',
            });
          }
          return;

        default:
          break;
      }
      return;
    }

    // --- Main Menu Logic ---
    if (is('1', 'status', 'account', 'cek status')) {
      await this.handleAccountStatus(client, customerNumber);
      return;
    }

    if (is('2', 'pay', 'payment', 'bayar', 'upload')) {
      await this.menuUI.sendPaymentMenu(client, customerNumber);
      this.userStates.set(customerNumber, { stage: 'awaiting_cid_or_proof' });
      return;
    }

    if (is('3', 'support', 'help', 'cs', 'kontak')) {
      await this.menuUI.sendSupportContact(client, customerNumber);
      return;
    }

    if (is('main', 'menu', 'start', 'home')) {
      await this.menuUI.sendMainMenu(client, customerNumber);
      return;
    }

    // Unknown command → show main menu
    await this.menuUI.sendMainMenu(client, customerNumber);
  }

  private async handleAccountStatus(client: any, customerNumber: string) {
    const user = await this.findUserByPhone(customerNumber);
    if (!user) {
      await client.sendMessage(customerNumber, {
        text: '❌ We could not find your account. Please contact support.',
      });
      return;
    }

    await this.menuUI.sendAccountStatus(
      client,
      customerNumber,
      user.name,
      user.paket?.name || 'Standard',
      user.status,
      user.subscription?.due_date,
    );
  }

  private async findUserByPhone(phoneJid: string): Promise<User | null> {
    const phone = phoneJid.replace(/@c\.us$/, '').replace(/\D/g, '');
    return await this.dataSource.manager.findOne(User, {
      where: { phone_number: phone },
      relations: ['paket', 'subscription'],
    });
  }

  private async handleCustomerId(
    client: any,
    customerNumber: string,
    text: string,
  ) {
    const match = text.match(/cid(\d+)/i);
    if (!match) {
      await client.sendMessage(customerNumber, {
        text: '❌ Invalid format. Please enter your Customer ID like CID12345.',
      });
      return;
    }

    const customerId = match[1];
    const user = await this.dataSource.manager.findOne(User, {
      where: { customerId },
      relations: ['paket'],
    });

    if (!user) {
      await client.sendMessage(customerNumber, {
        text: '❌ Customer ID not found. Please check and try again.',
      });
      return;
    }

    // Verify phone number
    const userPhone = user.phone_number?.replace(/\D/g, '') || '';
    const senderPhone = customerNumber
      .replace(/@c\.us$/, '')
      .replace(/\D/g, '');

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

private async handlePaymentProof(
  client: any,
  customerNumber: string,
  msg: any,
) {
  const userState = this.userStates.get(customerNumber);

  if (
    !userState ||
    userState.stage !== 'awaiting_proof' ||
    !userState.userId
  ) {
    await client.sendMessage(customerNumber, {
      text: '❌ Please start the payment process first. Reply with PAY to begin.',
    });
    return;
  }

  await client.sendMessage(customerNumber, {
    text: '🔄 Processing payment proof... Uploading image.',
  });

  try {
    // Download image buffer
    const imageBuffer = await client.downloadMediaMessage(msg);
    const originalFileName =
      msg.message.imageMessage.fileName || 'bukti-pembayaran.jpg';
    const sanitizedFileName = `${Date.now()}_${customerNumber.replace(/@c\.us/, '')}_${originalFileName}`;

    // Upload to MinIO
    const fileUrl = await this.minioService.uploadBuffer(
      imageBuffer,
      sanitizedFileName,
    );
    this.logger.log(`Image uploaded to MinIO: ${fileUrl}`);

    // Find latest subscription
    const latestSubscription = await this.dataSource.manager.findOne(Subscription, {
      where: { user: { id: userState.userId } },
      relations: ['pakets', 'banks'],
      order: { createdAt: 'DESC' },
    });

    let startDate: Date;
    let dueDate: Date;

    if (!latestSubscription || latestSubscription.due_date < new Date()) {
      // 🆕 First-time or expired → Start today
      startDate = new Date();
      dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + 30); // 30 days from today
    } else {
      // 🔁 Renewal → Start after old due date
      startDate = new Date(latestSubscription.due_date);
      dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + 30); // 30 days from previous end
    }

    // Create payment record
    const paymentData: CreatePaymentDto = {
      usersId: userState.userId,
      buktiPembayaran: fileUrl,
      status: 'PENDING',
      price: latestSubscription?.pakets[0]?.price || null,
      reason: '',
      paketsId: latestSubscription?.pakets[0]?.id || null,
      banksId: latestSubscription?.banks?.id || null,
      start_date: startDate,
      due_date: dueDate,
    };

    const payment = await this.paymentService.create(paymentData);
    this.userStates.delete(customerNumber);

    // Confirm to user
    await client.sendMessage(customerNumber, {
      text: `✅ Payment proof received!\n\nYour payment is being verified.\nPayment ID: ${payment.id}\nExpected response within 24 hours.`,
    });

    // Notify admin via email
    const user = await this.userService.findOne(userState.userId);
    if (user?.email) {
      await this.mailService.sendPaymentSuccess(user, payment.id, new Date());
    }

    this.logger.log(
      `Payment proof saved for user ${userState.userId}. URL: ${fileUrl}`,
    );
  } catch (error) {
    this.logger.error(
      `Failed to upload payment proof from ${customerNumber}`,
      error.stack,
    );
    await client.sendMessage(customerNumber, {
      text: '❌ Failed to upload image. Please try sending the screenshot again.',
    });
  }
}
}
