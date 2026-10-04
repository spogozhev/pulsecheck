import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import JSZip from 'jszip';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PresentationsService } from './presentations.service';

export const PORTABLE_FORMAT = 'pulsecheck-presentation';
export const PORTABLE_VERSION = 1;
const MAX_SLIDES = 500;
const POLL_TYPES = new Set(['single', 'multiple', 'ranking']);

interface ManifestPollOption {
  text: string;
  position: number;
}

interface ManifestPoll {
  questionText: string;
  type: string;
  required?: boolean;
  options: ManifestPollOption[];
}

interface ManifestSlide {
  index: number;
  image?: string;
  poll?: ManifestPoll;
}

interface Manifest {
  format: string;
  version: number;
  title?: string;
  sourceType?: string;
  slides: ManifestSlide[];
}

/**
 * Portable-формат (§3.5 ТЗ): ZIP-архив с manifest.json, PNG-слайдами и опциональным
 * оригинальным файлом — для сохранности и переноса презентаций между установками.
 */
@Injectable()
export class PortableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly presentations: PresentationsService,
  ) {}

  async exportZip(id: string, user: AuthUser): Promise<{ buffer: Buffer; fileName: string }> {
    const presentation = await this.presentations.getOwned(id, user);
    if (presentation.status !== 'ready') {
      throw new BadRequestException('Презентация ещё обрабатывается — экспорт недоступен');
    }

    const zip = new JSZip();
    const storageDir = this.config.get<string>('storageDir')!;
    const manifest: Record<string, unknown> = {
      format: PORTABLE_FORMAT,
      version: PORTABLE_VERSION,
      exportedAt: new Date().toISOString(),
      title: presentation.title,
      sourceType: presentation.sourceType,
      slides: [] as ManifestSlide[],
    };
    const slides = manifest.slides as ManifestSlide[];

    for (const slide of presentation.slides) {
      const entry: ManifestSlide = { index: slide.index };
      if (slide.imagePath) {
        const fileName = `slides/${String(slide.index).padStart(3, '0')}.png`;
        zip.file(fileName, await readFile(path.join(storageDir, slide.imagePath)));
        entry.image = fileName;
      }
      if (slide.poll) {
        entry.poll = {
          questionText: slide.poll.questionText,
          type: slide.poll.type,
          required: slide.poll.required,
          options: [...slide.poll.options]
            .sort((a, b) => a.position - b.position)
            .map((o) => ({ text: o.text, position: o.position })),
        };
      }
      slides.push(entry);
    }

    if (presentation.originalPath) {
      zip.file(`original.${presentation.sourceType}`, await readFile(path.join(storageDir, presentation.originalPath)));
    }
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    const safeTitle = presentation.title.replace(/[^\p{L}\p{N}\- _]/gu, '').trim() || 'presentation';
    return { buffer, fileName: `${safeTitle}.pulsecheck.zip` };
  }

  async importZip(file: Express.Multer.File | undefined, titleOverride: string | undefined, user: AuthUser) {
    if (!file) throw new BadRequestException('Файл не передан');

    const zip = await JSZip.loadAsync(file.buffer).catch(() => {
      throw new BadRequestException('Не удалось прочитать архив — ожидается экспорт PulseCheck (.zip)');
    });
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      throw new BadRequestException('В архиве нет manifest.json — это не экспорт PulseCheck');
    }
    const manifest = JSON.parse(await manifestFile.async('string')) as Manifest;
    this.validateManifest(manifest);

    const id = randomUUID();
    const storageDir = this.config.get<string>('storageDir')!;
    const slidesDir = path.join(storageDir, 'slides', id);
    await mkdir(slidesDir, { recursive: true });

    // оригинальный файл (если вложен)
    let originalPath: string | null = null;
    const originalEntry = zip.file(`original.${manifest.sourceType}`);
    if (originalEntry) {
      const originalDir = path.join(storageDir, 'originals', id);
      await mkdir(originalDir, { recursive: true });
      await writeFile(path.join(originalDir, `original.${manifest.sourceType}`), await originalEntry.async('nodebuffer'));
      originalPath = `originals/${id}/original.${manifest.sourceType}`;
    }

    const created = await this.prisma.presentation.create({
      data: {
        id,
        teacherId: user.id,
        title: (titleOverride?.trim() || manifest.title || 'Импортированная презентация').slice(0, 200),
        sourceType: manifest.sourceType!,
        originalPath,
        status: 'ready',
        slideCount: manifest.slides.length,
      },
    });

    for (const slide of manifest.slides) {
      let imagePath: string | null = null;
      if (slide.image) {
        const entry = this.safeZipFile(zip, slide.image);
        if (!entry) throw new BadRequestException(`В архиве нет файла слайда: ${slide.image}`);
        const fileName = `${String(slide.index).padStart(3, '0')}.png`;
        await writeFile(path.join(slidesDir, fileName), await entry.async('nodebuffer'));
        imagePath = `slides/${id}/${fileName}`;
      }
      await this.prisma.slide.create({
        data: {
          presentationId: id,
          index: slide.index,
          imagePath,
          isGenerated: !slide.image,
          poll: slide.poll
            ? {
                create: {
                  questionText: slide.poll.questionText,
                  type: slide.poll.type,
                  required: slide.poll.required ?? true,
                  options: {
                    create: [...slide.poll.options]
                      .sort((a, b) => a.position - b.position)
                      .map((o, i) => ({ text: o.text, position: i })),
                  },
                },
              }
            : undefined,
        },
      });
    }

    return created;
  }

  private validateManifest(manifest: Manifest): void {
    if (!manifest || manifest.format !== PORTABLE_FORMAT) {
      throw new BadRequestException('Неподдерживаемый формат манифеста');
    }
    if (manifest.version !== PORTABLE_VERSION) {
      throw new BadRequestException(`Неподдерживаемая версия формата: ${String(manifest.version)}`);
    }
    if (manifest.sourceType !== 'pdf' && manifest.sourceType !== 'pptx') {
      throw new BadRequestException('В манифесте некорректный sourceType');
    }
    if (typeof manifest.title !== 'string' || manifest.title.trim().length === 0) {
      throw new BadRequestException('В манифесте нет названия презентации');
    }
    if (!Array.isArray(manifest.slides) || manifest.slides.length === 0) {
      throw new BadRequestException('В манифесте нет слайдов');
    }
    if (manifest.slides.length > MAX_SLIDES) {
      throw new BadRequestException(`Слишком много слайдов (максимум ${MAX_SLIDES})`);
    }

    const seenIndexes = new Set<number>();
    for (const slide of manifest.slides) {
      if (!Number.isInteger(slide.index) || slide.index < 0 || slide.index >= manifest.slides.length) {
        throw new BadRequestException('Некорректный индекс слайда');
      }
      if (seenIndexes.has(slide.index)) throw new BadRequestException('Дублирующийся индекс слайда');
      seenIndexes.add(slide.index);
      if (slide.image) this.assertSafeZipPath(slide.image);

      const poll = slide.poll;
      if (poll === undefined) continue;
      if (typeof poll.questionText !== 'string' || poll.questionText.trim().length < 3) {
        throw new BadRequestException('Некорректный текст вопроса в манифесте');
      }
      if (!POLL_TYPES.has(poll.type)) throw new BadRequestException(`Недопустимый тип опроса: ${String(poll.type)}`);
      if (!Array.isArray(poll.options) || poll.options.length < 2 || poll.options.length > 10) {
        throw new BadRequestException('Опрос должен содержать от 2 до 10 вариантов');
      }
      for (const option of poll.options) {
        if (typeof option?.text !== 'string' || option.text.trim().length === 0) {
          throw new BadRequestException('Пустой вариант ответа в манифесте');
        }
      }
    }
  }

  private assertSafeZipPath(zipPath: string): void {
    const normalized = path.posix.normalize(zipPath);
    if (normalized.startsWith('/') || normalized.startsWith('..') || normalized.includes('../')) {
      throw new BadRequestException('Недопустимый путь файла в архиве');
    }
  }

  private safeZipFile(zip: JSZip, zipPath: string) {
    this.assertSafeZipPath(zipPath);
    return zip.file(zipPath);
  }
}
