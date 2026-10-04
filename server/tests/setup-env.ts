import path from 'node:path';

// Окружение каждого воркера до импорта модулей: отдельная тестовая БД и хранилище
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://slide:slide@localhost:5432/slide_hz_test?schema=public';
// отдельная логическая БД Redis, чтобы воркер dev-сервера (db 0) не перехватывал задания тестов
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.STORAGE_DIR = path.resolve(__dirname, '../storage-test');
process.env.PUBLIC_BASE_URL = 'http://localhost:5180';
