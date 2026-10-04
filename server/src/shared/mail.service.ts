import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

/**
 * Отправка писем через SMTP (переменные SMTP_* в .env).
 * Если SMTP_HOST не задан — dev-режим: письмо выводится в консоль сервера.
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger('Mail');
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('smtpHost');
    this.from = this.config.get<string>('mailFrom') ?? 'PulseCheck <no-reply@localhost>';
    if (!host) {
      this.transporter = null;
      this.logger.warn('SMTP_HOST не задан — письма выводятся в консоль (dev-режим)');
      return;
    }
    const port = this.config.get<number>('smtpPort') ?? 587;
    const user = this.config.get<string>('smtpUser');
    const pass = this.config.get<string>('smtpPass');
    this.transporter = createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });
  }

  get enabled(): boolean {
    return this.transporter !== null;
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[dev] Кому: ${to} | ${subject}\n${text}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
    } catch (e) {
      this.logger.error(`Не удалось отправить письмо на ${to}: ${String(e)}`);
      throw e;
    }
  }

  async onModuleDestroy() {
    await this.transporter?.close();
  }
}
