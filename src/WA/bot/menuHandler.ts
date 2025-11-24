// src/WA/bot/menuHandler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { MenuUIService } from './menuUI';
import { UserService } from '../../user/user.service';
import { PaymentService } from '../../payment/payment.service';
import { DataSource } from 'typeorm';
import { MailService } from '../../mail/mail.service';
import { MinioStorageService } from '../../file/minio_storage';
import { JwtService } from '@nestjs/jwt';
import { User } from '#/user/entities/user.entity';
import { Payment } from '#/payment/entities/payment.entity';

@Injectable()
export class MenuHandlerService {
  private logger = new Logger('MenuHandlerService');
  private whatsappClient: any;

  constructor(
    private menuUI: MenuUIService,
    private mailService: MailService,
  ) {}

  // --- NOTIFICATION METHODS ONLY ---
  GlobalClient(client: any) {
    this.whatsappClient = client;
  }
  /**
   * Send subscription renewal reminder via WhatsApp
   */
  async sendSubscriptionReminder(
    client: any,
    customerNumber: string,
    daysLeft: number,
    userId: string,
  ) {
    try {
      const link = `https://mbinet.click/`;

      await this.menuUI.sendSubscriptionReminder(
        client,
        customerNumber,
        daysLeft,
        link,
      );

      this.logger.log(
        `⏰ Reminder sent to ${customerNumber} (${daysLeft} days left)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send reminder to ${customerNumber}`,
        error.stack,
      );
    }
  }

  /**
   * Send payment confirmation via WhatsApp
   */
  async sendPaymentConfirmed(
    customerNumber: string,
    paymentId: string,
    user_id: string,
  ) {
    try {
      await this.menuUI.sendPaymentSuccess(this.whatsappClient, customerNumber, paymentId);

      await this.mailService.sendPaymentSuccess(user_id, paymentId, new Date());

      this.logger.log(
        `✅ Payment confirmed notification sent to ${customerNumber} (Payment: ${paymentId})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send confirmation to ${customerNumber}`,
        error.stack,
      );
    }
  }

  /**
   * Send payment rejection via WhatsApp
   */
  async sendPaymentRejected(
    customerNumber: string,
    reason: string,
    userId: string,
  ) {
    try {
      const link = `https://mbinet.click/`;

      await this.menuUI.sendPaymentRejected(
        this.whatsappClient,
        customerNumber,
        reason,
        link,
      );

      await this.mailService.sendPaymentRejected(userId, reason);

      this.logger.log(
        `❌ Payment rejected notification sent to ${customerNumber} (Reason: ${reason})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send rejection to ${customerNumber}`,
        error.stack,
      );
    }
  }

  /**
   * Send service expired notice
   */
  async sendServiceExpired(
    client: any,
    customerNumber: string,
    userId: string,
  ) {
    try {
      const link = `https://mbinet.click/`;

      await this.menuUI.sendServiceExpired(client, customerNumber, link);

      this.logger.log(`🔴 Service expired notice sent to ${customerNumber}`);
    } catch (error) {
      this.logger.error(
        `Failed to send expired notice to ${customerNumber}`,
        error.stack,
      );
    }
  }

  /**
   * Send welcome message (when user registers)
   */
  async sendWelcomeMessage(
    customerNumber: string,
    userName: string,
    userId: string,
  ) {
    try {
      const link = `https://mbinet.click/`;

      await this.menuUI.sendWelcomeMessage(
        this.whatsappClient,
        customerNumber,
        userName,
        link,
      );

      this.logger.log(`👋 Welcome message sent to ${customerNumber}`);
    } catch (error) {
      this.logger.error(
        `Failed to send welcome message to ${customerNumber}`,
        error.stack,
      );
    }
  }

  /**
   * Send overdue payment reminder
   */
  async sendOverdueReminder(
    client: any,
    customerNumber: string,
    daysOverdue: number,
    userId: string,
  ) {
    try {
      const link = `https://mbinet.click/`;

      await this.menuUI.sendOverduePaymentReminder(
        client,
        customerNumber,
        daysOverdue,
        link,
      );

      this.logger.log(
        `⚠️ Overdue reminder sent to ${customerNumber} (${daysOverdue} days overdue)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send overdue reminder to ${customerNumber}`,
        error.stack,
      );
    }
  }

  /**
   * ✅ Generate a JWT token for secure upload link
   */
  // private async generateUploadToken(userId: string): Promise<string> {
  //   const payload = {
  //     sub: userId,
  //     action: 'upload_payment_proof',
  //     exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // Expires in 24 hours
  //   };

  //   return this.jwtService.sign(payload, {
  //     secret: process.env.JWT_UPLOAD_SECRET!,
  //     algorithm: 'HS256',
  //   });
  // }

  /**
   * Find user by phone number
   */
  // private async findUserByPhone(phoneJid: string): Promise<User | null> {
  //   const phone = phoneJid.replace(/@c\.us$/, '').replace(/\D/g, '');
  //   return await this.dataSource.manager.findOne(User, {
  //     where: { phone_number: phone },
  //     relations: ['paket', 'subscription'],
  //   });
  // }

  // --- REMOVED: All interactive message handlers ---
  // - handleMessage
  // - handleTextMessage
  // - handleAccountStatus
  // - handlePaymentStart
  // - etc.
}