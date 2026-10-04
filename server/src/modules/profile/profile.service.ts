import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../../shared/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export interface ProfileUpdateCommand {
  name?: string;
  email?: string;
  currentPassword?: string;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Смена имени; смена email требует текущего пароля. */
  async updateProfile(user: AuthUser, dto: ProfileUpdateCommand) {
    const me = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!me) throw new NotFoundException('Пользователь не найден');

    const data: { name?: string; email?: string } = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name.length < 2 || name.length > 120) {
        throw new BadRequestException('Имя: от 2 до 120 символов');
      }
      data.name = name;
    }

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException('Некорректный email');
      }
      if (!dto.currentPassword) {
        throw new BadRequestException('Для смены email введите текущий пароль');
      }
      if (!(await bcrypt.compare(dto.currentPassword, me.passwordHash))) {
        throw new BadRequestException('Текущий пароль указан неверно');
      }
      const exists = await this.prisma.user.findUnique({ where: { email } });
      if (exists && exists.id !== me.id) {
        throw new ConflictException('Этот email уже используется');
      }
      data.email = email;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Нет данных для обновления');
    }

    return this.prisma.user.update({
      where: { id: me.id },
      data,
      select: { id: true, email: true, name: true, role: true, status: true },
    });
  }

  /** Смена пароля: требуется текущий пароль. */
  async changePassword(
    user: AuthUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (newPassword.length < 8 || newPassword.length > 128) {
      throw new BadRequestException('Новый пароль: от 8 до 128 символов');
    }
    const me = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!me) throw new NotFoundException('Пользователь не найден');
    if (!(await bcrypt.compare(currentPassword, me.passwordHash))) {
      throw new BadRequestException('Текущий пароль указан неверно');
    }
    await this.prisma.user.update({
      where: { id: me.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) },
    });
    // сброс всех токенов восстановления этого пользователя
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: me.id } });
  }

  /** Создаёт токен восстановления и отправляет письмо. Ответ всегда положительный,
   *  чтобы не раскрывать существование аккаунта. */
  async requestPasswordReset(email: string): Promise<{ devResetUrl?: string }> {
    const emailNorm = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: emailNorm } });

    if (user && user.status !== 'blocked') {
      // погасить прежние неиспользованные токены
      await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      const token = randomBytes(32).toString('hex');
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: createHash('sha256').update(token).digest('hex'),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });
      const link = `${process.env.PUBLIC_BASE_URL ?? 'http://localhost:5180'}/reset-password?token=${token}`;
      await this.mail.send(
        user.email,
        'Восстановление пароля PulseCheck',
        'Ссылка для восстановления пароля (действует 30 минут):\n' + link,
      );

      // dev-удобство: без SMTP ссылка возвращается в ответе; в production — никогда
      if (!this.mail.enabled && process.env.NODE_ENV !== 'production') {
        return { devResetUrl: link };
      }
    }
    return {};
  }

  /** Применяет новый пароль по токену восстановления. */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8 || newPassword.length > 128) {
      throw new BadRequestException('Пароль: от 8 до 128 символов');
    }
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Ссылка недействительна или устарела');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash: await bcrypt.hash(newPassword, 12) },
      }),
      this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);
  }
}
