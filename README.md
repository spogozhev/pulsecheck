# PulseCheck — сервис интерактивных опросов на лекциях

Преподаватель загружает презентацию (PDF/PPTX), добавляет на слайды вопросы
(single / multiple / ranking) и запускает лекцию в один клик. Студенты голосуют анонимно по
QR-коду с телефона; при переходе к следующему слайду на экране преподавателя появляются
результаты предыдущего вопроса.

- Исходное ТЗ: [TZ.md](./TZ.md) · План работ и решения: [PLAN.md](./PLAN.md)
- Руководство пользователя: [docs/user-guide.md](./docs/user-guide.md)
- Развёртывание и эксплуатация: [docs/deploy.md](./docs/deploy.md)

## Возможности

- Загрузка **PDF и PPTX** с автоматической серверной конвертацией в PNG-слайды
  (PPTX → PDF через LibreOffice headless, затем растеризация; очередь задач BullMQ + Redis).
- Опросы на любом слайде и отдельные «слайды-вопросы»: **один вариант, несколько вариантов,
  ранжирование** (итоги ранжирования — очки Борда и средние места).
- **Копирование слайдов вместе с опросами** между презентациями.
- **Portable-экспорт/импорт**: презентация целиком (слайды, опросы, оригинальный файл) в одном
  `.zip` — перенос между установками и резервная копия.
- **Сессии лекций**: запуск одной кнопкой, **один QR-код на всю лекцию** — страница студента сама
  открывает каждый новый вопрос и итоги; счётчик ответов в реальном времени, результаты предыдущего
  вопроса на чёрном слайде при смене, полная история лекций с фильтрами (дата/курс/статус).
- **Анонимность и приватность**: ответы не идентифицируют личность; устройство получает
  `anonymous_id` (cookie + localStorage); связывание ответов одного студента между вопросами —
  через необратимый псевдоним HMAC с солью преподавателя (всегда включено, только в рамках лекции).
- **Аналитика и экспорт**: распределения, темпы голосований, число участников; экспорт CSV/JSON.
- Аутентификация преподавателей: email+пароль (bcrypt), сессия в httpOnly-cookie, CSRF-защита,
  rate-limiting, аудит действий.
- **Модерация**: новые регистрации ожидают подтверждения администратора; до одобрения доступны
  только просмотр кабинета и выход. Администратор подтверждает и блокирует пользователей
  на странице «Пользователи».

## Стек

| Слой | Технологии |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS 4, React Query, qrcode.react |
| Backend | NestJS 11 (TypeScript), Prisma ORM, BullMQ |
| БД / очередь | PostgreSQL 16, Redis 7 (в docker compose) |
| Конвертация | LibreOffice headless (PPTX→PDF), pdf-to-img (PDF→PNG) |
| API-документация | Swagger/OpenAPI: `http://localhost:3001/api/docs` |

## Быстрый старт (dev, Windows/гибрид)

Требуется: **Node.js 24+**, **Docker Desktop**, **LibreOffice** (путь настраивается в `server/.env`).

```bash
npm install          # зависимости всех workspace (server, web)
npm run setup        # Postgres+Redis в Docker, миграции, демо-пользователь
npm run dev          # API на :3001 (nest watch), веб на :5180 (vite)
```

Демо-аккаунты (создаются сидом `npm run seed`):

| Роль | Логин | Пароль |
|---|---|---|
| Преподаватель | `demo@slide.local` | `demo12345` |
| Администратор | `admin@slide.local` | `admin12345` |

| Адрес | Что там |
|---|---|
| http://localhost:5180 | Веб-интерфейс (кабинет, плеер, голосование) |
| http://localhost:3001/api | REST API |
| http://localhost:3001/api/docs | Swagger UI |

## Скрипты

| Команда | Действие |
|---|---|
| `npm run dev` | API + веб параллельно (hot reload) |
| `npm run db:up` / `db:down` | Поднять/остановить Postgres и Redis |
| `npm run setup` | db:up + миграции + сид |
| `npm run migrate` | `prisma migrate dev` |
| `npm run seed` | демо-пользователь |
| `npm test` | unit + integration тесты (нужны запущенные docker-контейнеры) |
| `npm run build` | прод-сборка server (nest build) и web (vite build) |
| `npm run make:sample-pptx -w server` | тестовый PPTX в `test-assets/` |

## Тесты

`npm test` — 27 тестов: unit (агрегация результатов, валидация ответов, псевдонимизация) и
интеграционные («золотой путь»: регистрация → загрузка PDF → конвертация → опрос → лекция →
голосование → закрытие → аналитика → экспорт; roundtrip portable-экспорта/импорта; сценарий
модерации: pending → 403 → одобрение админом → доступ). Тесты используют отдельную БД
`slide_hz_test` и Redis db 1, dev-данные не затрагиваются.

## Конфигурация

Все переменные — в `server/.env` (шаблон с комментариями: `server/.env.example`):
`PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `STORAGE_DIR`, `LIBREOFFICE_PATH`,
`WEB_ORIGIN`, `PUBLIC_BASE_URL`.

## Структура

```
server/               NestJS API
  prisma/schema.prisma   модель данных (users, presentations, slides, polls, lectures, answers, audit)
  src/modules/           auth, presentations (конвертация), lectures, vote (публичное), storage, audit
web/                  React SPA
  src/pages/             Login, Presentations, PresentationDetail, Lectures, LectureDetail, Present, Vote
docs/                 руководства
storage/              файловое хранилище (оригиналы + PNG слайдов; gitignored)
```

## Что дальше

Из плана осталась только полная локализация интерфейса (сейчас русский; ТЗ §7 — «по желанию»).
Уже входят в поставку: portable импорт/экспорт презентаций, health-эндпоинт `/api/health`,
CI (.github/workflows/ci.yml), скрипт резервного копирования ops/backup.sh.
