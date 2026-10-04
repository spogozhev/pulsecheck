// Генерирует test-assets/sample.pptx (5 слайдов) для ручной и интеграционной проверки
// конвейера конвертации PPTX -> PDF -> PNG.
import PptxGenJS from 'pptxgenjs';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

async function main() {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  const slides: Array<{ title: string; body: string[]; color: string }> = [
    { title: 'PulseCheck — демо-презентация', body: ['Сервис интерактивных опросов', 'Студенты голосуют по QR-коду', 'Результаты — на следующем слайде'], color: '0F4C81' },
    { title: 'Как это работает', body: ['1. Загрузите PDF или PPTX', '2. Добавьте вопросы на слайды', '3. Запустите лекцию', '4. Покажите QR — студенты голосуют'], color: '1B6B4A' },
    { title: 'Типы вопросов', body: ['Один вариант (single choice)', 'Несколько вариантов (multiple choice)', 'Ранжирование (ranking)'], color: '7A3B8F' },
    { title: 'Ваш любимый язык?', body: ['Этот слайд можно пометить как вопрос', 'Варианты: Python / JS / C++ / Go'], color: 'B3541E' },
    { title: 'Спасибо!', body: ['Вопросы?', 'demo@slide.local'], color: '333333' },
  ];

  for (const s of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    slide.addText(s.title, { x: 0.5, y: 0.8, w: 9, h: 1.2, fontSize: 40, bold: true, color: s.color });
    slide.addText(s.body.map((t) => ({ text: t, options: { bullet: true } })), {
      x: 0.8, y: 2.2, w: 8.4, h: 2.6, fontSize: 24, color: '444444', lineSpacingMultiple: 1.4,
    });
  }

  const outDir = path.resolve(__dirname, '../../test-assets');
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'sample.pptx');
  await pptx.writeFile({ fileName: outFile });
  console.log('OK:', outFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
