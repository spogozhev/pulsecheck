import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { CONVERSION_QUEUE } from './conversion.constants';

const ALLOWED_EXTENSIONS = new Set(['pdf', 'pptx']);
const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;

/**
 * Busboy по умолчанию декодирует имя файла из multipart как latin-1, а браузеры
 * отправляют UTF-8 — восстанавливаем исходное имя; \uFFFD означает, что имя уже не битое.
 */
function decodeFilename(name: string): string {
  const repaired = Buffer.from(name, 'latin1').toString('utf8');
  return repaired.includes('\uFFFD') ? name : repaired;
}

@Injectable()
export class PresentationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(CONVERSION_QUEUE) private readonly conversionQueue: Queue,
  ) {}

  async create(file: Express.Multer.File | undefined, title: string | undefined, user: AuthUser) {
    if (!file) throw new BadRequestException('Файл не передан');
    if (file.size > MAX_UPLOAD_BYTES) throw new BadRequestException('Файл больше 300 МБ');

    const ext = path.extname(file.originalname ?? '').replace('.', '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException('Поддерживаются только файлы PDF и PPTX');
    }

    const id = randomUUID();
    const relativeDir = path.posix.join('originals', id);
    const storageDir = this.config.get<string>('storageDir')!;
    const absDir = path.join(storageDir, relativeDir);
    await mkdir(absDir, { recursive: true });
    const relativePath = path.posix.join(relativeDir, `original.${ext}`);
    await writeFile(path.join(storageDir, relativePath), file.buffer);

    const fallbackTitle = path
      .basename(decodeFilename(file.originalname ?? ''), path.extname(file.originalname ?? ''))
      .trim();
    const cleanTitle = (title ?? fallbackTitle).trim().slice(0, 200);

    const presentation = await this.prisma.presentation.create({
      data: {
        id,
        teacherId: user.id,
        title: cleanTitle || 'Презентация без названия',
        sourceType: ext,
        originalPath: relativePath,
        status: 'processing',
      },
    });

    try {
      await this.conversionQueue.add('convert', { presentationId: id });
    } catch (e) {
      await this.prisma.presentation.update({
        where: { id },
        data: { status: 'failed', error: `Очередь конвертации недоступна: ${String(e)}` },
      });
      throw new ServiceUnavailableException('Очередь конвертации недоступна, попробуйте позже');
    }

    return presentation;
  }

  async list(user: AuthUser) {
    return this.prisma.presentation.findMany({
      where: { teacherId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { slides: true, lectures: true } } },
    });
  }

  async getOwned(id: string, user: AuthUser) {
    const presentation = await this.prisma.presentation.findFirst({
      where: { id, teacherId: user.id },
      include: {
        slides: {
          orderBy: { index: 'asc' },
          include: { poll: { include: { options: { orderBy: { position: 'asc' } } } } },
        },
      },
    });
    if (!presentation) throw new NotFoundException('Презентация не найдена');
    return presentation;
  }

  async updateTitle(id: string, title: string, user: AuthUser) {
    await this.getOwned(id, user);
    return this.prisma.presentation.update({ where: { id }, data: { title: title.slice(0, 200) } });
  }

  async remove(id: string, user: AuthUser) {
    const presentation = await this.getOwned(id, user);

    const lecturesCount = await this.prisma.lecture.count({ where: { presentationId: id } });
    if (lecturesCount > 0) {
      throw new ConflictException(
        'Нельзя удалить презентацию, которая используется в истории лекций',
      );
    }

    const storageDir = this.config.get<string>('storageDir')!;
    await rm(path.join(storageDir, 'originals', id), { recursive: true, force: true });
    await rm(path.join(storageDir, 'slides', id), { recursive: true, force: true });
    await this.prisma.presentation.delete({ where: { id } });
  }

  async originalAbsolutePath(id: string, user: AuthUser): Promise<{ absPath: string; downloadName: string }> {
    const presentation = await this.getOwned(id, user);
    if (!presentation.originalPath) throw new NotFoundException('Оригинальный файл отсутствует');
    return {
      absPath: path.join(this.config.get<string>('storageDir')!, presentation.originalPath),
      downloadName: `${presentation.title}.${presentation.sourceType}`,
    };
  }
}
