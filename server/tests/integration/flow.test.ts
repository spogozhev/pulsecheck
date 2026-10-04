import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AppModule } from '../../src/app.module';
import { csrfMiddleware } from '../../src/common/middleware/csrf.middleware';
import { PrismaService } from '../../src/prisma/prisma.service';
import { minimalPdf } from '../helpers';

describe('Интеграция: золотой путь (§13 ТЗ)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookies: string[] = [];
  let csrf: string;
  const email = `test-${Date.now()}-${Math.floor(Math.random() * 10000)}@slide.local`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.use(csrfMiddleware);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const authHeaders = () => ({ Cookie: cookies.join('; '), 'x-csrf-token': csrf });

  const captureCookies = (res: request.Response) => {
    const setCookies = res.headers['set-cookie'] ?? [];
    cookies = (Array.isArray(setCookies) ? setCookies : [setCookies]).map((c) => c.split(';')[0]);
    const csrfCookie = cookies.find((c) => c.startsWith('csrf='));
    csrf = csrfCookie ? csrfCookie.split('=')[1] : '';
  };

  it('регистрация и авто-вход', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'test-password-123', name: 'Тестовый Преподаватель' })
      .expect(201);
    captureCookies(res);
    expect(res.body.user.status).toBe('pending');

    // имитируем одобрение администратором (сам admin-API проверяется в сценарии модерации ниже)
    await prisma.user.update({ where: { id: res.body.user.id }, data: { status: 'approved' } });
    expect(csrf).toBeTruthy();
    process.env.TEST_USER_EMAIL = email;
    process.env.TEST_USER_PASSWORD = 'test-password-123';
  });

  it('без сессии доступ к кабинету запрещён', async () => {
    await request(app.getHttpServer()).get('/api/presentations').expect(401);
  });

  it('CSRF: мутация без заголовка отклоняется', async () => {
    await request(app.getHttpServer())
      .post('/api/presentations')
      .set('Cookie', cookies.join('; '))
      .expect(403);
  });

  it('загрузка PDF → конвертация в слайды; курс-тег и фильтры', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/presentations')
      .set(authHeaders())
      .field('title', 'Интеграционный тест')
      .field('course', 'Интеграция')
      .attach('file', minimalPdf(['Slide one', 'Slide two']), {
        filename: 'test.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    expect(res.body.status).toBe('processing');
    expect(res.body.course).toBe('Интеграция');

    // теги и фильтры по курсу
    const tags = await request(app.getHttpServer())
      .get('/api/presentations/tags')
      .set(authHeaders())
      .expect(200);
    expect(tags.body).toContain('Интеграция');

    const filtered = await request(app.getHttpServer())
      .get('/api/presentations?course=Интеграция')
      .set(authHeaders())
      .expect(200);
    expect(filtered.body.some((p: { title: string }) => p.title === 'Интеграционный тест')).toBe(true);

    const bySearch = await request(app.getHttpServer())
      .get('/api/presentations?search=интеграци')
      .set(authHeaders())
      .expect(200);
    expect(bySearch.body.some((p: { title: string }) => p.title === 'Интеграционный тест')).toBe(true);

    const other = await request(app.getHttpServer())
      .get('/api/presentations?course=Несуществующий курс')
      .set(authHeaders())
      .expect(200);
    expect(other.body.some((p: { title: string }) => p.title === 'Интеграционный тест')).toBe(false);

    let presentation = res.body;
    for (let i = 0; i < 40 && presentation.status === 'processing'; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const get = await request(app.getHttpServer())
        .get(`/api/presentations/${presentation.id}`)
        .set(authHeaders())
        .expect(200);
      presentation = get.body;
    }
    expect(presentation.status).toBe('ready');
    expect(presentation.slideCount).toBe(2);
    expect(presentation.slides[0].imagePath).toMatch(/\.png$/);

    // обновление свойств: смена курса и очистка
    await request(app.getHttpServer())
      .patch(`/api/presentations/${presentation.id}`)
      .set(authHeaders())
      .send({ course: 'Другая дисциплина' })
      .expect(200);
    const detail = await request(app.getHttpServer())
      .get(`/api/presentations/${presentation.id}`)
      .set(authHeaders())
      .expect(200);
    expect(detail.body.course).toBe('Другая дисциплина');
  });

  it('создание опроса на слайде (single) и валидация вариантов', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/presentations')
      .set(authHeaders())
      .expect(200);
    const presentation = list.body.find((p: { title: string }) => p.title === 'Интеграционный тест');

    const detail = await request(app.getHttpServer())
      .get(`/api/presentations/${presentation.id}`)
      .set(authHeaders())
      .expect(200);
    const slideId = detail.body.slides[0].id;

    // меньше двух вариантов — отклоняется
    await request(app.getHttpServer())
      .put(`/api/presentations/${presentation.id}/slides/${slideId}/poll`)
      .set(authHeaders())
      .send({ questionText: 'Вопрос?', type: 'single', options: [{ text: 'Один' }] })
      .expect(400);

    const poll = await request(app.getHttpServer())
      .put(`/api/presentations/${presentation.id}/slides/${slideId}/poll`)
      .set(authHeaders())
      .send({
        questionText: 'Любимый формат лекций?',
        type: 'single',
        required: true,
        options: [{ text: 'Очный' }, { text: 'Онлайн' }, { text: 'Гибрид' }],
      })
      .expect(200);
    expect(poll.body.options).toHaveLength(3);

    // сохраняем для голосования
    process.env.TEST_PRESENTATION_ID = presentation.id;
    process.env.TEST_SLIDE_ID = slideId;
    process.env.TEST_POLL_OPTION_IDS = JSON.stringify(
      (poll.body.options as { id: string }[]).map((o) => o.id),
    );
    process.env.TEST_POLL_OPTION_TEXTS = JSON.stringify(
      (poll.body.options as { text: string }[]).map((o) => o.text),
    );
  });

  it('запуск лекции и анонимное голосование', async () => {
    const lecture = await request(app.getHttpServer())
      .post('/api/lectures')
      .set(authHeaders())
      .send({ presentationId: process.env.TEST_PRESENTATION_ID, course: 'Интеграция' })
      .expect(201);
    // код сессии короткий (4 символа) — для QR-ссылки
    const code = lecture.body.voteCode;
    expect(code).toHaveLength(4);

    // страница студента: вопрос открыт
    const payload = await request(app.getHttpServer())
      .get(`/api/vote/${code}/0`)
      .set('X-Anon-Id', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
      .expect(200);
    expect(payload.body.open).toBe(true);
    expect(payload.body.question.questionText).toBe('Любимый формат лекций?');

    const [opt1, opt2] = JSON.parse(process.env.TEST_POLL_OPTION_IDS!);

    // первый ответ
    await request(app.getHttpServer())
      .post(`/api/vote/${code}/0/answer`)
      .set('X-Anon-Id', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
      .send({ selectedOptionIds: [opt1] })
      .expect(201);

    // переголосование тем же устройством перезаписывает ответ
    await request(app.getHttpServer())
      .post(`/api/vote/${code}/0/answer`)
      .set('X-Anon-Id', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
      .send({ selectedOptionIds: [opt2] })
      .expect(201);

    // второй студент
    await request(app.getHttpServer())
      .post(`/api/vote/${code}/0/answer`)
      .set('X-Anon-Id', '99999999-8888-4777-8666-555555555555')
      .send({ selectedOptionIds: [opt1] })
      .expect(201);

    // некорректный вариант отклоняется
    await request(app.getHttpServer())
      .post(`/api/vote/${code}/0/answer`)
      .set('X-Anon-Id', '77777777-6666-4555-8444-333333333333')
      .send({ selectedOptionIds: ['нет-такого'] })
      .expect(400);

    // счётчик голосов в presenter state учитывает оба ответа
    const stateRes = await request(app.getHttpServer())
      .get(`/api/lectures/${lecture.body.id}/state`)
      .set(authHeaders())
      .expect(200);
    expect(stateRes.body.slide.poll.votedCount).toBe(2);

    // публичное состояние сессии: активный вопрос на слайде 0
    const session = await request(app.getHttpServer()).get(`/api/vote/${code}`).expect(200);
    expect(session.body).toMatchObject({ active: true, slideIndex: 0, hasPoll: true, lectureTitle: 'Интеграционный тест' });

    // итоги скрыты, пока вопрос открыт
    const openResults = await request(app.getHttpServer())
      .get(`/api/vote/${code}/0/results`)
      .set('X-Anon-Id', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
      .expect(200);
    expect(openResults.body.closed).toBe(false);

    // преподаватель переключает слайд → вопрос закрыт, итоги доступны
    await request(app.getHttpServer())
      .patch(`/api/lectures/${lecture.body.id}/slide`)
      .set(authHeaders())
      .send({ index: 1 })
      .expect(200);

    const closedResults = await request(app.getHttpServer())
      .get(`/api/vote/${code}/0/results`)
      .set('X-Anon-Id', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
      .expect(200);
    expect(closedResults.body.closed).toBe(true);
    expect(closedResults.body.results.totalResponses).toBe(2);
    const byId = new Map(
      (closedResults.body.results.options as { id: string; count: number }[]).map((o) => [o.id, o.count]),
    );
    expect(byId.get(opt1)).toBe(1); // переголосование учтено: opt2 вместо opt1 у первого
    expect(byId.get(opt2)).toBe(1);

    // голосование в закрытый вопрос отклоняется
    await request(app.getHttpServer())
      .post(`/api/vote/${code}/0/answer`)
      .set('X-Anon-Id', '77777777-6666-4555-8444-333333333333')
      .send({ selectedOptionIds: [opt1] })
      .expect(409);

    // после перехода студент держит итоги (revealed=false — ещё не показаны)
    let sessionAfterTransition = await request(app.getHttpServer())
      .get(`/api/vote/${code}`)
      .expect(200);
    expect(sessionAfterTransition.body.revealed).toBe(false);

    // повторное нажатие вперёд снимает ожидание — как «Продолжить показ»
    await request(app.getHttpServer())
      .patch(`/api/lectures/${lecture.body.id}/slide`)
      .set(authHeaders())
      .send({ index: 1 })
      .expect(200);
    sessionAfterTransition = await request(app.getHttpServer())
      .get(`/api/vote/${code}`)
      .expect(200);
    expect(sessionAfterTransition.body.revealed).toBe(true);
  });

  it('аналитика и экспорт по лекции', async () => {
    const lectures = await request(app.getHttpServer())
      .get('/api/lectures?course=Интеграция')
      .set(authHeaders())
      .expect(200);
    expect(lectures.body.items).toHaveLength(1);
    const lectureId = lectures.body.items[0].id;

    const analytics = await request(app.getHttpServer())
      .get(`/api/lectures/${lectureId}/analytics`)
      .set(authHeaders())
      .expect(200);
    expect(analytics.body.polls).toHaveLength(1);
    expect(analytics.body.polls[0].results.totalResponses).toBe(2);
    expect(analytics.body.participants).toBe(2);

    const csv = await request(app.getHttpServer())
      .get(`/api/lectures/${lectureId}/export?format=csv`)
      .set(authHeaders())
      .expect(200);
    expect(String(csv.text)).toContain('Любимый формат лекций?');

    const json = await request(app.getHttpServer())
      .get(`/api/lectures/${lectureId}/export?format=json`)
      .set(authHeaders())
      .expect(200);
    expect(json.body.rawAnswers).toHaveLength(2);
  });

  it('пагинация списка и удаление завершённой лекции', async () => {
    // форма постраничного ответа
    const page1 = await request(app.getHttpServer())
      .get('/api/lectures?page=1&pageSize=1')
      .set(authHeaders())
      .expect(200);
    expect(Array.isArray(page1.body.items)).toBe(true);
    expect(page1.body.items).toHaveLength(1);
    expect(page1.body.total).toBeGreaterThanOrEqual(1);
    expect(page1.body.page).toBe(1);
    expect(page1.body.pageCount).toBeGreaterThanOrEqual(1);

    const lectureId = page1.body.items.find((l: { course: string }) => l.course === 'Интеграция')?.id;
    expect(lectureId).toBeTruthy();

    // активную лекцию удалить нельзя
    await request(app.getHttpServer())
      .delete(`/api/lectures/${lectureId}`)
      .set(authHeaders())
      .expect(409);

    // завершаем и удаляем — ответы удаляются каскадом
    await request(app.getHttpServer())
      .post(`/api/lectures/${lectureId}/finish`)
      .set(authHeaders())
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/lectures/${lectureId}`)
      .set(authHeaders())
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/lectures/${lectureId}/analytics`)
      .set(authHeaders())
      .expect(404);

    const after = await request(app.getHttpServer())
      .get('/api/lectures?course=Интеграция')
      .set(authHeaders())
      .expect(200);
    expect(after.body.total).toBe(0);
  });

  it('вставка слайда-вопроса в середину большой презентации (уникальность индексов)', async () => {
    const pages = Array.from({ length: 25 }, (_, i) => `Page ${i + 1}`);
    const res = await request(app.getHttpServer())
      .post('/api/presentations')
      .set(authHeaders())
      .attach('file', minimalPdf(pages), { filename: 'big.pdf', contentType: 'application/pdf' })
      .expect(201);

    let presentation = res.body;
    for (let i = 0; i < 40 && presentation.status === 'processing'; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      presentation = (
        await request(app.getHttpServer())
          .get(`/api/presentations/${presentation.id}`)
          .set(authHeaders())
          .expect(200)
      ).body;
    }
    expect(presentation.status).toBe('ready');
    expect(presentation.slideCount).toBe(25);

    // вставка слайда-вопроса в середину (после 10-го)
    const slide = await request(app.getHttpServer())
      .post(`/api/presentations/${presentation.id}/slides`)
      .set(authHeaders())
      .send({ afterIndex: 9 })
      .expect(201);
    expect(slide.body.index).toBe(10);

    const detail = await request(app.getHttpServer())
      .get(`/api/presentations/${presentation.id}`)
      .set(authHeaders())
      .expect(200);
    expect(detail.body.slideCount).toBe(26);
    expect(detail.body.slides.map((s: { index: number }) => s.index)).toEqual([...Array(26).keys()]);

    // удаление вставленного слайда — индексы снова сшиваются без дыр
    await request(app.getHttpServer())
      .delete(`/api/presentations/${presentation.id}/slides/${slide.body.id}`)
      .set(authHeaders())
      .expect(200);
    const after = await request(app.getHttpServer())
      .get(`/api/presentations/${presentation.id}`)
      .set(authHeaders())
      .expect(200);
    expect(after.body.slideCount).toBe(25);
    expect(after.body.slides.map((s: { index: number }) => s.index)).toEqual([...Array(25).keys()]);
  });

  it('копирование опроса на слайд той же презентации без опроса', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/api/presentations/${process.env.TEST_PRESENTATION_ID}`)
      .set(authHeaders())
      .expect(200);
    const source = detail.body.slides.find((s: { poll: unknown }) => s.poll);
    const target = detail.body.slides.find((s: { poll: unknown }) => !s.poll);
    expect(source).toBeTruthy();
    expect(target).toBeTruthy();

    const copy = await request(app.getHttpServer())
      .post(
        `/api/presentations/${process.env.TEST_PRESENTATION_ID}/slides/${target.id}/poll/copy`,
      )
      .set(authHeaders())
      .send({ fromSlideId: source.id })
      .expect(201);
    expect(copy.body.questionText).toBe('Любимый формат лекций?');
    expect(copy.body.options).toHaveLength(3);
    expect(copy.body.options[0].text).toBe('Очный');

    // на слайде с опросом копирование запрещено
    await request(app.getHttpServer())
      .post(`/api/presentations/${process.env.TEST_PRESENTATION_ID}/slides/${target.id}/poll/copy`)
      .set(authHeaders())
      .send({ fromSlideId: source.id })
      .expect(409);

    // копия редактируется независимо от оригинала
    await request(app.getHttpServer())
      .put(`/api/presentations/${process.env.TEST_PRESENTATION_ID}/slides/${target.id}/poll`)
      .set(authHeaders())
      .send({
        questionText: 'Копия с другим вопросом?',
        type: 'multiple',
        required: false,
        options: [{ text: 'Да' }, { text: 'Нет' }],
      })
      .expect(200);
    const original = await request(app.getHttpServer())
      .get(`/api/presentations/${process.env.TEST_PRESENTATION_ID}`)
      .set(authHeaders())
      .expect(200);
    const originalSlide = original.body.slides.find((s: { id: string }) => s.id === source.id);
    expect(originalSlide.poll.questionText).toBe('Любимый формат лекций?');
  });

  it('опрос с ограничением времени закрывается автоматически', async () => {
    // презентация big из теста выше: 25 слайдов без опросов
    const list = await request(app.getHttpServer())
      .get('/api/presentations?search=big')
      .set(authHeaders())
      .expect(200);
    const pres = list.body.find((p: { title: string }) => p.title === 'big');
    expect(pres).toBeTruthy();

    const detail = await request(app.getHttpServer())
      .get(`/api/presentations/${pres.id}`)
      .set(authHeaders())
      .expect(200);
    const slideId = detail.body.slides[0].id;

    const poll = await request(app.getHttpServer())
      .put(`/api/presentations/${pres.id}/slides/${slideId}/poll`)
      .set(authHeaders())
      .send({
        questionText: 'Быстрый вопрос?',
        type: 'single',
        required: true,
        timeLimitSeconds: 5,
        options: [{ text: 'А' }, { text: 'Б' }],
      })
      .expect(200);
    expect(poll.body.timeLimitSeconds).toBe(5);

    const lecture = await request(app.getHttpServer())
      .post('/api/lectures')
      .set(authHeaders())
      .send({ presentationId: pres.id })
      .expect(201);
    const { id: lectureId, voteCode: code } = lecture.body;

    // пока опрос открыт: студент отвечает, состояние открыто
    const anon = 'bbbbbbbb-cccc-4dddd-8eeee-ffffffffffff';
    const payload = await request(app.getHttpServer())
      .get(`/api/vote/${code}/0`)
      .set('X-Anon-Id', anon)
      .expect(200);
    expect(payload.body.open).toBe(true);
    const optionId = payload.body.question.options[0].id;
    await request(app.getHttpServer())
      .post(`/api/vote/${code}/0/answer`)
      .set('X-Anon-Id', anon)
      .send({ selectedOptionIds: [optionId] })
      .expect(201);
    const s1 = await request(app.getHttpServer()).get(`/api/vote/${code}`).expect(200);
    expect(s1.body.questionOpen).toBe(true);

    // ждём истечения лимита (5 с) с запасом
    await new Promise((r) => setTimeout(r, 6500));

    // вопрос закрыт по времени: голос отклоняется, итоги доступны, презентеру — к показу
    const s2 = await request(app.getHttpServer()).get(`/api/vote/${code}`).expect(200);
    expect(s2.body.questionOpen).toBe(false);
    await request(app.getHttpServer())
      .post(`/api/vote/${code}/0/answer`)
      .set('X-Anon-Id', anon)
      .send({ selectedOptionIds: [optionId] })
      .expect(409);
    const results = await request(app.getHttpServer())
      .get(`/api/vote/${code}/0/results`)
      .set('X-Anon-Id', anon)
      .expect(200);
    expect(results.body.closed).toBe(true);
    expect(results.body.results.totalResponses).toBe(1);

    const state = await request(app.getHttpServer())
      .get(`/api/lectures/${lectureId}/state`)
      .set(authHeaders())
      .expect(200);
    expect(state.body.pendingResults).toMatchObject({ slideIndex: 0, pollId: poll.body.id });

    await request(app.getHttpServer())
      .post(`/api/lectures/${lectureId}/finish`)
      .set(authHeaders())
      .expect(201);
  });
});

describe('Portable: экспорт и импорт презентации (§3.5 ТЗ)', () => {
  let app: INestApplication;
  let cookies: string[] = [];
  let csrf = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.use(csrfMiddleware);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const authHeaders = () => ({ Cookie: cookies.join('; '), 'x-csrf-token': csrf });

  it('экспорт → импорт сохраняет слайды, картинки и опросы', async () => {
    // сессия: административный вход тестовым преподавателем из золотого пути
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.TEST_USER_EMAIL,
        password: process.env.TEST_USER_PASSWORD,
      })
      .expect(200);
    const setCookies = login.headers['set-cookie'] ?? [];
    cookies = (Array.isArray(setCookies) ? setCookies : [setCookies]).map((c) => c.split(';')[0]);
    csrf = cookies.find((c) => c.startsWith('csrf='))?.split('=')[1] ?? '';

    // экспорт презентации с опросом из золотого пути
    const exportRes = await request(app.getHttpServer())
      .get(`/api/presentations/${process.env.TEST_PRESENTATION_ID}/export`)
      .set(authHeaders())
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (d) => chunks.push(d as Buffer));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(exportRes.headers['content-type']).toContain('application/zip');
    expect(exportRes.body.length).toBeGreaterThan(1000);

    // импорт того же архива
    const imported = await request(app.getHttpServer())
      .post('/api/presentations/import')
      .set(authHeaders())
      .attach('file', exportRes.body, { filename: 'roundtrip.pulsecheck.zip', contentType: 'application/zip' })
      .expect(201);
    expect(imported.body.status).toBe('ready');
    expect(imported.body.slideCount).toBe(2);

    const detail = await request(app.getHttpServer())
      .get(`/api/presentations/${imported.body.id}`)
      .set(authHeaders())
      .expect(200);
    expect(detail.body.slides).toHaveLength(2);
    expect(detail.body.slides[0].imagePath).toMatch(/\.png$/);

    const originalPoll = JSON.parse(process.env.TEST_POLL_OPTION_TEXTS!);
    const poll = detail.body.slides[0].poll;
    expect(poll.questionText).toBe('Любимый формат лекций?');
    expect(poll.type).toBe('single');
    expect(poll.options.map((o: { text: string }) => o.text)).toEqual(originalPoll);

    // картинка импортированного слайда отдаётся
    const imageFile = detail.body.slides[0].imagePath.split('/').pop();
    await request(app.getHttpServer())
      .get(`/api/storage/slides/${detail.body.slides[0].presentationId}/${imageFile}`)
      .set(authHeaders())
      .expect(200);
  });

  it('чужой/битый архив отклоняется с понятной ошибкой', async () => {
    const bad = await request(app.getHttpServer())
      .post('/api/presentations/import')
      .set(authHeaders())
      .attach('file', Buffer.from('not a zip'), { filename: 'bad.zip', contentType: 'application/zip' })
      .expect(400);
    expect(bad.body.message).toBeTruthy();
  });
});

describe('Модерация: подтверждение аккаунтов администратором', () => {  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const teacher = { email: `pending-${stamp}@slide.local`, password: 'password-123456', name: 'Ожидающий' };
  let teacherCookies: string[] = [];
  let teacherCsrf = '';
  let adminCookies: string[] = [];
  let adminCsrf = '';
  let userId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.use(csrfMiddleware);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    // администратор для тестов создаётся напрямую в БД
    await prisma.user.create({
      data: {
        email: `admin-${stamp}@slide.local`,
        name: 'Тестовый Админ',
        role: 'admin',
        status: 'approved',
        passwordHash: await bcrypt.hash('admin-password-1', 12),
        salt: randomBytes(16).toString('hex'),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const capture = (res: request.Response, which: 'teacher' | 'admin') => {
    const setCookies = res.headers['set-cookie'] ?? [];
    const cookies = (Array.isArray(setCookies) ? setCookies : [setCookies]).map((c) => c.split(';')[0]);
    const csrf = cookies.find((c) => c.startsWith('csrf='))?.split('=')[1] ?? '';
    if (which === 'teacher') {
      teacherCookies = cookies;
      teacherCsrf = csrf;
    } else {
      adminCookies = cookies;
      adminCsrf = csrf;
    }
  };
  const headers = (which: 'teacher' | 'admin') =>
    which === 'teacher'
      ? { Cookie: teacherCookies.join('; '), 'x-csrf-token': teacherCsrf }
      : { Cookie: adminCookies.join('; '), 'x-csrf-token': adminCsrf };

  it('регистрация создаёт аккаунт в статусе pending', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(teacher)
      .expect(201);
    capture(res, 'teacher');
    expect(res.body.user.status).toBe('pending');
    userId = res.body.user.id;
  });

  it('pending: чтение доступно, мутации запрещены (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/presentations')
      .set(headers('teacher'))
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/lectures')
      .set(headers('teacher'))
      .send({ presentationId: '00000000-0000-4000-8000-000000000000' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/presentations')
      .set(headers('teacher'))
      .expect(403);
  });

  it('pending не имеет доступа к админ-API (403), админ видит его в списке', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set(headers('teacher'))
      .expect(403);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `admin-${stamp}@slide.local`, password: 'admin-password-1' })
      .expect(200);
    capture(login, 'admin');

    const list = await request(app.getHttpServer())
      .get('/api/admin/users?status=pending')
      .set(headers('admin'))
      .expect(200);
    expect(list.body.some((u: { id: string }) => u.id === userId)).toBe(true);
  });

  it('после одобрения мутации проходят; блокировка снова их запрещает', async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/users/${userId}/approve`)
      .set(headers('admin'))
      .expect(201);

    const upload = await request(app.getHttpServer())
      .post('/api/presentations')
      .set(headers('teacher'))
      .attach('file', minimalPdf(['Одна']), { filename: 't.pdf', contentType: 'application/pdf' })
      .expect(201);
    expect(upload.body.status).toBe('processing');

    await request(app.getHttpServer())
      .post(`/api/admin/users/${userId}/block`)
      .set(headers('admin'))
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/lectures')
      .set(headers('teacher'))
      .send({ presentationId: upload.body.id })
      .expect(403);

    // блокированный не может даже войти
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(teacher)
      .expect(403);

    // повторное одобрение возвращает доступ
    await request(app.getHttpServer())
      .post(`/api/admin/users/${userId}/approve`)
      .set(headers('admin'))
      .expect(201);
    await request(app.getHttpServer()).get('/api/presentations').set(headers('teacher')).expect(200);
  });
});
