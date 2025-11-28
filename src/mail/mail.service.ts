// src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { User } from '../user/entities/user.entity';
import { DataSource } from 'typeorm';
import { join } from 'path';
import * as fs from 'fs';

@Injectable()
export class MailService {
  private readonly logger = new Logger('MailService');

  constructor(
    private readonly mailerService: MailerService,
    private readonly dataSource: DataSource,
  ) {}

  //------------------------------------------------------
  // UTILITY — CHECK TEMPLATE EXISTS (Dev + Dist)
  //------------------------------------------------------
  private getTemplatePath(template: string): string | null {
    const candidates = [
      // development source folder
      join(process.cwd(), 'src', 'mail', 'templates', `${template}.hbs`),
      // dist folder after build (recommended)
      join(process.cwd(), 'dist', 'mail', 'templates', `${template}.hbs`),
      // fallback locations sometimes used
      join(process.cwd(), 'src', 'templates', `${template}.hbs`),
      join(process.cwd(), 'dist', 'src', 'templates', `${template}.hbs`),
      join(process.cwd(), 'templates', `${template}.hbs`),
    ];

    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return p;
      } catch (err) {
        // ignore fs errors here
      }
    }

    return null;
  }

  //------------------------------------------------------
  // UTILITY — SEND EMAIL WITH FALLBACK
  // - options follows mailerService.sendMail shape
  // - fallbackHtml will be used when template file not found
  //------------------------------------------------------
  private async safeSendMail(options: any, fallbackHtml: string) {
    try {
      const templatePath = this.getTemplatePath(options.template);

      if (!templatePath) {
        this.logger.warn(
          `Template "${options.template}" not found. Sending fallback HTML instead.`,
        );

        // Remove template and use html fallback
        delete options.template;
        options.html = fallbackHtml;
      } else {
        // Template exists — but the global mailer adapter expects a directory,
        // not a file. We only check existence to decide fallback; actual template
        // resolution is handled by MailerModule config.
        this.logger.debug(`Found template file at: ${templatePath}`);
      }

      return await this.mailerService.sendMail(options);
    } catch (err) {
      // Log detailed error but do not rethrow so caller (WA/payment) continues.
      this.logger.error(`Email sending failed (${options.subject}):`, err);
      return null;
    }
  }

  //------------------------------------------------------
  // SEND REMINDER
  //------------------------------------------------------
  async sendSubscriptionReminder(user_id: string, dueDate: Date) {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: user_id },
      relations: { paket: true },
    });

    if (!user || !user.email) {
      this.logger.warn(
        `Skipping sendSubscriptionReminder: user or email not found (user_id=${user_id})`,
      );
      return;
    }

    const fallbackHtml = `
      <h2>Pengingat Langganan</h2>
      <p>Halo ${user.name},</p>
      <p>Langganan Anda akan berakhir pada <b>${dueDate.toLocaleDateString()}</b>.</p>
      <p>Paket: ${user.paket?.name || 'N/A'}</p>
    `;

    await this.safeSendMail(
      {
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
      },
      fallbackHtml,
    );
  }

  //------------------------------------------------------
  // SEND EXPIRED
  //------------------------------------------------------
  async sendExpired(user_id: string, dueDate: Date) {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: user_id },
      relations: { paket: true },
    });

    if (!user || !user.email) {
      this.logger.warn(
        `Skipping sendExpired: user or email not found (user_id=${user_id})`,
      );
      return;
    }

    const fallbackHtml = `
      <h2>Layanan Dinonaktifkan</h2>
      <p>Halo ${user.name},</p>
      <p>Langganan Anda telah berakhir.</p>
      <p>Paket: ${user.paket?.name || 'N/A'}</p>
    `;

    await this.safeSendMail(
      {
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
      },
      fallbackHtml,
    );
  }

  //------------------------------------------------------
  // PAYMENT SUCCESS
  //------------------------------------------------------
  async sendPaymentSuccess(
    user_id: string,
    transactionId: string,
    renewalDate: Date,
  ) {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: user_id },
      relations: { paket: true },
    });

    if (!user || !user.email) {
      this.logger.warn(
        `Skipping sendPaymentSuccess: user or email not found (user_id=${user_id})`,
      );
      return;
    }

    const fallbackHtml = `
      <h2>Pembayaran Berhasil</h2>
      <p>Halo ${user.name},</p>
      <p>Pembayaran Anda telah berhasil diproses.</p>
      <p>ID Transaksi: <b>${transactionId}</b></p>
      <p>Paket: ${user.paket?.name || 'N/A'}</p>
    `;

    await this.safeSendMail(
      {
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
      },
      fallbackHtml,
    );
  }

  //------------------------------------------------------
  // PAYMENT REJECTED
  //------------------------------------------------------
  async sendPaymentRejected(user_id: string, reason: string) {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: user_id },
      relations: { paket: true },
    });

    if (!user || !user.email) {
      this.logger.warn(
        `Skipping sendPaymentRejected: user or email not found (user_id=${user_id})`,
      );
      return;
    }

    const fallbackHtml = `
      <h2>Pembayaran Ditolak</h2>
      <p>Halo ${user.name},</p>
      <p>Alasan: ${reason}</p>
      <p>Silakan lakukan pembayaran ulang.</p>
    `;

    await this.safeSendMail(
      {
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
      },
      fallbackHtml,
    );
  }

async sendWelcomeEmail(
  user_id: string,
  customerId: string,
  paymentId: string
) {
  const user = await this.dataSource.getRepository(User).findOne({
    where: { id: user_id },
    relations: { paket: true },
  });

  const link = `https://mbinet.click/riwayat-transaksi/${paymentId}`;

  const fallbackHtml = `
    <h2>Selamat Datang, ${user.name}!</h2>
    <p>Terima kasih telah bergabung dengan layanan MBI NET.</p>
    <p><b>Customer ID:</b> ${customerId}</p>
    <p><b>ID Pembayaran:</b> ${paymentId}</p>
    <p>Anda dapat melihat detail transaksi di link berikut:</p>
    <a href="${link}">${link}</a>
  `;

  await this.safeSendMail(
    {
      to: user.email,
      subject: '👋 Selamat Datang di MBI NET!',
      template: 'welcome',
      context: {
        name: user.name,
        customerId,
        paymentId,
        link,
        companyName: 'MBI NET',
        supportEmail: 'mbinet5758@gmail.com',
        year: new Date().getFullYear(),
      },
    },
    fallbackHtml
  );
}

}
