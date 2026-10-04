// Однократное исправление заголовков, испорченных latin1-декодированием имён файлов.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function repair(name: string): string {
  // чиним только строки, целиком состоящие из ASCII/latin-1 (последствия latin1-декодирования);
  // корректная кириллица содержит символы > 0xFF и не трогается
  if ([...name].some((c) => c.charCodeAt(0) > 0xff)) return name;
  const fixed = Buffer.from(name, 'latin1').toString('utf8');
  return fixed.includes('\uFFFD') ? name : fixed;
}

async function main() {
  const rows = await prisma.presentation.findMany({ select: { id: true, title: true } });
  for (const row of rows) {
    const fixed = repair(row.title);
    if (fixed !== row.title) {
      await prisma.presentation.update({ where: { id: row.id }, data: { title: fixed } });
      await prisma.lecture.updateMany({
        where: { presentationId: row.id, title: row.title },
        data: { title: fixed },
      });
      console.log(`fixed: "${row.title}" -> "${fixed}"`);
    }
  }
  console.log('done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
