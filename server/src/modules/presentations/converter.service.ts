import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { access, copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
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

/** Целевая ширина PNG-слайдов в пикселях — меняется здесь. */
export const SLIDE_TARGET_WIDTH = 2560;

/**
 * Конвертация исходников в PNG-слайды:
 *   PPTX --LibreOffice--> PDF --pdf-to-img--> PNG (ширина SLIDE_TARGET_WIDTH, по умолчанию 2560 px)
 *   PDF --------------------------> PNG
 */
@Injectable()
export class ConverterService {
  private readonly logger = new Logger(ConverterService.name);
  private pdfLib: Promise<PdfToImg> | null = null;
  // ExpandAnimations работает в постоянном профиле — параллельные soffice в нём запрещены
  private expandQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly config: ConfigService) {}

  private loadPdfLib(): Promise<PdfToImg> {
    if (!this.pdfLib) this.pdfLib = nativeImport<PdfToImg>('pdf-to-img');
    return this.pdfLib;
  }

  /** Конвертирует PPTX в PDF, возвращает путь к полученному PDF. */
  async pptxToPdf(inputPath: string, workDir: string): Promise<string> {
    const profileDir = this.config.get<string>('libreofficeProfileDir');
    if (this.config.get<boolean>('expandAnimations') && profileDir) {
      try {
        const pdf = await this.expandAnimationsToPdf(inputPath, workDir, profileDir);
        this.logger.log('Анимации PPTX развёрнуты в отдельные слайды (ExpandAnimations)');
        return pdf;
      } catch (e) {
        this.logger.warn(
          `ExpandAnimations не сработал, конвертирую без разворачивания анимаций: ${(e as Error).message}`,
        );
      }
    }
    return this.plainPptxToPdf(inputPath, workDir);
  }

  /** Пошаговое разворачивание анимаций «по клику» плагином ExpandAnimations:
   *  слайд с N щелчками превращается в N+1 статичных кадров. Макрос сам пишет
   *  PDF рядом с копией входного файла и сам завершает LibreOffice. */
  private expandAnimationsToPdf(inputPath: string, workDir: string, profileDir: string): Promise<string> {
    const run = this.expandQueue.then(() => this.runExpandMacro(inputPath, workDir, profileDir));
    this.expandQueue = run.catch(() => undefined);
    return run;
  }

  private async runExpandMacro(inputPath: string, workDir: string, profileDir: string): Promise<string> {
    const srcPath = path.join(workDir, 'anim-src.pptx');
    await copyFile(inputPath, srcPath);
    await rm(path.join(workDir, 'anim-src.pdf'), { force: true });

    await this.runSoffice(
      [
        `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
        '--headless',
        '--norestore',
        '--nologo',
        '--nolockcheck',
        '--nodefault',
        'macro:///ExpandAnimations.ExpandAnimations.CommandLine',
      ],
      { EXPANDANIMATIONS_INPUT: srcPath },
    );

    const pdfPath = path.join(workDir, 'anim-src.pdf');
    try {
      await access(pdfPath);
    } catch {
      throw new Error('макрос не создал PDF');
    }
    // развёрнутая копия ODP не нужна — только PDF
    await rm(path.join(workDir, 'anim-src-expanded.odp'), { force: true });
    return pdfPath;
  }

  private async plainPptxToPdf(inputPath: string, workDir: string): Promise<string> {
    const profileDir = await mkdtemp(path.join(tmpdir(), 'pulsecheck-lo-'));
    await this.runSoffice(
      [
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
      ],
      undefined,
    );

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

  /** Запуск soffice с таймаутом; resolve при коде 0. */
  private runSoffice(args: string[], env?: Record<string, string>): Promise<string> {
    const soffice = this.config.get<string>('libreofficePath')!;
    return new Promise<string>((resolve, reject) => {
      const proc = spawn(soffice, args, {
        windowsHide: true,
        env: env ? { ...process.env, ...env } : process.env,
      });
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
  }

  /** Растеризует PDF в PNG-файлы вида 001.png, 002.png, ... в outDir.
   *  Ширина картинок приводится к SLIDE_TARGET_WIDTH (2560 px) независимо от исходника. */
  async rasterizePdf(pdfInput: string | Buffer, outDir: string): Promise<RasterizedPage[]> {
    const { pdf } = await this.loadPdfLib();

    // пробный рендер первой страницы при scale 1 — измеряем её ширину в пикселях,
    // чтобы вычислить масштаб под целевую ширину слайда
    const probe = await pdf(pdfInput, { scale: 1 });
    const probePng = await probe.getPage(1);
    const pageWidthPx = probePng.readUInt32BE(16); // ширина из заголовка PNG (IHDR)
    const scale = SLIDE_TARGET_WIDTH / pageWidthPx;

    const document = await pdf(pdfInput, { scale });
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
