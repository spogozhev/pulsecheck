import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PresentationsService } from './presentations.service';

export interface CopySlidesCommand {
  slideIds: string[];
  targetPresentationId: string;
  insertAfterIndex?: number;
}

@Injectable()
export class SlidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly presentations: PresentationsService,
  ) {}

  /** Создаёт слайд-вопрос (генерируемый сервисом, без исходного изображения). */
  async addGenerated(presentationId: string, afterIndex: number | undefined, user: AuthUser) {
    const presentation = await this.presentations.getOwned(presentationId, user);
    await this.ensureNoActiveLecture(presentationId);

    const maxIndex = presentation.slides.length
      ? Math.max(...presentation.slides.map((s) => s.index))
      : -1;
    const newIndex =
      afterIndex === undefined || afterIndex === null
        ? maxIndex + 1
        : afterIndex + 1;
    if (newIndex < 0 || newIndex > maxIndex + 1) {
      throw new BadRequestException('Некорректная позиция вставки');
    }

    await this.shiftUp(presentationId, newIndex);

    const slide = await this.prisma.slide.create({
      data: { presentationId, index: newIndex, isGenerated: true },
    });
    await this.prisma.presentation.update({
      where: { id: presentationId },
      data: { slideCount: { increment: 1 } },
    });
    return slide;
  }

  async remove(presentationId: string, slideId: string, user: AuthUser) {
    const presentation = await this.presentations.getOwned(presentationId, user);
    const slide = presentation.slides.find((s) => s.id === slideId);
    if (!slide) throw new NotFoundException('Слайд не найден');
    await this.ensureNoActiveLecture(presentationId);

    await this.prisma.slide.delete({ where: { id: slideId } });
    await this.shiftDown(presentationId, slide.index);
    await this.prisma.presentation.update({
      where: { id: presentationId },
      data: { slideCount: { decrement: 1 } },
    });
    return { ok: true };
  }

  /** Копирование слайдов (с опросами) между презентациями преподавателя. */
  async copy(dto: CopySlidesCommand, user: AuthUser) {
    if (!Array.isArray(dto.slideIds) || dto.slideIds.length === 0) {
      throw new BadRequestException('Не выбраны слайды для копирования');
    }
    if (dto.slideIds.length > 100) throw new BadRequestException('Можно копировать не более 100 слайдов за раз');

    const sources = await this.prisma.slide.findMany({
      where: { id: { in: dto.slideIds } },
      include: {
        presentation: { select: { teacherId: true } },
        poll: { include: { options: true } },
      },
      orderBy: [{ presentationId: 'asc' }, { index: 'asc' }],
    });
    if (sources.length !== dto.slideIds.length) {
      throw new NotFoundException('Часть выбранных слайдов не найдена');
    }
    if (sources.some((s) => s.presentation.teacherId !== user.id)) {
      throw new NotFoundException('Часть выбранных слайдов не найдена');
    }

    const target = await this.presentations.getOwned(dto.targetPresentationId, user);
    await this.ensureNoActiveLecture(dto.targetPresentationId);
    const sourcePresentationIds = new Set(sources.map((s) => s.presentationId));
    for (const pid of sourcePresentationIds) {
      await this.ensureNoActiveLecture(pid);
    }

    const maxIndex = target.slides.length ? Math.max(...target.slides.map((s) => s.index)) : -1;
    const base =
      dto.insertAfterIndex === undefined || dto.insertAfterIndex === null
        ? maxIndex + 1
        : dto.insertAfterIndex + 1;
    if (base < 0 || base > maxIndex + 1) {
      throw new BadRequestException('Некорректная позиция вставки');
    }

    await this.shiftUp(dto.targetPresentationId, base, sources.length);

    const storageDir = this.config.get<string>('storageDir')!;
    const targetSlidesDir = path.join(storageDir, 'slides', dto.targetPresentationId);
    await mkdir(targetSlidesDir, { recursive: true });

    const created: string[] = [];
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const newIndex = base + i;

      let imagePath: string | null = null;
      if (src.imagePath) {
        const ext = path.extname(src.imagePath);
        const fileName = `${newIndex}-${randomBytes(4).toString('hex')}${ext}`;
        await copyFile(
          path.join(storageDir, src.imagePath),
          path.join(targetSlidesDir, fileName),
        );
        imagePath = `slides/${dto.targetPresentationId}/${fileName}`;
      }

      await this.prisma.slide.create({
        data: {
          presentationId: dto.targetPresentationId,
          index: newIndex,
          imagePath,
          isGenerated: src.isGenerated,
          poll: src.poll
            ? {
                create: {
                  questionText: src.poll.questionText,
                  type: src.poll.type,
                  required: src.poll.required,
                  options: {
                    create: src.poll.options
                      .sort((a, b) => a.position - b.position)
                      .map((o) => ({ text: o.text, position: o.position })),
                  },
                },
              }
            : undefined,
        },
      });
      created.push(src.id);
    }

    await this.prisma.presentation.update({
      where: { id: dto.targetPresentationId },
      data: { slideCount: { increment: sources.length } },
    });

    return { copied: created.length, targetPresentationId: dto.targetPresentationId };
  }

  private async ensureNoActiveLecture(presentationId: string) {
    const active = await this.prisma.lecture.count({
      where: { presentationId, status: 'active' },
    });
    if (active > 0) {
      throw new ConflictException(
        'Идёт активная лекция по этой презентации — завершите её перед изменением слайдов',
      );
    }
  }

  /** index >= from сдвигаются вверх на shift позиций (сверху вниз, чтобы не ломать unique). */
  private async shiftUp(presentationId: string, from: number, shift = 1) {
    await this.prisma.$executeRaw(
      Prisma.sql`
        WITH ordered AS (
          SELECT id FROM slides
          WHERE presentation_id = ${presentationId} AND index >= ${from}
          ORDER BY index DESC
        )
        UPDATE slides SET index = slides.index + ${shift}
        FROM ordered WHERE slides.id = ordered.id
      `,
    );
  }

  private async shiftDown(presentationId: string, after: number) {
    await this.prisma.$executeRaw(
      Prisma.sql`
        WITH ordered AS (
          SELECT id FROM slides
          WHERE presentation_id = ${presentationId} AND index > ${after}
          ORDER BY index ASC
        )
        UPDATE slides SET index = slides.index - 1
        FROM ordered WHERE slides.id = ordered.id
      `,
    );
  }
}
