import path from 'node:path';

export const configFactory = () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-jwt-secret',
  storageDir: process.env.STORAGE_DIR
    ? path.resolve(process.cwd(), process.env.STORAGE_DIR)
    : path.resolve(process.cwd(), '../storage'),
  libreofficePath: process.env.LIBREOFFICE_PATH ?? 'soffice',
  webOrigins: (process.env.WEB_ORIGIN ?? 'http://localhost:5180')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? 'http://localhost:5180').replace(/\/+$/, ''),
  isProd: process.env.NODE_ENV === 'production',
});
