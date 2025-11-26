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

  /**
   * Set global WhatsApp client (whatsapp-web.js)
   */
  setGlobalClient(client: any) {
    this.whatsappClient = client;
  }

  /** ---------------------------------------------------
   * Helper → convert to WhatsApp number format (@c.us)
   * -------------------------------------------------- */
  private toJid(phone: string): string {
    phone = phone.replace(/\D/g, ''); // only digits
    if (!phone.endsWith('@c.us')) {
      return `${phone}@c.us`;
    }
    return phone;
  }

  /** ---------------------------------------------------
   * Send subscription renewal reminder
   * -------------------------------------------------- */
  async sendSubscriptionReminder(
    client: any,
    customerNumber: string,
    daysLeft: number,
    userId: string,
  ) {
    try {
      const jid = this.toJid(customerNumber);
      const link = `https://mbinet.click/`;

      await this.menuUI.sendSubscriptionReminder(client, jid, daysLeft, link);

      this.logger.log(`⏰ Reminder sent to ${jid} (${daysLeft} days left)`);
    } catch (error) {
      this.logger.error(`Failed to send reminder to ${customerNumber}`, error);
    }
  }

  /** ---------------------------------------------------
   * Send payment confirmed notification
   * -------------------------------------------------- */
  async sendPaymentConfirmed(
    customerNumber: string,
    paymentId: string,
    userId: string,
  ) {
    try {
      const jid = this.toJid(customerNumber);

      await this.menuUI.sendPaymentSuccess(this.whatsappClient, jid, paymentId);

      await this.mailService.sendPaymentSuccess(userId, paymentId, new Date());

      this.logger.log(
        `✅ Payment confirmed sent to ${jid} (Payment: ${paymentId})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send confirmation to ${customerNumber}`,
        error,
      );
    }
  }

  /** ---------------------------------------------------
   * Send payment rejected notification
   * -------------------------------------------------- */
  async sendPaymentRejected(
    customerNumber: string,
    reason: string,
    userId: string,
  ) {
    try {
      const jid = this.toJid(customerNumber);
      const link = `https://mbinet.click/`;

      await this.menuUI.sendPaymentRejected(
        this.whatsappClient,
        jid,
        reason,
        link,
      );

      await this.mailService.sendPaymentRejected(userId, reason);

      this.logger.log(`❌ Payment rejected sent to ${jid} (Reason: ${reason})`);
    } catch (error) {
      this.logger.error(`Failed to send rejection to ${customerNumber}`, error);
    }
  }

  /** ---------------------------------------------------
   * Send service expired notification
   * -------------------------------------------------- */
  async sendServiceExpired(
    client: any,
    customerNumber: string,
    userId: string,
  ) {
    try {
      const jid = this.toJid(customerNumber);
      const link = `https://mbinet.click/`;

      await this.menuUI.sendServiceExpired(client, jid, link);

      this.logger.log(`🔴 Service expired notice sent to ${jid}`);
    } catch (error) {
      this.logger.error(
        `Failed to send service expired to ${customerNumber}`,
        error,
      );
    }
  }

  /** ---------------------------------------------------
   * Send Welcome message to new user
   * -------------------------------------------------- */
  async sendWelcomeMessage(
    customerNumber: string,
    userName: string,
    userId: string,
  ) {
    try {
      const jid = this.toJid(customerNumber);
      const link = `https://mbinet.click/`;

      await this.menuUI.sendWelcomeMessage(
        this.whatsappClient,
        jid,
        userName,
        link,
      );

      this.logger.log(`👋 Welcome message sent to ${jid}`);
    } catch (error) {
      this.logger.error(
        `Failed to send welcome message to ${customerNumber}`,
        error,
      );
    }
  }

  /** ---------------------------------------------------
   * Send overdue payment reminder
   * -------------------------------------------------- */
  async sendOverdueReminder(
    client: any,
    customerNumber: string,
    daysOverdue: number,
    userId: string,
  ) {
    try {
      const jid = this.toJid(customerNumber);
      const link = `https://mbinet.click/`;

      await this.menuUI.sendOverduePaymentReminder(
        client,
        jid,
        daysOverdue,
        link,
      );

      this.logger.log(
        `⚠️ Overdue reminder sent to ${jid} (${daysOverdue} days overdue)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send overdue reminder to ${customerNumber}`,
        error,
      );
    }
  }
}
