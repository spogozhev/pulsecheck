import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message =
        typeof body === 'string' ? body : ((body as Record<string, unknown>).message ?? exception.message);
      return res.status(exception.getStatus()).json({ statusCode: exception.getStatus(), message });
    }

    // Известные ошибки Prisma -> понятные коды
    const prismaError = exception as { code?: string; message?: string };
    if (prismaError?.code === 'P2002') {
      return res.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: 'Нарушение уникальности данных',
      });
    }
    if (prismaError?.code === 'P2025') {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ statusCode: HttpStatus.NOT_FOUND, message: 'Объект не найден' });
    }

    this.logger.error((exception as { stack?: string })?.stack ?? String(exception));
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ statusCode: 500, message: 'Внутренняя ошибка сервера' });
  }
}
