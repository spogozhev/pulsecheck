import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Модерация: пользователь со статусом pending/blocked не может выполнять действия преподавателя
 * (загрузка презентаций, опросы, слайды, запуск лекций). Чтение и выход разрешены.
 * Для публичных эндпоинтов (голосование студентов) request.user отсутствует — проверка пропускается.
 */
@Injectable()
export class ApprovalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return true;

    if (READ_METHODS.has(request.method.toUpperCase())) return true;
    if (request.path.startsWith('/api/auth')) return true;

    if (user.status !== 'approved') {
      throw new ForbiddenException(
        user.status === 'pending'
          ? 'Аккаунт ожидает подтверждения администратором'
          : 'Аккаунт заблокирован администратором',
      );
    }
    return true;
  }
}
