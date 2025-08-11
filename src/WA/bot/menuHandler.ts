import { WASocket } from '@whiskeysockets/baileys';
import { paymentFlow } from './paymentFlow';
import { sendMainMenu } from './menuUI';

export const menuHandler = async (sock: WASocket, sender: string, text: string, selectedButtonId?: string) => {
  if (selectedButtonId) {
    switch (selectedButtonId) {
      case 'send_payment_proof':
        await paymentFlow.initFlow(sock, sender);
        break;
      case 'check_subscription':
        await sock.sendMessage(sender, { text: 'Kami sedang memeriksa status langganan Anda...' });
        break;
      case 'help':
        await sock.sendMessage(sender, { text: 'Untuk bantuan, hubungi admin di +62xxxx' });
        break;
      default:
        await sendMainMenu(sock, sender);
    }
    return;
  }

  if (text === 'menu' || text === '1') {
    await sendMainMenu(sock, sender);
    return;
  }

  // Delegate message if part of flow
  const handled = await paymentFlow.handleResponse(sock, sender, text);
  if (handled) return;

  // Fallback: show menu
  await sendMainMenu(sock, sender);
};
