import { WASocket, proto } from '@whiskeysockets/baileys';

export async function sendMainMenu(sock: WASocket, jid: string) {
  const message = {
    text: 'Selamat datang di layanan ISP kami. Silakan pilih salah satu menu:',
    footer: 'ISP Bot',
    templateButtons: [
      {
        index: 1,
        quickReplyButton: {
          displayText: 'Kirim Bukti Pembayaran',
          id: 'send_payment_proof',
        },
      },
      {
        index: 2,
        quickReplyButton: {
          displayText: 'Cek Langganan',
          id: 'check_subscription',
        },
      },
      {
        index: 3,
        quickReplyButton: {
          displayText: 'Bantuan',
          id: 'help',
        },
      },
    ],
  };

  await sock.sendMessage(jid, message);
}
