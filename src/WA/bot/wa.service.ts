// src/WA/bot/wa.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Between, DataSource, LessThan } from 'typeorm';
import { MailService } from '#/mail/mail.service';
import { UserStatus } from '#/user/entities/user.entity';
import { SessionService } from './session.service';

@Injectable()
export class WhatsAppService {
  private client: Client | null = null;
  private static globalClient: Client | null = null;

  private qrCodeDataUrl: string | null = null;
  private connected = false;
  private starting = false;
  private reconnecting = false;

  private logger = new Logger('WhatsAppService');

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    private readonly sessionSvc: SessionService,
  ) {}

  /*=======================================================
   * GLOBAL CLIENT SET/GET
   *=======================================================*/
  static setGlobalClient(client: Client) {
    this.globalClient = client;
  }

  static getGlobalClient(): Client | null {
    return this.globalClient;
  }

  private getClient(): Client {
    const wa = WhatsAppService.getGlobalClient();
    if (!wa) throw new Error('Global WhatsApp client not ready');
    return wa;
  }

  /*=======================================================
   * JID NORMALIZATION
   *=======================================================*/
  private toJid(phone: string): string {
    if (!phone) throw new Error('Phone number empty');

    phone = phone.replace(/\D/g, '');

    if (phone.startsWith('62')) return `${phone}@c.us`;
    if (phone.startsWith('0')) return `62${phone.substring(1)}@c.us`;
    if (/^[1-9]\d{7,14}$/.test(phone)) return `62${phone}@c.us`;

    if (phone.endsWith('@c.us')) return phone;

    throw new Error(`Invalid phone number: ${phone}`);
  }

  /*=======================================================
   * BASIC INFO
   *=======================================================*/
  getQrCode() {
    return this.qrCodeDataUrl;
  }

  getStatus() {
    return {
      connected: this.connected,
      qrAvailable: !!this.qrCodeDataUrl,
      isLoggedOut: !this.connected && !this.qrCodeDataUrl,
    };
  }

  /*=======================================================
   * START BOT
   *=======================================================*/
  async startBot(): Promise<void> {
    if (this.starting) return;
    this.starting = true;

    try {
      this.logger.log('🚀 Starting WhatsApp client...');

      // destroy client lama (tanpa hapus session)
      if (this.client) {
        try {
          await this.client.destroy();
        } catch {}
        this.client = null;
      }

      this.client = new Client({
        authStrategy: new LocalAuth({ clientId: 'main' }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--single-process',
            '--no-zygote',
          ],
        },
      });

      /* QR */
      this.client.on('qr', async (qr) => {
        this.qrCodeDataUrl = await qrcode.toDataURL(qr);
        this.logger.log('📌 QR Ready');
      });

      /* READY */
      this.client.on('ready', () => {
        this.logger.log('✅ WhatsApp READY');
        this.connected = true;
        this.qrCodeDataUrl = null;

        WhatsAppService.setGlobalClient(this.client);
      });

      /* AUTH EVENTS */
      this.client.on('authenticated', () => {
        this.logger.log('🔐 Authenticated');
      });

      this.client.on('auth_failure', () => {
        this.logger.error('❌ Authentication Failed');
        this.qrCodeDataUrl = null;
      });

      /* DISCONNECT */
      this.client.on('disconnected', async (reason) => {
        this.logger.warn(`⚠️ Disconnected: ${reason}`);

        const wasConnected = this.connected;
        this.connected = false;
        this.qrCodeDataUrl = null;

        if (this.reconnecting) return;
        this.reconnecting = true;

        try {
          await this.client?.destroy().catch(() => {});

          // ⚠️ Hanya hapus session jika WA sendiri memicu logout
          if (reason === 'LOGOUT') {
            this.logger.warn('🗑 WA requested logout → Clearing session');
            await this.sessionSvc.clearAuthState().catch(() => {});
          } else {
            this.logger.warn('🔄 Not clearing session (normal disconnect)');
          }

          setTimeout(() => this.startBot(), 1200);
        } finally {
          this.reconnecting = false;
        }
      });

      await this.client.initialize();
    } catch (err) {
      this.logger.error('WA Start Error:', err);
    } finally {
      this.starting = false;
    }
  }

  async logout() {
    this.logger.log('🚪 Logout requested...');

    try {
      if (this.client) {
        // clear auth
        try {
          await (this.client as any)?.authStrategy?.logout();
        } catch {}

        try {
          await this.client.destroy();
        } catch {}

        this.client = null;
      }

      this.connected = false;
      this.qrCodeDataUrl = null;
      this.logger.log('Logout complete.');

      // restart untuk QR baru
      setTimeout(() => this.startBot(), 1000);
    } catch (err) {
      this.logger.error('Logout error:', err);
    }
  }

  /*=======================================================
   * SEND MESSAGE (GLOBAL CLIENT ALWAYS USED)
   *=======================================================*/
  async sendMessage(to: string, message: string) {
    const wa = this.getClient();

    const jid = to.includes('@') ? to : `${to}@c.us`;

    return wa.sendMessage(jid, message);
  }

  /*=======================================================
   * PAYMENT CONFIRMED
   *=======================================================*/
  async sendPaymentConfirmed(phone: string, paymentId: string, userId: string) {
    const wa = this.getClient();

    try {
      const jid = this.toJid(phone);

      await wa.sendMessage(jid, this.buildPaymentSuccess(paymentId));
      await this.mailService.sendPaymentSuccess(userId, paymentId, new Date());

      this.logger.log(`Payment confirmed → ${jid}`);
    } catch (err) {
      this.logger.error('Failed send payment-confirm WA:', err);
      console.log(err);
    }
  }

  /*=======================================================
   * PAYMENT REJECTED
   *=======================================================*/
  async sendPaymentRejected(phone: string, reason: string, userId: string) {
    const wa = this.getClient();

    try {
      const jid = this.toJid(phone);
      const text = this.buildPaymentRejected(
        reason,
        'https://mbinet.click/riwayat-transaksi',
      );

      await wa.sendMessage(jid, text);
      await this.mailService.sendPaymentRejected(userId, reason);

      this.logger.log(`Payment rejected → ${jid}`);
    } catch (err) {
      this.logger.error('Failed send payment-reject WA:', err);
    }
  }

  /*=======================================================
   * SERVICE EXPIRED
   *=======================================================*/
  async sendExpired(phone: string, userId: string) {
    const wa = this.getClient();

    try {
      const jid = this.toJid(phone);

      await wa.sendMessage(
        jid,
        this.buildServiceExpired('https://mbinet.click/riwayat-transaksi'),
      );
      await this.mailService.sendExpired(userId, new Date());

      this.logger.log(`Expired notice → ${jid}`);
    } catch (err) {
      this.logger.error('Failed send expired WA:', err);
    }
  }

  /*=======================================================
   * SUBSCRIPTION REMINDER
   *=======================================================*/
  async sendReminder(phone: string, days: number, userId: string) {
    const wa = this.getClient();

    try {
      const jid = this.toJid(phone);

      await wa.sendMessage(
        jid,
        this.buildSubscriptionReminder(
          days,
          'https://mbinet.click/riwayat-transaksi',
        ),
      );
      await this.mailService.sendSubscriptionReminder(userId, new Date());

      this.logger.log(`Reminder ${days} days → ${jid}`);
    } catch (err) {
      this.logger.error('Failed send reminder WA:', err);
    }
  }

  async sendWelcomeMessage(
    phone: string,
    name: string,
    customerId: string,
    paymentId: string,
  ) {
    const wa = this.getClient();
    if (!wa) {
      this.logger.warn('WA client not ready');
      return;
    }

    try {
      const jid = this.toJid(phone);
      const link = `https://mbinet.click/riwayat-transaksi`;

      const message = this.buildWelcomeMessage(
        name,
        customerId,
        paymentId,
        link,
      );

      await wa.sendMessage(jid, message);

      await this.mailService.sendWelcomeEmail(customerId, paymentId);

      this.logger.log(`Welcome message sent → ${jid}`);
    } catch (err) {
      this.logger.error('Failed to send welcome message:', err);
    }
  }

  async sendMigrationWelcome(
    phone: string,
    name: string,
    email: string,
    password: string,
  ) {
    const wa = this.getClient();

    try {
      const jid = this.toJid(phone);

      const message = this.buildMigrationWelcomeMessage(
        name,
        email,
        password,
        'https://mbinet.click/login',
      );

      await wa.sendMessage(jid, message);

      await this.mailService.sendMigrationWelcome(email, name, password);

      this.logger.log(`Migration welcome sent → ${jid}`);
    } catch (err) {
      this.logger.error('Failed to send migration welcome message:', err);
    }
  }

  /*=======================================================
   * CRON DAILY REMINDER
   *=======================================================*/
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async cronDaily() {
    if (!this.connected) {
      this.logger.warn('Skipping daily cron — WA offline.');
      return;
    }

    const today = new Date();

    // Normalize hari (kejadian utk waktu)
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    const reminderSchedule = [
      { days: 7, label: '7 days' },
      { days: 5, label: '5 days' },
      { days: 3, label: '3 days' },
      { days: 0, label: 'today' },
    ];

    for (const { days, label } of reminderSchedule) {
      const targetDate = new Date(startOfToday.getTime() + days * 86400000);

      const users = await this.dataSource.getRepository('User').find({
        where: {
          status: UserStatus.AKTIF,
          subscription: {
            dueDate: Between(
              new Date(targetDate.setHours(0, 0, 0, 0)),
              new Date(targetDate.setHours(23, 59, 59, 999)),
            ),
          },
        },
        relations: ['subscription'],
      });

      for (const user of users) {
        await this.sendReminder(user.phoneNumber, days, user.id);
      }

      this.logger.log(`Sent reminder for users due in ${label}`);
    }

    // EXPIRED USERS
    const expiredUsers = await this.dataSource.getRepository('User').find({
      where: {
        status: UserStatus.AKTIF,
        subscription: {
          dueDate: LessThan(startOfToday),
        },
      },
      relations: ['subscription'],
    });

    for (const user of expiredUsers) {
      await this.dataSource
        .getRepository('User')
        .update(user.id, { status: UserStatus.NONAKTIF });

      await this.sendExpired(user.phoneNumber, user.id);
    }

    this.logger.log('Daily cron finished');
  }

  async sendNewPaymentNotificationToAdmins(paymentId: string) {
    try {
      if (!this.client || !this.connected) {
        this.logger.warn('WA client not ready — skipping admin notif');
        return;
      }

      // Ambil payment + user
      const payment = await this.dataSource.getRepository('Payment').findOne({
        where: { id: paymentId },
        relations: ['user', 'paket'],
      });

      if (!payment) return;

      // Ambil semua admin / superadmin
      const admins = await this.dataSource.getRepository('User').find({
        where: [{ role: 'ADMIN' }, { role: 'SUPERADMIN' }],
      });

      if (admins.length === 0) return;

      const msg = `
📢 *Pembayaran Baru Masuk!*

📄 ID: ${payment.id}
👤 User: ${payment.user?.name}
📱 Nomor: ${payment.user?.phone_number}
📦 Paket: ${payment.paket?.name}
💵 Harga: Rp ${payment.paket?.price?.toLocaleString()}

Silakan cek & verifikasi di dashboard https://mbinet.click/dashboard .
    `;

      for (const admin of admins) {
        if (!admin.phone_number) continue;

        const jid = this.toJid(admin.phone_number);

        await this.client.sendMessage(jid, msg).catch((e) => {
          this.logger.error(`Failed send admin notif to ${jid}:`, e);
        });
      }

      this.logger.log(`Admin notification sent for payment #${paymentId}`);
    } catch (err) {
      this.logger.error('Failed sending admin new payment notification:', err);
    }
  }

  /*=======================================================
   * MESSAGE TEMPLATES
   *=======================================================*/
  buildSubscriptionReminder(daysLeft: number, link: string): string {
    return `📅 Pengingat Langganan

Langganan Anda akan berakhir dalam ${daysLeft} hari.

Untuk menghindari pemutusan layanan:
1. Siapkan pembayaran Anda
2. Bayar di sini: ${link}

Layanan Anda akan tetap aktif setelah pembayaran diverifikasi.`;
  }

  // -------------------------------------------------------
  // Build: Service Expired
  // -------------------------------------------------------
  buildServiceExpired(link: string): string {
    return `⚠️ Layanan Dinonaktifkan

Langganan Anda telah berakhir. Mohon lakukan perpanjangan segera.

Bayar di sini: ${link}

Layanan Anda akan dipulihkan maksimal 24 jam setelah pembayaran diverifikasi.`;
  }

  // -------------------------------------------------------
  // Build: Payment Success
  // -------------------------------------------------------
  buildPaymentSuccess(transactionId: string): string {
    return `🎉 Pembayaran Berhasil!

ID Transaksi: ${transactionId}

Layanan Anda telah aktif kembali. Terima kasih atas pembayaran Anda!

Butuh bantuan? Hubungi kami kapan saja di +628138005669.`;
  }

  // -------------------------------------------------------
  // Build: Payment Rejected
  // -------------------------------------------------------
  buildPaymentRejected(reason: string, link: string): string {
    return `❌ Pembayaran Ditolak

Alasan: ${reason}

Silakan lakukan pembayaran ulang di sini: ${link}

Jika membutuhkan bantuan, silakan hubungi tim support kami di +628138005669.`;
  }

  buildWelcomeMessage(
    name: string,
    customerId: string,
    paymentId: string,
    link: string,
  ): string {
    return `👋 *Selamat Datang, ${name}!*

Terima kasih telah bergabung dengan *MBI NET*. Berikut detail akun Anda:

🆔 *Customer ID:* ${customerId}
💳 *ID Pembayaran:* ${paymentId}

Untuk melanjutkan aktivasi dan melihat detail transaksi:
🔗 ${link}

Jika membutuhkan bantuan, silakan hubungi tim support kami di +628138005669.
Selamat menikmati layanan internet cepat kami! 🚀`;
  }

  buildMigrationWelcomeMessage(
    name: string,
    email: string,
    password: string,
    loginUrl: string,
  ): string {
    return `👋 *Halo ${name}!*  

Selamat datang di *Sistem Baru MBI NET!*

Akun lama Anda telah berhasil dipindahkan ke sistem baru kami.  
Berikut adalah detail akun untuk login:

📧 *Email*: ${email}
🔑 *Password Baru*: ${password}

Silakan login di sini:
🔗 ${loginUrl}

Jika membutuhkan bantuan hubungi tim kami di +628138005669, tim support kami selalu siap membantu 🚀`;
  }
}
