import * as crypto from 'crypto';

export function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 50, 100, 'sha512', (err, values) => {
      if (err) {
        return reject(err);
      }

      resolve(values.toString('hex'));
    });
  });
}
