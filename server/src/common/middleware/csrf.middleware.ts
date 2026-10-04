import { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Эндпоинты без сессии или с собственной моделью доверия
const CSRF_EXEMPT = [
  /^\/api\/auth\/(login|register|logout)$/,
  // восстановление пароля: публичные, защищены одноразовым токеном из письма
  /^\/api\/auth\/password\//,
  /^\/api\/vote(\/|$)/,
];

/**
 * Double-submit cookie: мутации требуют заголовок x-csrf-token, совпадающий с cookie csrf.
 * Запросы с Bearer-токеном (Swagger) проверкой не покрываются — токен не отправляется браузером автоматически.
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return next();
  if (CSRF_EXEMPT.some((re) => re.test(req.path))) return next();
  if (req.headers.authorization?.startsWith('Bearer ')) return next();

  const cookie = req.cookies?.csrf;
  const header = req.headers['x-csrf-token'];
  if (
    typeof cookie === 'string' &&
    typeof header === 'string' &&
    cookie.length === header.length &&
    cookie.length > 0 &&
    timingSafeEqual(Buffer.from(cookie), Buffer.from(header))
  ) {
    return next();
  }
  res.status(403).json({ statusCode: 403, message: 'Недействительный CSRF-токен' });
}
