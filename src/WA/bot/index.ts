import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { menuHandler } from './menuHandler';
import { reminderTask, expirationTask } from './reminder';
import { paymentFlow } from './paymentFlow';

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const jid = msg.key.remoteJid!;
    const content = msg.message;
    const text =
      content?.conversation || content?.extendedTextMessage?.text || '';
    const selectedButtonId = content?.buttonsResponseMessage?.selectedButtonId;

    // Handle image for payment proof
    if (content.imageMessage) {
      await paymentFlow.handleImage(sock, jid, msg);
      return;
    }

    await menuHandler(sock, jid, text.trim().toLowerCase(), selectedButtonId);
  });

  reminderTask(sock); // every 25th
  expirationTask(sock); // every 1st
}

startBot();
