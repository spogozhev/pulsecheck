import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { csrfMiddleware } from './common/middleware/csrf.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.use(csrfMiddleware);
  app.enableCors({
    origin: config.get<string[]>('webOrigins'),
    credentials: true,
  });
  app.useBodyParser('json', { limit: '1mb' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PulseCheck API')
    .setDescription('API сервиса интерактивных опросов во время лекций. Аутентификация — Bearer или cookie sid (CSRF-заголовок x-csrf-token для мутаций).')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get<number>('port')!;
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API запущено: http://localhost:${port}/api, Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
