import { execSync } from 'node:child_process';
import path from 'node:path';

const TEST_DB = process.env.TEST_DATABASE_URL
  ? undefined
  : 'slide_hz_test';
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://slide:slide@localhost:5432/slide_hz_test?schema=public';

/**
 * Готовит тестовую БД: создаёт (если нет), применяет миграции и очищает таблицы.
 * Требует запущенный docker compose (postgres + redis).
 */
export default async function globalSetup(): Promise<void> {
  if (TEST_DB) {
    try {
      execSync(
        `docker exec pulsecheck-postgres psql -U slide -d slide_hz -c "CREATE DATABASE ${TEST_DB} OWNER slide"`,
        { stdio: 'pipe' },
      );
    } catch {
      // база уже существует
    }
  }

  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL },
    stdio: 'pipe',
  });

  if (TEST_DB) {
    execSync(
      `docker exec pulsecheck-postgres psql -U slide -d ${TEST_DB} -c "TRUNCATE users, presentations, slides, polls, poll_options, lectures, answers, audit_logs CASCADE"`,
      { stdio: 'pipe' },
    );
  }
}
