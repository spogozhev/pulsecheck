import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditOptions {
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}

/** Журнал значимых действий преподавателей (§3.4 ТЗ — аудит доступа). */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');
  constructor(private readonly prisma: PrismaService) {}

  async log(req: unknown, action: string, options: AuditOptions = {}): Promise<void> {
    const r = req as { user?: { id: string }; ip?: string };
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: r?.user?.id ?? null,
          action,
          entityType: options.entityType ?? null,
          entityId: options.entityId ?? null,
          meta: (options.meta ?? undefined) as never,
          ip: r?.ip ?? null,
        },
      });
    } catch (e) {
      // аудит не должен ломать основной поток
      this.logger.warn(`Не удалось записать аудит (${action}): ${String(e)}`);
    }
  }
}
