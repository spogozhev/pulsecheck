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
import { Prisma, PrismaClient } from '@prisma/client';
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
    const newIndex = afterIndex === undefined || afterIndex === null ? maxIndex + 1 : afterIndex + 1;
    if (newIndex < 0 || newIndex > maxIndex + 1) {
      throw new BadRequestException('Некорректная позиция вставки');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.shiftRange(tx, presentationId, newIndex, 'up');
      const slide = await tx.slide.create({
        data: { presentationId, index: newIndex, isGenerated: true },
      });
      await tx.presentation.update({
        where: { id: presentationId },
        data: { slideCount: { increment: 1 } },
      });
      return slide;
    });
  }

  async remove(presentationId: string, slideId: string, user: AuthUser) {
    const presentation = await this.presentations.getOwned(presentationId, user);
    const slide = presentation.slides.find((s) => s.id === slideId);
    if (!slide) throw new NotFoundException('Слайд не найден');
    await this.ensureNoActiveLecture(presentationId);

    await this.prisma.$transaction(async (tx) => {
      await tx.slide.delete({ where: { id: slideId } });
      await this.shiftRange(tx, presentationId, slide.index, 'down');
      await tx.presentation.update({
        where: { id: presentationId },
        data: { slideCount: { decrement: 1 } },
      });
    });
    return { ok: true };
  }

  /** Копирование слайдов (с опросами) между презентациями преподавателя. */
  async copy(dto: CopySlidesCommand, user: AuthUser) {
    if (!Array.isArray(dto.slideIds) || dto.slideIds.length === 0) {
      throw new BadRequestException('Не выбраны слайды для копирования');
    }
    if (dto.slideIds.length > 100) {
      throw new BadRequestException('Можно копировать не более 100 слайдов за раз');
    }

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

    const storageDir = this.config.get<string>('storageDir')!;
    const targetSlidesDir = path.join(storageDir, 'slides', dto.targetPresentationId);
    await mkdir(targetSlidesDir, { recursive: true });

    // файлы копируем заранее: транзакция должна оставаться короткой
    const preparedFiles: Array<{ index: number; fileName: string; sourcePath: string }> = [];
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const newIndex = base + i;
      if (src.imagePath) {
        const fileName = `${newIndex}-${randomBytes(4).toString('hex')}${path.extname(src.imagePath)}`;
        preparedFiles.push({
          index: newIndex,
          fileName,
          sourcePath: path.join(storageDir, src.imagePath),
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await this.shiftRange(tx, dto.targetPresentationId, base, 'up', sources.length);

      for (let i = 0; i < sources.length; i++) {
        const src = sources[i];
        const newIndex = base + i;

        let imagePath: string | null = null;
        const prepared = preparedFiles.find((f) => f.index === newIndex);
        if (prepared) {
          await copyFile(prepared.sourcePath, path.join(targetSlidesDir, prepared.fileName));
          imagePath = `slides/${dto.targetPresentationId}/${prepared.fileName}`;
        }

        await tx.slide.create({
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
      }

      await tx.presentation.update({
        where: { id: dto.targetPresentationId },
        data: { slideCount: { increment: sources.length } },
      });

      return { copied: sources.length, targetPresentationId: dto.targetPresentationId };
    });
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

  /**
   * Сдвигает слайды с индексом >= from на shift позиций (вверх) или на 1 позицию вниз.
   *
   * Индексы уникальны (presentation_id, index), а Postgres проверяет уникальность построчно
   * в непредсказуемом порядке — поэтому сдвиг делается в два конфликт-свободных прохода:
   * сначала все затронутые строки уезжают в свободную зону за пределами максимального индекса,
   * затем возвращаются уже на целевые позиции. Оба оператора выполняются в одной транзакции.
   */
  private async shiftRange(
    tx: Prisma.TransactionClient,
    presentationId: string,
    from: number,
    direction: 'up' | 'down',
    shift = 1,
  ): Promise<void> {
    const { _max } = await tx.slide.aggregate({
      _max: { index: true },
      where: { presentationId },
    });
    const bump = (_max.index ?? 0) + shift + 1;
    await tx.$executeRaw(
      Prisma.sql`UPDATE slides SET index = index + ${bump} WHERE presentation_id = ${presentationId} AND index >= ${from}`,
    );
    const second = direction === 'up' ? bump - shift : bump + 1;
    await tx.$executeRaw(
      Prisma.sql`UPDATE slides SET index = index - ${second} WHERE presentation_id = ${presentationId} AND index >= ${from}`,
    );
  }
}
