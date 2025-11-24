// src/WA/bot/menuUI.service.ts
import { UserStatus } from '#/user/entities/user.entity';
import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';

@Injectable()
export class MenuUIService {
  private logger = new Logger('MenuUIService');

  /**
   * Kirim pengingat jatuh tempo langganan
   */
  async sendSubscriptionReminder(
    client: any,
    to: string,
    daysLeft: number,
    link: string,
  ) {
    await client.sendMessage(to, {
      text: `📅 Pengingat Langganan

Langganan Anda akan berakhir dalam ${daysLeft} hari.

Untuk menghindari pemutusan layanan:
1. Siapkan pembayaran Anda
2. Bayar di sini: ${link}

Layanan Anda akan tetap aktif setelah pembayaran diverifikasi.`,
    });
  }

  /**
   * Kirim pemberitahuan layanan expired
   */
  async sendServiceExpired(client: any, to: string, link: string) {
    await client.sendMessage(to, {
      text: `⚠️ Layanan Dinonaktifkan

Langganan Anda telah berakhir. Mohon lakukan perpanjangan segera.

Bayar di sini: ${link}

Layanan Anda akan dipulihkan maksimal 24 jam setelah pembayaran diverifikasi.`,
    });
  }

  /**
   * Kirim pesan konfirmasi pembayaran berhasil
   */
  async sendPaymentSuccess(client: any, to: string, transactionId: string) {
    await client.sendMessage(to, {
      text: `🎉 Pembayaran Berhasil!

ID Transaksi: ${transactionId}

Layanan Anda telah aktif kembali. Terima kasih atas pembayaran Anda!

Butuh bantuan? Hubungi kami kapan saja.`,
    });
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
    await client.sendMessage(to, {
      text: `❌ Pembayaran Ditolak

Alasan: ${reason}

Silakan lakukan pembayaran ulang di sini: ${link}

Jika membutuhkan bantuan, silakan hubungi tim support kami.`,
    });
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

    await client.sendMessage(to, {
      text: `📊 Status Akun

Nama: ${name}
Paket: ${paket}
Status: ${statusMsg}
Jatuh Tempo: ${due}

Ada pertanyaan? Silakan hubungi support.`,
    });
  }

  /**
   * Kirim kontak support
   */
  async sendSupportContact(client: any, to: string) {
    await client.sendMessage(to, {
      text: `📞 Butuh Bantuan?

Hubungi tim support kami:

📱 WhatsApp: wa.me/6281234567890
📧 Email: support@yourisp.com
🕐 Jam Operasional: Senin–Jumat, 08.00–17.00`,
    });
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
    await client.sendMessage(to, {
      text: `👋 Selamat Datang, ${name}!

Terima kasih telah memilih layanan kami.

Untuk mengaktifkan layanan Anda:
1. Lakukan pembayaran
2. Bayar di sini: ${link}

Selamat menikmati internet cepat!`,
    });
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
    await client.sendMessage(to, {
      text: `⚠️ Peringatan Pembayaran Terlambat

Pembayaran Anda terlambat ${daysOverdue} hari.

Untuk menghindari pemutusan layanan:
1. Segera lakukan pembayaran
2. Bayar di sini: ${link}

Mohon segera ditindaklanjuti.`,
    });
  }
}
