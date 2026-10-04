import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { access, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// pdf-to-img v4 — ESM с top-level await: TS-компиляция в CJS превратила бы
// динамический import() в require() и упала, поэтому вызываем нативный import()
const nativeImport = new Function('specifier', 'return import(specifier)') as <T>(specifier: string) => Promise<T>;
type PdfToImg = typeof import('pdf-to-img');

export interface RasterizedPage {
  number: number;
  fileName: string;
}

/**
 * Конвертация исходников в PNG-слайды:
 *   PPTX --LibreOffice--> PDF --pdf-to-img--> PNG (scale 2)
 *   PDF --------------------------> PNG
 */
@Injectable()
export class ConverterService {
  private readonly logger = new Logger(ConverterService.name);
  private pdfLib: Promise<PdfToImg> | null = null;

  constructor(private readonly config: ConfigService) {}

  private loadPdfLib(): Promise<PdfToImg> {
    if (!this.pdfLib) this.pdfLib = nativeImport<PdfToImg>('pdf-to-img');
    return this.pdfLib;
  }

  /** Конвертирует PPTX в PDF, возвращает путь к полученному PDF. */
  async pptxToPdf(inputPath: string, workDir: string): Promise<string> {
    const profileDir = await mkdtemp(path.join(tmpdir(), 'pulsecheck-lo-'));
    const args = [
      `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
      '--headless',
      '--norestore',
      '--nologo',
      '--nolockcheck',
      '--nodefault',
      '--convert-to',
      'pdf',
      '--outdir',
      workDir,
      inputPath,
    ];

    const soffice = this.config.get<string>('libreofficePath')!;
    const output = await new Promise<string>((resolve, reject) => {
      const proc = spawn(soffice, args, { windowsHide: true });
      let out = '';
      proc.stdout.on('data', (d) => (out += d.toString()));
      proc.stderr.on('data', (d) => (out += d.toString()));
      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Превышено время конвертации LibreOffice: ${out.slice(-500)}`));
      }, 180_000);
      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Не удалось запустить LibreOffice (${soffice}): ${err.message}`));
      });
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(out);
        else reject(new Error(`LibreOffice завершился с кодом ${code}: ${out.slice(-500)}`));
      });
    });
    this.logger.log(`LibreOffice: ${output.trim().split('\n').slice(-1)[0]}`);

    const pdfPath = path.join(
      workDir,
      path.basename(inputPath, path.extname(inputPath)) + '.pdf',
    );
    try {
      await access(pdfPath);
    } catch {
      throw new Error('LibreOffice не создал PDF-файл');
    }
    return pdfPath;
  }

  /** Растеризует PDF в PNG-файлы вида 001.png, 002.png, ... в outDir. */
  async rasterizePdf(pdfInput: string | Buffer, outDir: string): Promise<RasterizedPage[]> {
    const { pdf } = await this.loadPdfLib();
    const document = await pdf(pdfInput, { scale: 2 });
    const pageCount = document.length;
    if (!pageCount) throw new Error('PDF не содержит страниц');

    const pages: RasterizedPage[] = [];
    for (let i = 1; i <= pageCount; i++) {
      const buffer = await document.getPage(i);
      const fileName = `${String(i).padStart(3, '0')}.png`;
      await writeFile(path.join(outDir, fileName), buffer);
      pages.push({ number: i, fileName });
    }
    return pages;
  }
}
