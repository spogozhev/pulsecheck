// Генерирует презентацию проекта PulseCheck для преподавателей:
//   npx tsx scripts/make-project-presentation.ts
// Результат: PulseCheck.pptx в корне проекта.
import { existsSync, renameSync } from 'node:fs';
import path from 'node:path';
import PptxGenJS from 'pptxgenjs';

// фирменный логотип в PNG (конвертируется из SVG: см. test-assets)
const LOGO_PNG = [path.resolve(process.cwd(), 'test-assets/pulsecheck-logo.png'),
  path.resolve(process.cwd(), '../test-assets/pulsecheck-logo.png')].find(existsSync);

const SKY = '0284C7';
const DARK = '0F172A';
const TEXT = '1E293B';
const GRAY = '64748B';
const LIGHT = 'F1F5F9';
const WHITE = 'FFFFFF';
const VIOLET = '7C3AED';

const W = 13.33;
const H = 7.5;

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'WIDE', width: W, height: H });
pptx.layout = 'WIDE';
pptx.author = 'PulseCheck';
pptx.title = 'PulseCheck — интерактивные опросы на лекциях';

// --- помощники ---

/** Заголовок раздела с акцентной полосой. */
function title(slide: PptxGenJS.Slide, text: string) {
  slide.addShape('rect', { x: 0.55, y: 0.55, w: 0.12, h: 0.85, fill: { color: SKY } });
  slide.addText(text, {
    x: 0.85, y: 0.4, w: W - 1.5, h: 1.1, fontSize: 30, bold: true, color: DARK,
    fontFace: 'Segoe UI',
  });
}

function bullets(slide: PptxGenJS.Slide, items: string[], opts: PptxGenJS.TextPropsOptions = {}) {
  slide.addText(
    items.map((t) => ({ text: t, options: { bullet: { code: '2022' }, breakLine: true } })),
    {
      x: 1.0, y: 1.9, w: W - 2.2, h: H - 3.0, fontSize: 20, color: TEXT,
      lineSpacingMultiple: 1.5, fontFace: 'Segoe UI', valign: 'top', ...opts,
    },
  );
}

// --- Слайд 1. Титул --- , h: 1.38 '7DD3FC' 'CBD5E1'
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  s.addImage({ path: LOGO_PNG, x: 0.55, y: 0.7, w: 8.0, h: 2.38 });
  s.addText('Интерактивные опросы прямо на лекции', {
    x: 0.55, y: 3.6, w: 12, h: 0.8, fontSize: 28, color: DARK, fontFace: 'Segoe UI',
  });
  s.addText('Превратите презентацию в диалог с аудиторией', {
    x: 0.55, y: 4.6, w: 12, h: 0.7, fontSize: 20, color: GRAY, fontFace: 'Segoe UI',
  });
  s.addShape('line', { x: 0.6, y: 6.4, w: 3.2, h: 0, line: { color: SKY, width: 2 } });
  s.addText('Для преподавателей', {
    x: 0.55, y: 6.55, w: 8, h: 0.5, fontSize: 14, color: '94A3B8', fontFace: 'Segoe UI',
  });
}

// --- Слайд 2. Проблема ---
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  title(s, 'Знакомая ситуация?');
  bullets(s, [
    'Лекция-монолог: студенты пассивны, включаются только конспект-детекторы',
    '«Понятно ли объяснено?» — ответ узнаётся только на экзамене',
    'Спросить аудиторию вслух — отвечают три смелых человека',
    'Бумажные опросы: раздать, собрать, обработать — пара ушла',
    'Сторонние сервисы: регистрация, лимиты вопросов, реклама',
  ]);
}

// --- Слайд 3. Решение ---
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  title(s, 'PulseCheck — опросы поверх вашей презентации');
  const rows: Array<[string, string]> = [
    ['Ваши слайды', 'Загрузите PDF или PowerPoint — вопросы добавляются на любые слайды'],
    ['Телефон вместо поднятой руки', 'Студенты отвечают с телефона: отсканировали QR — и всё'],
    ['Результаты вживую', 'Диаграмма ответов — на экране, пока аудитория ещё в зале'],
    ['Анонимно', 'Без регистрации и установки приложений'],
  ];
  rows.forEach(([head, text], i) => {
    const y = 1.85 + i * 1.28;
    s.addShape('roundRect', {
      x: 0.8, y, w: W - 1.8, h: 1.05, rectRadius: 0.1, fill: { color: LIGHT },
    });
    s.addText(head, {
      x: 1.05, y: y + 0.08, w: 3.6, h: 0.9, fontSize: 18, bold: true, color: SKY, valign: 'middle',
      fontFace: 'Segoe UI',
    });
    s.addText(text, {
      x: 4.8, y: y + 0.08, w: W - 5.9, h: 0.9, fontSize: 16, color: TEXT, valign: 'middle',
      fontFace: 'Segoe UI',
    });
  });
}

// --- Слайд 4. Как это работает ---
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  title(s, 'Как это работает — четыре шага');
  const steps: Array<[string, string]> = [
    ['1', 'Загрузите PDF или PowerPoint', 'слайды распознаются автоматически'],
    ['2', 'Добавьте вопросы', 'на существующие слайды или отдельными слайдами-вопросами'],
    ['3', 'Запустите лекцию', 'QR-код появляется на вопросе сам, всё в один клик'],
    ['4', 'Смотрите результаты', 'диаграмма ответов — на экране, студентам — итоги на телефон'],
  ];
  steps.forEach(([num, head, text], i) => {
    const x = 0.7 + i * 3.1;
    s.addShape('roundRect', {
      x, y: 2.0, w: 2.85, h: 3.4, rectRadius: 0.1, fill: { color: LIGHT },
    });
    s.addShape('ellipse', { x: x + 0.95, y: 2.3, w: 0.9, h: 0.9, fill: { color: SKY } });
    s.addText(num, {
      x: x + 0.95, y: 2.3, w: 0.9, h: 0.9, fontSize: 28, bold: true, color: WHITE,
      align: 'center', valign: 'middle', fontFace: 'Segoe UI',
    });
    s.addText(head, {
      x: x + 0.2, y: 3.4, w: 2.45, h: 0.9, fontSize: 16, bold: true, color: DARK,
      align: 'center', fontFace: 'Segoe UI',
    });
    s.addText(text, {
      x: x + 0.2, y: 4.3, w: 2.45, h: 1.0, fontSize: 12, color: GRAY, align: 'center',
      fontFace: 'Segoe UI',
    });
  });
  s.addText('От идеи до работающего опроса — меньше минуты', {
    x: 1.0, y: 6.2, w: W - 2.0, h: 0.6, fontSize: 18, italic: true, color: GRAY,
    align: 'center', fontFace: 'Segoe UI',
  });
}

// --- Слайд 5. Студенту ---
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  title(s, 'Студенту — один QR-код на всю пару');
  bullets(s, [
    'Отсканировал QR один раз — страница голосования открыта',
    'Новые вопросы появляются сами, обновлять ничего не нужно',
    'Ответил — увидел итоги группы; страница живёт всю пару',
    'Ничего устанавливать не нужно: работает в любом браузере телефона',
    'Регистрации нет — ответы анонимны',
  ]);
}

// --- Слайд 6. Типы вопросов ---
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  title(s, 'Три типа вопросов');
  const types: Array<[string, string, string]> = [
    ['Один вариант', 'Классический выбор: «Какая поверхность называется гиперболическим параболоидом?»', 'A'],
    ['Несколько вариантов', 'Все верные утверждения из списка — усложняет угадывание', 'B'],
    ['Ранжирование', 'Расставить по порядку: этапы, приоритеты, причины', 'C'],
  ];
  types.forEach(([head, text, letter], i) => {
    const y = 1.9 + i * 1.6;
    s.addShape('roundRect', { x: 0.9, y, w: W - 2.0, h: 1.35, rectRadius: 0.1, fill: { color: LIGHT } });
    s.addShape('ellipse', { x: 1.15, y: y + 0.3, w: 0.75, h: 0.75, fill: { color: SKY } });
    s.addText(letter, {
      x: 1.15, y: y + 0.3, w: 0.75, h: 0.75, fontSize: 22, bold: true, color: WHITE,
      align: 'center', valign: 'middle', fontFace: 'Segoe UI',
    });
    s.addText(head, {
      x: 2.15, y: y + 0.15, w: W - 3.4, h: 0.5, fontSize: 18, bold: true, color: DARK,
      fontFace: 'Segoe UI',
    });
    s.addText(text, {
      x: 2.15, y: y + 0.65, w: W - 3.4, h: 0.55, fontSize: 14, color: GRAY, fontFace: 'Segoe UI',
    });
  });
  s.addText('Плюс: ограничение времени на ответ — опрос закрывается сам, итоги появляются мгновенно', {
    x: 1.0, y: 6.7, w: W - 2.0, h: 0.5, fontSize: 14, italic: true, color: GRAY, fontFace: 'Segoe UI',
  });
}

// --- Слайд 7. Формулы ---
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  title(s, 'Формулы — как в учебнике');
  s.addText('Преподаватель пишет LaTeX в знаках доллара прямо в тексте вопроса:', {
    x: 1.0, y: 1.8, w: W - 2.0, h: 0.6, fontSize: 18, color: TEXT, fontFace: 'Segoe UI',
  });
  s.addShape('roundRect', {
    x: 1.0, y: 2.5, w: W - 2.0, h: 0.85, rectRadius: 0.08, fill: { color: DARK },
  });
  s.addText('$x^2-2x+1=0$   —   сколько корней у уравнения?', {
    x: 1.3, y: 2.5, w: W - 2.6, h: 0.85, fontSize: 20, color: 'E2E8F0', valign: 'middle',
    fontFace: 'Consolas',
  });
  s.addText('Студенты и слайд видят уже готовую формулу:', {
    x: 1.0, y: 3.6, w: W - 2.0, h: 0.6, fontSize: 18, color: TEXT, fontFace: 'Segoe UI',
  });
  s.addShape('roundRect', { x: 1.0, y: 4.3, w: W - 2.0, h: 1.1, rectRadius: 0.08, fill: { color: LIGHT } });
  s.addText(
    [
      { text: 'Решите уравнение:  ', options: { fontSize: 22, color: TEXT } },
      { text: 'x', options: { fontSize: 22, italic: true, color: TEXT } },
      { text: '2', options: { fontSize: 22, superscript: true, color: TEXT } },
      { text: ' − 2 x + 1 = 0.', options: { fontSize: 22, color: TEXT } },
    ],
    { x: 1.3, y: 4.3, w: W - 2.6, h: 1.1, valign: 'middle', fontFace: 'Segoe UI' },
  );
  bullets(s, [
    'Работает в вопросе и в каждом варианте ответа',
    'Дроби, корни, греческие буквы, интегралы — всё, что умеет KaTeX',
  ], { x: 1.0, y: 5.7, w: W - 2.0, h: 1.5, fontSize: 16, lineSpacingMultiple: 1.3 });
}

// --- Слайд 8. Результаты ---
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  title(s, 'Результаты — мгновенно и наглядно');
  bullets(s, [
    'По окончании голосования — полноэкранная диаграмма с процентами',
    'Для ранжирования — очки Борда и средние места',
    'Счётчик ответов в реальном времени прямо на слайде',
    'Таймер опроса: видно, сколько секунд осталось',
  ]);
  s.addText('После лекции', {
    x: 1.0, y: 5.5, w: 5, h: 0.6, fontSize: 20, bold: true, color: DARK, fontFace: 'Segoe UI',
  });
  s.addText(
    'История всех сессий с фильтрами по курсу, аналитика каждой лекции и экспорт результатов в CSV/JSON — в пару кликов.',
    {
      x: 1.0, y: 6.1, w: W - 2.0, h: 0.9, fontSize: 16, color: GRAY, fontFace: 'Segoe UI',
    },
  );
}

// --- Слайд 9. Порядок и приватность ---
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  title(s, 'Порядок и приватность');
  bullets(s, [
    'Ответы анонимны: личность студента не определяется',
    'Регистрации преподавателей подтверждает администратор',
    'Профиль: смена имени, email и пароля; восстановление по email',
    'Презентации — только ваши; сессии удаляются вместе с ответами',
    'Каждое значимое действие — в журнале аудита',
  ]);
}

// --- Слайд 10. Как попробовать ---
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  title(s, 'Попробовать — три команды');
  s.addText('https://github.com/spogozhev/pulsecheck', {
    x: 1.0, y: 1.25, w: 8, h: 0.5, fontSize: 16, color: TEXT, fontFace: 'Segoe UI',
  });
  const cmds: Array<[string, string]> = [
    ['npm install', 'зависимости'],
    ['npm run setup', 'база данных и администратор'],
    ['npm run dev', 'запуск'],
  ];
  cmds.forEach(([cmd, note], i) => {
    const y = 1.9 + i * 1.15;
    s.addShape('roundRect', { x: 1.0, y, w: 6.4, h: 0.85, rectRadius: 0.08, fill: { color: DARK } });
    s.addText(cmd, {
      x: 1.25, y, w: 6.0, h: 0.85, fontSize: 20, color: '7DD3FC', valign: 'middle',
      fontFace: 'Consolas',
    });
    s.addText(note, {
      x: 7.7, y, w: 5.0, h: 0.85, fontSize: 15, color: GRAY, valign: 'middle',
      fontFace: 'Segoe UI',
    });
  });
  s.addText('Готовый демо-доступ для знакомства:', {
    x: 1.0, y: 5.6, w: 8, h: 0.5, fontSize: 16, color: TEXT, fontFace: 'Segoe UI',
  });
  s.addShape('roundRect', { x: 1.0, y: 6.1, w: 7.6, h: 0.7, rectRadius: 0.08, fill: { color: LIGHT } });
  s.addText('demo@slide.local  /  demo12345', {
    x: 1.25, y: 6.1, w: 7.2, h: 0.7, fontSize: 16, color: DARK, valign: 'middle',
    fontFace: 'Consolas',
  });
  s.addText('Развернуть на своём сервере — инструкция в docs/deploy.md', {
    x: 1.0, y: 7.0, w: W - 2.0, h: 0.4, fontSize: 12, color: GRAY, fontFace: 'Segoe UI',
  });
}

// --- Слайд 11. Финал ---
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  s.addImage({ path: LOGO_PNG, x: 0.55, y: 0.7, w: 4.6, h: 1.38 });
  s.addText('Для преподавателей', {
    x: 0.55, y: 2.2, w: 8, h: 0.5, fontSize: 14, color: '94A3B8', fontFace: 'Segoe UI',
  });

  s.addText('Лекция, на которой отвечают', {
    x: 0.5, y: 2.85, w: 12, h: 1.2, fontSize: 44, bold: true, color: DARK, fontFace: 'Segoe UI',
  });
  s.addText('PulseCheck — задайте вопрос уже на следующей паре', {
    x: 0.55, y: 4.25, w: 12, h: 0.8, fontSize: 24, color: '7DD3FC', fontFace: 'Segoe UI',
  });
  s.addShape('line', { x: 0.6, y: 5.6, w: 3.2, h: 0, line: { color: SKY, width: 2 } });
  s.addText('demo@slide.local  /  demo12345', {
    x: 0.55, y: 5.75, w: 10, h: 0.6, fontSize: 18, color: 'CBD5E1', fontFace: 'Consolas',
  });
}

// путь не зависит от cwd: файл всегда кладётся в корень проекта
const tmpPath = path.resolve(process.cwd(), '../PulseCheck-deck-tmp.pptx');
const outPath = path.resolve(process.cwd(), '../PulseCheck.pptx');
pptx.writeFile({ fileName: tmpPath }).then(() => {
  renameSync(tmpPath, outPath);
  console.log('OK:', outPath);
});
