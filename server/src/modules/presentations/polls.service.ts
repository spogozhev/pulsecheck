import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
}
