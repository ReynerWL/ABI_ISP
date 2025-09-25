// src/mail/mail.module.ts
import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

@Module({
  imports: [MailerModule],
  providers: [MailService],
  exports: [MailService], // 👈 Export so WAModule can use it
})
export class MailModule {}
