# PulseCheck — сервис интерактивных опросов на лекциях

Преподаватель загружает презентацию (PDF/PPTX), добавляет на слайды вопросы
(single / multiple / ranking) и запускает лекцию в один клик. Студенты голосуют анонимно по
QR-коду с телефона; при переходе к следующему слайду на экране преподавателя появляются
результаты предыдущего вопроса.

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
  вопроса на чёрном слайде при смене, история лекций с фильтрами, пагинацией и удалением сессий.
- **Анонимность и приватность**: ответы не идентифицируют личность; устройство получает
  `anonymous_id` (cookie + localStorage); связывание ответов одного студента между вопросами —
  через необратимый псевдоним HMAC с солью преподавателя (всегда включено, только в рамках лекции).
- **Аналитика и экспорт**: распределения, темпы голосований, число участников; экспорт CSV/JSON.
- **Математические формулы**: LaTeX в вопросе и вариантах — заключите в `$...$`
  (например, `$x^2-2x+1=0$`); рендерится через KaTeX на слайде, у студентов и в итогах.
- **Ограничение времени опроса**: обратный отсчёт на слайде и у студентов; по истечении опрос
  закрывается и итоги показываются автоматически.
- **Курс/дисциплина как тег**: презентации помечаются курсом, карточки фильтруются кликом по
  тегу `#курс`; запускаемые лекции наследуют курс для истории.
- **Профиль и восстановление пароля**: смена имени, email (с подтверждением паролем) и пароля;
  восстановление по email через одноразовую ссылку (30 минут, SMTP).
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

`npm test` — 35 тестов: unit (агрегация результатов, валидация ответов, псевдонимизация) и
интеграционные: «золотой путь» (регистрация → загрузка PDF → конвертация → опрос → лекция →
голосование → закрытие → аналитика → экспорт), roundtrip portable-экспорта/импорта, вставка
слайда в середину большой презентации (уникальность индексов), копирование опроса между слайдами,
опрос с ограничением времени, сценарий модерации, профиль и восстановление пароля. Тесты используют
отдельную БД `slide_hz_test` и Redis db 1, dev-данные не затрагиваются.

## Версионирование и рабочий процесс

Версия — [SemVer](https://semver.org/lang/ru/) `MAJOR.MINOR.PATCH`, единая для всего монорепо.
Текущая версия живёт в корневом `package.json`, видна в интерфейсе (сайдбар) и в `/api/health`;
каждая версия помечается git-тегом `vX.Y.Z` в момент релиза.

**Рабочий процесс:**

1. Фича или исправление разрабатывается в отдельной ветке от `master`:
   `git checkout -b feat/my-feature master`
2. `Pull Request` в `master`. Влитие — только после зелёного CI (сборка + все тесты);
   в GitHub для ветки `master` включите защиту: Settings → Branches → Add rule →
   Require a pull request + Require status checks (`CI / test`).
3. После влития обновите версию **в master** в зависимости от содержания:
   - исправление → `npm run release patch`  (0.1.0 → 0.1.1)
   - новая фича → `npm run release minor`   (0.1.0 → 0.2.0)
   - ломающее изменение → `npm run release major` (0.1.0 → 1.0.0)

   Скрипт сам поднимет версию во всех `package.json`, закоммитит `chore(release): vX.Y.Z`
   и поставит тег. Останется `git push && git push --tags`.

Тесты: `npm test` (см. раздел «Тесты»), сборка: `npm run build`. Шаблон описания PR —
`.github/pull_request_template.md`.

## Конфигурация

Все переменные — в `server/.env` (шаблон с комментариями: `server/.env.example`):
`PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `STORAGE_DIR`, `LIBREOFFICE_PATH`,
`WEB_ORIGIN`, `PUBLIC_BASE_URL`, а также `SMTP_HOST/PORT/USER/PASS` и `MAIL_FROM`
для писем о восстановлении пароля (без SMTP_HOST — dev-режим с выводом письма в консоль).

## Структура

```
server/               NestJS API
  prisma/schema.prisma  модель данных (users, presentations, slides, polls, lectures, answers,
                        password_reset_tokens, audit)
  src/modules/          auth, presentations (конвертация, portable), lectures, vote (публичное),
                        profile, admin, health, storage, audit
  src/shared/           mail.service (SMTP / dev-режим)
web/                  React SPA
  src/pages/            Login, PasswordRecovery, Presentations, PresentationDetail, Lectures,
                        LectureDetail, Present, Vote, Profile, AdminUsers
  src/components/       Logo, PollBuilder, ResultsView, CopySlidesDialog, MathText, Countdown
ops/backup.sh         резервное копирование (БД + хранилище)
.github/workflows/    CI: сборка и тесты
docs/                 руководства
storage/              файловое хранилище (оригиналы + PNG слайдов; gitignored)
```

