// src/WA/bot/menuUI.service.ts
import { UserStatus } from '#/user/entities/user.entity';
import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';

@Injectable()
export class MenuUIService {
  private logger = new Logger('MenuUIService');

  /**
   * Kirim pengingat jatuh tempo langganan
   * @param client whatsapp-web.js Client
   * @param to target jid (mis. 62812xxxx@c.us)
   */
  async sendSubscriptionReminder(
    client: any,
    to: string,
    daysLeft: number,
    link: string,
  ) {
    const text = `📅 Pengingat Langganan

Langganan Anda akan berakhir dalam ${daysLeft} hari.

Untuk menghindari pemutusan layanan:
1. Siapkan pembayaran Anda
2. Bayar di sini: ${link}

Layanan Anda akan tetap aktif setelah pembayaran diverifikasi.`;

    try {
      await client.sendMessage(to, text);
    } catch (err) {
      this.logger.error(
        'Gagal kirim SubscriptionReminder',
        err?.message ?? err,
      );
      throw err;
    }
  }

  /**
   * Kirim pemberitahuan layanan expired
   */
  async sendServiceExpired(client: any, to: string, link: string) {
    const text = `⚠️ Layanan Dinonaktifkan

Langganan Anda telah berakhir. Mohon lakukan perpanjangan segera.

Bayar di sini: ${link}

Layanan Anda akan dipulihkan maksimal 24 jam setelah pembayaran diverifikasi.`;

    try {
      await client.sendMessage(to, text);
    } catch (err) {
      this.logger.error('Gagal kirim ServiceExpired', err?.message ?? err);
      throw err;
    }
  }

  /**
   * Kirim pesan konfirmasi pembayaran berhasil
   */
  async sendPaymentSuccess(client: any, to: string, transactionId: string) {
    const text = `🎉 Pembayaran Berhasil!

ID Transaksi: ${transactionId}

Layanan Anda telah aktif kembali. Terima kasih atas pembayaran Anda!

Butuh bantuan? Hubungi kami kapan saja.`;

    try {
      await client.sendMessage(to, text);
    } catch (err) {
      this.logger.error('Gagal kirim PaymentSuccess', err?.message ?? err);
      throw err;
    }
  }

  /**
   * Kirim pesan penolakan pembayaran
   */
  async sendPaymentRejected(
    client: any,
    to: string,
    reason: string,
    link: string,
  ) {
    const text = `❌ Pembayaran Ditolak

Alasan: ${reason}

Silakan lakukan pembayaran ulang di sini: ${link}

Jika membutuhkan bantuan, silakan hubungi tim support kami.`;

    try {
      await client.sendMessage(to, text);
    } catch (err) {
      this.logger.error('Gagal kirim PaymentRejected', err?.message ?? err);
      throw err;
    }
  }

  /**
   * Kirim status akun (dipanggil admin/sistem)
   */
  async sendAccountStatus(
    client: any,
    to: string,
    name: string,
    paket: string,
    status: UserStatus,
    dueDate?: Date,
  ) {
    const statusMsg =
      status === UserStatus.AKTIF
        ? '🟢 Aktif – Internet berjalan normal'
        : status === UserStatus.NONAKTIF
          ? '🔴 Tidak Aktif – Pembayaran melewati jatuh tempo'
          : '🟠 Diblokir – Silakan hubungi admin';

    const due = dueDate ? dueDate.toLocaleDateString() : 'Akhir bulan';

    const text = `📊 Status Akun

Nama: ${name}
Paket: ${paket}
Status: ${statusMsg}
Jatuh Tempo: ${due}

Ada pertanyaan? Silakan hubungi support.`;

    try {
      await client.sendMessage(to, text);
    } catch (err) {
      this.logger.error('Gagal kirim AccountStatus', err?.message ?? err);
      throw err;
    }
  }

  /**
   * Kirim kontak support
   */
  async sendSupportContact(client: any, to: string) {
    const text = `📞 Butuh Bantuan?

Hubungi tim support kami:

📱 WhatsApp: wa.me/6281234567890
📧 Email: support@yourisp.com
🕐 Jam Operasional: Senin–Jumat, 08.00–17.00`;

    try {
      await client.sendMessage(to, text);
    } catch (err) {
      this.logger.error('Gagal kirim SupportContact', err?.message ?? err);
      throw err;
    }
  }

  /**
   * Kirim pesan selamat datang
   */
  async sendWelcomeMessage(
    client: any,
    to: string,
    name: string,
    link: string,
  ) {
    const text = `👋 Selamat Datang, ${name}!

Terima kasih telah memilih layanan kami.

Untuk mengaktifkan layanan Anda:
1. Lakukan pembayaran
2. Bayar di sini: ${link}

Selamat menikmati internet cepat!`;

    try {
      await client.sendMessage(to, text);
    } catch (err) {
      this.logger.error('Gagal kirim WelcomeMessage', err?.message ?? err);
      throw err;
    }
  }

  /**
   * Kirim pengingat pembayaran jatuh tempo
   */
  async sendOverduePaymentReminder(
    client: any,
    to: string,
    daysOverdue: number,
    link: string,
  ) {
    const text = `⚠️ Peringatan Pembayaran Terlambat

Pembayaran Anda terlambat ${daysOverdue} hari.

Untuk menghindari pemutusan layanan:
1. Segera lakukan pembayaran
2. Bayar di sini: ${link}

Mohon segera ditindaklanjuti.`;

    try {
      await client.sendMessage(to, text);
    } catch (err) {
      this.logger.error(
        'Gagal kirim OverduePaymentReminder',
        err?.message ?? err,
      );
      throw err;
    }
  }
}
