import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PresentationsService } from './presentations.service';
import { SavePollDto } from './dto/poll.dto';

const POLL_TYPES = ['single', 'multiple', 'ranking'];

@Injectable()
export class PollsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presentations: PresentationsService,
  ) {}

  /** Создаёт или обновляет опрос на слайде (варианты заменяются целиком). */
  async save(presentationId: string, slideId: string, dto: SavePollDto, user: AuthUser) {
    if (!POLL_TYPES.includes(dto.type)) {
      throw new BadRequestException('Недопустимый тип опроса');
    }
    if (dto.options.some((o) => !o.text.trim())) {
      throw new BadRequestException('Текст варианта не может быть пустым');
    }

    const presentation = await this.presentations.getOwned(presentationId, user);
    const slide = presentation.slides.find((s) => s.id === slideId);
    if (!slide) throw new NotFoundException('Слайд не найден');

    const active = await this.prisma.lecture.count({
      where: { presentationId, status: 'active' },
    });
    if (active > 0) {
      throw new BadRequestException(
        'Нельзя изменять опрос во время активной лекции по этой презентации',
      );
    }

    const existing = await this.prisma.poll.findUnique({ where: { slideId } });

    const poll = existing
      ? await this.prisma.poll.update({
          where: { id: existing.id },
          data: {
            questionText: dto.questionText.trim(),
            type: dto.type,
            required: dto.required ?? true,
            options: {
              deleteMany: {},
              create: dto.options.map((o, i) => ({ text: o.text.trim(), position: i })),
            },
          },
          include: { options: { orderBy: { position: 'asc' } } },
        })
      : await this.prisma.poll.create({
          data: {
            slideId,
            questionText: dto.questionText.trim(),
            type: dto.type,
            required: dto.required ?? true,
            options: {
              create: dto.options.map((o, i) => ({ text: o.text.trim(), position: i })),
            },
          },
          include: { options: { orderBy: { position: 'asc' } } },
        });

    return poll;
  }

  async remove(presentationId: string, slideId: string, user: AuthUser) {
    const presentation = await this.presentations.getOwned(presentationId, user);
    const slide = presentation.slides.find((s) => s.id === slideId);
    if (!slide) throw new NotFoundException('Слайд не найден');
    if (!slide.poll) throw new NotFoundException('На слайде нет опроса');

    const active = await this.prisma.lecture.count({
      where: { presentationId, status: 'active' },
    });
    if (active > 0) {
      throw new BadRequestException('Нельзя изменять опрос во время активной лекции');
    }

    await this.prisma.poll.delete({ where: { id: slide.poll.id } });
    return { ok: true };
  }

  /** Копирует опрос с другого слайда этой же презентации на слайд без опроса. */
  async copyFromSlide(
    presentationId: string,
    targetSlideId: string,
    fromSlideId: string,
    user: AuthUser,
  ) {
    if (targetSlideId === fromSlideId) {
      throw new BadRequestException('Слайд-источник совпадает с целевым');
    }
    const presentation = await this.presentations.getOwned(presentationId, user);
    const target = presentation.slides.find((s) => s.id === targetSlideId);
    if (!target) throw new NotFoundException('Слайд не найден');
    if (target.poll) throw new ConflictException('На этом слайде уже есть опрос');

    const source = presentation.slides.find((s) => s.id === fromSlideId);
    if (!source) throw new NotFoundException('Слайд-источник не найден');
    if (!source.poll) throw new BadRequestException('На слайде-источнике нет опроса');

    const active = await this.prisma.lecture.count({
      where: { presentationId, status: 'active' },
    });
    if (active > 0) {
      throw new BadRequestException('Нельзя изменять опросы во время активной лекции');
    }

    return this.prisma.poll.create({
      data: {
        slideId: target.id,
        questionText: source.poll.questionText,
        type: source.poll.type,
        required: source.poll.required,
        options: {
          create: [...source.poll.options]
            .sort((a, b) => a.position - b.position)
            .map((o) => ({ text: o.text, position: o.position })),
        },
      },
      include: { options: { orderBy: { position: 'asc' } } },
    });
  }
}
