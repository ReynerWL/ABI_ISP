import cron from 'node-cron';
import { WASocket } from '@whiskeysockets/baileys';
import axios from 'axios';

export const reminderTask = (sock: WASocket) => {
  // Reminder sent on the 25th at 9:00 AM
  cron.schedule('0 9 25 * *', async () => {
    const { data: users } = await axios.get(`${process.env.BASE_URL}/users/due`);
    for (const user of users) {
      await sock.sendMessage(user.waNumber + '@s.whatsapp.net', {
        text: `Hi ${user.name}, your subscription is due. Please pay before the 1st to avoid suspension. Reply "menu" to continue.`,
      });
    }
  });
};

export const expirationTask = (sock: WASocket) => {
  // Expired warning sent on the 1st at 9:00 AM
  cron.schedule('0 9 1 * *', async () => {
    const { data: expiredUsers } = await axios.get(`${process.env.BASE_URL}/users/expired`);
    for (const user of expiredUsers) {
      await sock.sendMessage(user.waNumber + '@s.whatsapp.net', {
        text: `Hi ${user.name}, your subscription has expired due to non-payment. Please reply "menu" to renew.`,
      });
    }
  });
};
