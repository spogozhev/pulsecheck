/** Генерация корректного минимального PDF с N страницами (для тестов конвейера). */
export function minimalPdf(pagesText: string[]): Buffer {
  const n = pagesText.length;
  const objects: Record<number, string> = {};

  const kids = Array.from({ length: n }, (_, i) => `${3 + i * 2} 0 R`).join(' ');
  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`;

  pagesText.forEach((text, i) => {
    const pageNum = 3 + i * 2;
    const contentNum = pageNum + 1;
    objects[pageNum] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentNum} 0 R ` +
      `/Resources << /Font << /F1 ${3 + n * 2} 0 R >> >> >>`;
    const stream = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`;
    objects[contentNum] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  });
  objects[3 + n * 2] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  const maxObj = 3 + n * 2;
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i <= maxObj; i++) {
    offsets[i] = Buffer.byteLength(out, 'latin1');
    out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= maxObj; i++) {
    out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}
