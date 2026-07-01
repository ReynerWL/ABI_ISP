// src/WA/bot/wa.service.ts
import { Injectable, Logger } from '@nestjs/common';
import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Between, DataSource, LessThan } from 'typeorm';
import { MailService } from '#/mail/mail.service';
import { UserStatus } from '#/user/entities/user.entity';
import { SessionService } from './session.service';
import { Subject, Observable } from 'rxjs';
import * as path from 'path';
import * as fs from 'fs';

export interface WaStatusPayload {
  connected: boolean;
  qrAvailable: boolean;
  isLoggedOut: boolean;
}

@Injectable()
export class WhatsAppService {
  private client: ReturnType<typeof makeWASocket> | null = null;
  private qrCodeDataUrl: string | null = null;
  private connected = false;
  private starting = false;

  private logger = new Logger('WhatsAppService');

  /** RxJS Subject to broadcast status changes via SSE */
  private statusSubject = new Subject<WaStatusPayload>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    private readonly sessionSvc: SessionService,
  ) {}

  /*=======================================================
   * SSE STREAM
   *=======================================================*/
  getStatusStream(): Observable<WaStatusPayload> {
    return this.statusSubject.asObservable();
  }

  /** Emit current status to all SSE subscribers */
  private emitStatus() {
    const payload = this.buildStatusPayload();
    this.logger.log(`📡 Status emit: connected=${payload.connected}, qrAvailable=${payload.qrAvailable}`);
    this.statusSubject.next(payload);
  }

  private buildStatusPayload(): WaStatusPayload {
    return {
      connected: this.connected,
      qrAvailable: !!this.qrCodeDataUrl,
      isLoggedOut: !this.connected && !this.qrCodeDataUrl,
    };
  }

  /*=======================================================
   * JID NORMALIZATION
   *=======================================================*/
  private toJid(phone: string): string {
    if (!phone) throw new Error('Phone number empty');

    phone = phone.replace(/\D/g, '');

    if (phone.startsWith('62')) return `${phone}@s.whatsapp.net`;
    if (phone.startsWith('0')) return `62${phone.substring(1)}@s.whatsapp.net`;
    if (/^[1-9]\d{7,14}$/.test(phone)) return `62${phone}@s.whatsapp.net`;

    if (phone.endsWith('@s.whatsapp.net')) return phone;

    throw new Error(`Invalid phone number: ${phone}`);
  }

  /*=======================================================
   * BASIC INFO
   *=======================================================*/
  getQrCode() {
    return this.qrCodeDataUrl;
  }

  getStatus(): WaStatusPayload {
    return this.buildStatusPayload();
  }

  /*=======================================================
   * START BOT (Baileys)
   *=======================================================*/
  async startBot(): Promise<void> {
    if (this.starting) return;
    this.starting = true;

    try {
      this.logger.log('🚀 Starting WhatsApp client (Baileys)...');

      // Make sure the auth directory exists
      const authDir = path.join(process.cwd(), 'baileys_auth_info');
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const { version, isLatest } = await fetchLatestBaileysVersion();
      this.logger.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

      this.client = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        syncFullHistory: false, // Don't download all old messages
      });

      this.client.ev.on('creds.update', saveCreds);

      this.client.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCodeDataUrl = await qrcode.toDataURL(qr);
            this.logger.log('📌 QR Ready');
            this.emitStatus();
          } catch (err) {
            this.logger.error('QR processing error:', err);
          }
        }

        if (connection === 'close') {
          this.connected = false;
          this.qrCodeDataUrl = null;
          this.emitStatus();

          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.logger.warn(`🔄 Connection closed. Reason: ${statusCode}, Reconnecting: ${shouldReconnect}`);

          if (shouldReconnect) {
            // Reconnect immediately
            setTimeout(() => {
                this.starting = false;
                this.startBot();
            }, 2000);
          } else {
            // Logged out — clear auth state
            this.logger.log('🚪 Device logged out.');
            await this.sessionSvc.clearAuthState();
            setTimeout(() => {
                this.starting = false;
                this.startBot(); // start fresh to generate new QR
            }, 2000);
          }
        } else if (connection === 'open') {
          this.connected = true;
          this.qrCodeDataUrl = null;
          this.logger.log('✅ WhatsApp READY (Baileys)');
          this.emitStatus();
        }
      });

    } catch (err) {
      this.logger.error('WA Start Error:', err);
      this.connected = false;
      this.qrCodeDataUrl = null;
      this.emitStatus();
    } finally {
      this.starting = false;
    }
  }

  /*=======================================================
   * LOGOUT
   *=======================================================*/
  async logout() {
    this.logger.log('🚪 Logout requested...');

    try {
      if (this.client) {
        this.client.logout(); // This will trigger the connection.update -> close (statusCode 401 loggedOut)
      } else {
        await this.sessionSvc.clearAuthState();
        this.emitStatus();
        setTimeout(() => {
          this.starting = false;
          this.startBot();
        }, 1500);
      }
    } catch (err) {
      this.logger.error('Logout error:', err);
    }
  }

  /*=======================================================
   * SEND MESSAGE (Baileys)
   *=======================================================*/
  async sendMessage(to: string, message: string) {
    if (!this.client || !this.connected) {
      throw new Error('WhatsApp client not connected');
    }

    const jid = this.toJid(to);
    return this.client.sendMessage(jid, { text: message });
  }

  /*=======================================================
   * PAYMENT CONFIRMED
   *=======================================================*/
  async sendPaymentConfirmed(phone: string, paymentId: string, userId: string) {
    try {
      const jid = this.toJid(phone);

      await this.sendMessage(jid, this.buildPaymentSuccess(paymentId));
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
    try {
      const jid = this.toJid(phone);
      const text = this.buildPaymentRejected(
        reason,
        'https://mbinet.click/riwayat-transaksi',
      );

      await this.sendMessage(jid, text);
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
    try {
      const jid = this.toJid(phone);

      await this.sendMessage(
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
    try {
      const jid = this.toJid(phone);

      await this.sendMessage(
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
    if (!this.client || !this.connected) {
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

      await this.sendMessage(jid, message);

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
    try {
      const jid = this.toJid(phone);

      const message = this.buildMigrationWelcomeMessage(
        name,
        email,
        password,
        'https://mbinet.click/login',
      );

      await this.sendMessage(jid, message);

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

      const payment = await this.dataSource.getRepository('Payment').findOne({
        where: { id: paymentId },
        relations: ['user', 'paket'],
      });

      if (!payment) return;

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

        await this.sendMessage(jid, msg).catch((e) => {
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
    return `Pelanggan MBI NET yang terhormat,

Terima kasih atas kesetiaan Anda menggunakan layanan dari MBI NET. Semoga aktivitas digital Anda selalu lancar.

Kami informasikan bahwa masa aktif layanan internet Anda akan berakhir dalam *${daysLeft} hari*.

Dimohon untuk melakukan pembayaran agar layanan Anda tetap dapat digunakan tanpa hambatan. 
Untuk melakukan pembayaran, silakan klik tautan berikut:
🔗 ${link}

Jika Anda membutuhkan bantuan, jangan ragu untuk menghubungi Customer Service kami melalui:
☑️ WhatsApp: +628138005669

*Abaikan informasi ini apabila Anda telah melakukan pembayaran.*

Terima kasih dan salam sehat selalu.`;
  }

  buildServiceExpired(link: string): string {
    return `Pelanggan MBI NET yang terhormat,

Kami informasikan bahwa masa aktif layanan internet Anda saat ini telah berakhir dan layanan sementara kami nonaktifkan.

Agar dapat kembali menikmati layanan internet tanpa hambatan, mohon perpanjang langganan Anda melalui tautan berikut:
🔗 ${link}

Layanan Anda akan dipulihkan maksimal 24 jam setelah pembayaran berhasil diverifikasi.

Jika Anda memiliki pertanyaan atau membutuhkan bantuan, silakan hubungi Customer Service kami melalui:
☑️ WhatsApp: +628138005669

Terima kasih atas perhatian dan kerja sama Anda.`;
  }

  buildPaymentSuccess(transactionId: string): string {
    return `Pelanggan MBI NET yang terhormat,

Terima kasih! Pembayaran Anda telah kami terima dengan sukses. Layanan internet Anda kini telah aktif kembali.

*Detail Transaksi:*
🆔 ID Transaksi: ${transactionId}

Semoga aktivitas digital Anda semakin lancar dengan layanan kami.

Jika Anda membutuhkan bantuan lebih lanjut, jangan ragu untuk menghubungi Customer Service kami:
☑️ WhatsApp: +628138005669

Terima kasih dan salam sehat selalu.`;
  }

  buildPaymentRejected(reason: string, link: string): string {
    return `Pelanggan MBI NET yang terhormat,

Mohon maaf, pembayaran Anda tidak dapat kami proses saat ini. 

*Alasan:* ${reason}

Silakan mencoba kembali untuk melakukan pembayaran melalui tautan berikut:
🔗 ${link}

Jika Anda mengalami kesulitan atau memiliki pertanyaan, Customer Service kami siap membantu:
☑️ WhatsApp: +628138005669

Terima kasih atas pengertian Anda.`;
  }

  buildWelcomeMessage(
    name: string,
    customerId: string,
    paymentId: string,
    link: string,
  ): string {
    return `Halo *${name}*, selamat datang di MBI NET! 👋

Terima kasih telah mempercayakan kebutuhan internet Anda kepada kami. Semoga kehadiran layanan MBI NET dapat mendukung kelancaran aktivitas digital Anda.

Berikut adalah detail akun Anda:
🆔 *Customer ID*: ${customerId}
💳 *ID Pembayaran*: ${paymentId}

Untuk melanjutkan proses aktivasi dan melihat detail transaksi Anda, silakan klik tautan berikut:
🔗 ${link}

Jika Anda memiliki pertanyaan atau butuh bantuan, silakan hubungi Customer Service kami:
☑️ WhatsApp: +628138005669

Selamat menikmati koneksi yang cepat dan andal bersama kami! 🚀`;
  }

  buildMigrationWelcomeMessage(
    name: string,
    email: string,
    password: string,
    loginUrl: string,
  ): string {
    return `Halo *${name}*, selamat datang di sistem terbaru MBI NET! 👋

Kami ingin menginformasikan bahwa akun Anda telah berhasil kami pindahkan ke sistem baru yang dirancang untuk memberikan pengalaman yang lebih baik.

Berikut adalah detail akses untuk akun Anda:
📧 *Email*: ${email}
🔑 *Password Baru*: ${password}

Silakan login menggunakan akses di atas melalui tautan berikut:
🔗 ${loginUrl}

Jika Anda mengalami kendala saat login atau memiliki pertanyaan lainnya, tim support kami selalu siap membantu:
☑️ WhatsApp: +628138005669

Terima kasih atas kesetiaan Anda bersama MBI NET! 🚀`;
  }
}
