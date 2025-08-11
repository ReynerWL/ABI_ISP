import { WASocket, downloadMediaMessage } from '@whiskeysockets/baileys';
import axios from 'axios';
import { sessions, Session } from './session';
import FormData from 'form-data';

export const paymentFlow = {
  initFlow: async (sock: WASocket, sender: string) => {
    sessions.set(sender, {
      step: 'awaitingCustomerId',
      state: 'awaitingMenu',
    });
    await sock.sendMessage(sender, {
      text: 'Silakan masukkan Customer ID Anda:',
    });
  },

  handleResponse: async (sock: WASocket, sender: string, text: string) => {
    const session = sessions.get(sender);
    if (!session) return false;

    if (session.step === 'awaitingCustomerId') {
      try {
        const res = await axios.get(`${process.env.BASE_URL}/user/id/${text}`);
        if (res.data) {
          session.customer = res.data;
          session.step = 'awaitingConfirmation';
          await sock.sendMessage(sender, {
            text: `Data Anda:\nNama: ${res.data.name}\nPaket: ${res.data.package}\n\nApakah ini benar? (yes/no)`,
          });
        } else {
          await sock.sendMessage(sender, {
            text: `Customer ID tidak ditemukan. Coba lagi.`,
          });
        }
      } catch {
        await sock.sendMessage(sender, {
          text: `Terjadi kesalahan saat mengambil data.`,
        });
      }
      return true;
    }

    if (session.step === 'awaitingConfirmation') {
      if (text.toLowerCase() === 'yes') {
        session.step = 'awaitingImage';
        await sock.sendMessage(sender, {
          text: 'Silakan kirim gambar bukti pembayaran Anda.',
        });
      } else {
        sessions.delete(sender);
        await sock.sendMessage(sender, {
          text: 'Proses dibatalkan. Ketik "menu" untuk mulai lagi.',
        });
      }
      return true;
    }

    return false;
  },

  handleImage: async function (
    sock: WASocket,
    sender: string,
    imageMessage: any,
  ) {
    const session = sessions.get(sender);
    if (!session || session.step !== 'awaitingImage') return;

    // Download image as Buffer
    const buffer = await downloadMediaMessage(imageMessage, 'buffer', {});

    // Prepare multipart form data
    const formData = new FormData();
    formData.append('file', buffer, 'proof.jpg'); // field name must match FileInterceptor('file')
    formData.append('customerId', session.customer.id);

    // Send to NestJS upload endpoint
    await axios.post(`${process.env.BASE_URL}/file/upload`, formData, {
      headers: formData.getHeaders(),
    });

    // Clear session and send confirmation
    sessions.delete(sender);
    await sock.sendMessage(sender, {
      text: 'Bukti pembayaran diterima. Silakan tunggu konfirmasi.',
    });
  },
};
