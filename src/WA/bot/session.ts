import makeWASocket, { WASocket, AnyMessageContent, proto } from '@whiskeysockets/baileys';

export interface Session {
  state: 'awaitingMenu' | 'awaitingPaymentProof' | 'idle';
  customer?: {
    id: string;
    name?: string;
  };
  step?: 'awaitingCustomerId' | 'awaitingConfirmation' | 'awaitingImage';
}

export const sessions: Map<string, Session> = new Map();

export const handleIncomingMessage = async (sock: WASocket, msg: proto.IWebMessageInfo) => {
  const sender = msg.key.remoteJid;
  const message = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

  if (!sender || !message) return;

  const session = sessions.get(sender) || { state: 'idle' };

  if (message.toLowerCase() === 'menu') {
    // Send the menu
    await sock.sendMessage(sender, {
      text: `📋 *Main Menu*\n\n1. Submit payment proof\n2. Check subscription status\n\nPlease choose an option.`,
    });
    sessions.set(sender, { state: 'awaitingMenu' });
  } else if (session.state === 'awaitingMenu') {
    // Handle replies to menu options
    if (message === '1') {
      await sock.sendMessage(sender, { text: 'Please upload your payment proof image or receipt.' });
      sessions.set(sender, {
        state: 'awaitingPaymentProof',
        customer: { id: sender }, // You can customize this
      });
    } else if (message === '2') {
      await sock.sendMessage(sender, { text: 'Your subscription is active until DD/MM/YYYY.' });
      sessions.set(sender, { state: 'idle' });
    } else {
      await sock.sendMessage(sender, { text: 'Invalid option. Please reply with "menu" to see the options.' });
    }
  } else if (session.state === 'awaitingPaymentProof') {
    // Just respond. The actual image will be handled in `paymentFlow.ts`
    await sock.sendMessage(sender, {
      text: '📎 Please upload your image as a photo, not as a document.',
    });
  } else {
    await sock.sendMessage(sender, {
      text: 'Hi! It looks like you want to continue. Please reply with *"menu"* to proceed.',
    });
  }
};
