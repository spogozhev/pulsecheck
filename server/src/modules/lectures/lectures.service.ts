import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { aggregateResults, PollResults } from './results.helper';
import { ListLecturesDto, StartLectureDto } from './dto/lecture.dto';

const VOTE_CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

export interface LectureAnalyticsPoll {
  slideIndex: number;
  pollId: string;
  questionText: string;
  type: string;
  results: PollResults;
  responseTimestamps: string[]; // моменты отправки ответов (динамика/темп)
}

export interface LectureAnalytics {
  lecture: {
    id: string;
    title: string;
    course: string | null;
    status: string;
    startedAt: Date;
    endedAt: Date | null;
    linkAnswers: boolean;
    voteCode: string;
    currentSlideIndex: number;
    slideCount: number;
  };
  presentation: { id: string; title: string; sourceType: string };
  polls: LectureAnalyticsPoll[];
  participants: number; // уникальных псевдонимов среди ответов
  totalAnswers: number;
}

@Injectable()
export class LecturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Запуск новой сессии лекции (одна кнопка — §8 ТЗ). */
  async start(dto: StartLectureDto, user: AuthUser) {
    const presentation = await this.prisma.presentation.findFirst({
      where: { id: dto.presentationId, teacherId: user.id },
    });
    if (!presentation) throw new NotFoundException('Презентация не найдена');
    if (presentation.status === 'processing') {
      throw new ConflictException('Презентация ещё обрабатывается, дождитесь готовности слайдов');
    }
    if (presentation.status === 'failed') {
      throw new ConflictException('Не удалось обработать презентацию — загрузите файл заново');
    }
    if (presentation.slideCount === 0) {
      throw new ConflictException('В презентации нет слайдов');
    }

    const lecture = await this.prisma.lecture.create({
      data: {
        teacherId: user.id,
        presentationId: presentation.id,
        title: dto.title?.trim() || presentation.title,
        // курс лекции наследуется от презентации, если не указан явно при запуске
        course: dto.course?.trim() || presentation.course || null,
        // связывание ответов одного студента между вопросами — всегда включено (§3.2 ТЗ)
        linkAnswers: true,
        slideCount: presentation.slideCount,
        currentSlideIndex: 0,
        voteCode: await this.generateVoteCode(),
      },
    });
    return (await this.decorate([lecture]))[0];
  }

  async list(dto: ListLecturesDto, user: AuthUser) {
    const where: Prisma.LectureWhereInput = { teacherId: user.id };
    if (dto.status) where.status = dto.status;
    if (dto.course) where.course = { contains: dto.course, mode: 'insensitive' };
    if (dto.from || dto.to) {
      where.startedAt = {};
      if (dto.from) {
        const from = new Date(dto.from);
        if (isNaN(from.getTime())) throw new BadRequestException('Некорректная дата "from"');
        where.startedAt.gte = from;
      }
      if (dto.to) {
        const to = new Date(dto.to);
        if (isNaN(to.getTime())) throw new BadRequestException('Некорректная дата "to"');
        to.setHours(23, 59, 59, 999);
        where.startedAt.lte = to;
      }
    }

    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;
    const [items, total] = await Promise.all([
      this.prisma.lecture.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { presentation: { select: { id: true, title: true } } },
      }),
      this.prisma.lecture.count({ where }),
    ]);

    return {
      items: await this.decorate(items),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /** Удаление завершённой лекции вместе с её ответами. Активную лекцию удалять нельзя. */
  async remove(id: string, user: AuthUser) {
    const lecture = await this.getOwned(id, user);
    if (lecture.status === 'active') {
      throw new ConflictException('Сначала завершите лекцию — активную сессию удалить нельзя');
    }
    await this.prisma.lecture.delete({ where: { id } }); // ответы удаляются каскадом
  }

  /** Текущее состояние лекции для presenter view (поллинг каждые 2-3 с). */
  async state(id: string, user: AuthUser) {
    const lecture = await this.getOwned(id, user);
    let slide = await this.prisma.slide.findFirst({
      where: { presentationId: lecture.presentationId, index: lecture.currentSlideIndex },
      include: { poll: { include: { options: { orderBy: { position: 'asc' } } } } },
    });
    // Слайд удалили уже после лекции — показываем ближайший существующий перед ним
    if (!slide && lecture.currentSlideIndex > 0) {
      slide = await this.prisma.slide.findFirst({
        where: { presentationId: lecture.presentationId, index: { lt: lecture.currentSlideIndex } },
        orderBy: { index: 'desc' },
        include: { poll: { include: { options: { orderBy: { position: 'asc' } } } } },
      });
    }

    let votedCount = 0;
    let pollPayload: unknown = null;
    if (slide?.poll) {
      votedCount = await this.prisma.answer.count({
        where: { lectureId: lecture.id, pollId: slide.poll.id },
      });
      pollPayload = {
        id: slide.poll.id,
        type: slide.poll.type,
        questionText: slide.poll.questionText,
        required: slide.poll.required,
        timeLimitSeconds: slide.poll.timeLimitSeconds,
        options: slide.poll.options.map((o) => ({ id: o.id, text: o.text, position: o.position })),
        votedCount,
      };
    }

    const answersTotal = await this.prisma.answer.count({ where: { lectureId: lecture.id } });

    // Итоги предыдущего вопроса ожидают показа: ушли вперёд со слайда с ответами,
    // преподаватель ещё не нажимал «Продолжить показ» и не переходил дальше
    let pendingSlide =
      lecture.pendingRevealSlideIndex !== null && lecture.resultsRevealedAt === null
        ? await this.prisma.slide.findFirst({
            where: {
              presentationId: lecture.presentationId,
              index: lecture.pendingRevealSlideIndex,
            },
            include: { poll: { select: { id: true } } },
          })
        : null;

    // Опрос текущего слайда с ограничением времени: время вышло — итоги ожидают показа
    if (
      !pendingSlide &&
      slide?.poll?.timeLimitSeconds &&
      lecture.status === 'active' &&
      lecture.resultsRevealedAt === null &&
      Date.now() - lecture.slideChangedAt.getTime() > slide.poll.timeLimitSeconds * 1000
    ) {
      pendingSlide = slide;
    }
    const pendingResults =
      pendingSlide?.poll ? { slideIndex: pendingSlide.index, pollId: pendingSlide.poll.id } : null;

    // Обратный отсчёт текущего опроса (для презентера)
    let secondsLeft: number | null = null;
    if (slide?.poll?.timeLimitSeconds && lecture.status === 'active') {
      secondsLeft = Math.max(
        0,
        Math.ceil(
          (slide.poll.timeLimitSeconds * 1000 - (Date.now() - lecture.slideChangedAt.getTime())) / 1000,
        ),
      );
    }

    return {
      id: lecture.id,
      title: lecture.title,
      course: lecture.course,
      status: lecture.status,
      currentSlideIndex: lecture.currentSlideIndex,
      slideCount: lecture.slideCount,
      voteCode: lecture.voteCode,
      voteUrl: this.voteUrl(lecture.voteCode),
      linkAnswers: lecture.linkAnswers,
      startedAt: lecture.startedAt,
      answersTotal,
      pendingResults,
      secondsLeft,
      presentation: { id: lecture.presentationId, title: lecture.presentation.title },
      slide: slide
        ? {
            index: slide.index,
            hasImage: !!slide.imagePath,
            imageUrl: slide.imagePath ? `/api/storage/${slide.imagePath}` : null,
            isGenerated: slide.isGenerated,
            poll: pollPayload,
            votedCount,
          }
        : null,
    };
  }

  async setSlide(id: string, index: number, user: AuthUser) {
    const lecture = await this.getOwned(id, user);
    if (lecture.status !== 'active') throw new ConflictException('Лекция уже завершена');
    if (index < 0 || index >= lecture.slideCount) {
      throw new BadRequestException('Индекс слайда вне диапазона');
    }

    // Уход вперёд со слайда с опросом, по которому есть ответы, показывает его итоги
    // (чёрный экран с результатами). Переход к следующему слайду убирает оверлей
    // и снимает ожидание студентов — как кнопка «Продолжить показ».
    const leaveSlide =
      index > lecture.currentSlideIndex
        ? await this.prisma.slide.findFirst({
            where: { presentationId: lecture.presentationId, index: lecture.currentSlideIndex },
            include: { poll: { select: { id: true } } },
          })
        : null;
    const leaveHasAnswers = leaveSlide?.poll
      ? (await this.prisma.answer.count({
          where: { lectureId: id, pollId: leaveSlide.poll.id },
        })) > 0
      : false;
    const wasPendingUnrevealed =
      lecture.pendingRevealSlideIndex !== null && lecture.resultsRevealedAt === null;

    await this.prisma.lecture.update({
      where: { id },
      data: {
        currentSlideIndex: index,
        slideChangedAt: new Date(),
        resultsRevealedAt: leaveHasAnswers ? null : wasPendingUnrevealed ? new Date() : null,
        pendingRevealSlideIndex: leaveHasAnswers ? lecture.currentSlideIndex : null,
      },
    });
    return this.state(id, user);
  }

  /** Преподаватель показал итоги предыдущего вопроса («Продолжить показ») — студентам открывается следующий вопрос. */
  async revealResults(id: string, user: AuthUser) {
    const lecture = await this.getOwned(id, user);
    if (lecture.status !== 'active') throw new ConflictException('Лекция уже завершена');
    await this.prisma.lecture.update({
      where: { id },
      data: { resultsRevealedAt: new Date() },
    });
    return { ok: true };
  }

  async finish(id: string, user: AuthUser) {
    const lecture = await this.getOwned(id, user);
    if (lecture.status === 'active') {
      await this.prisma.lecture.update({
        where: { id },
        data: { status: 'finished', endedAt: new Date() },
      });
    }
    return { ok: true };
  }

  /** Результаты конкретного опроса в рамках лекции (для презентера). */
  async pollResults(id: string, pollId: string, user: AuthUser): Promise<PollResults> {
    const lecture = await this.getOwned(id, user);
    const poll = await this.prisma.poll.findFirst({
      where: { id: pollId, slide: { presentationId: lecture.presentationId } },
      include: { options: true },
    });
    if (!poll) throw new NotFoundException('Опрос не найден');
    const answers = await this.prisma.answer.findMany({ where: { lectureId: id, pollId } });
    return aggregateResults(poll, answers);
  }

  async analytics(id: string, user: AuthUser): Promise<LectureAnalytics> {
    const lecture = await this.getOwned(id, user);
    const slides = await this.prisma.slide.findMany({
      where: { presentationId: lecture.presentationId },
      orderBy: { index: 'asc' },
      include: {
        poll: {
          include: {
            options: true,
            answers: { where: { lectureId: id }, orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    const polls: LectureAnalyticsPoll[] = slides
      .filter((s) => s.poll)
      .map((s) => ({
        slideIndex: s.index,
        pollId: s.poll!.id,
        questionText: s.poll!.questionText,
        type: s.poll!.type,
        results: aggregateResults(s.poll!, s.poll!.answers),
        responseTimestamps: s.poll!.answers.map((a) => a.createdAt.toISOString()),
      }));

    const participantSet = new Set<string>();
    let totalAnswers = 0;
    for (const p of polls) {
      totalAnswers += p.results.totalResponses;
    }
    const allAnswers = await this.prisma.answer.findMany({
      where: { lectureId: id },
      select: { pseudonym: true },
    });
    for (const a of allAnswers) participantSet.add(a.pseudonym);

    return {
      lecture: {
        id: lecture.id,
        title: lecture.title,
        course: lecture.course,
        status: lecture.status,
        startedAt: lecture.startedAt,
        endedAt: lecture.endedAt,
        linkAnswers: lecture.linkAnswers,
        voteCode: lecture.voteCode,
        currentSlideIndex: lecture.currentSlideIndex,
        slideCount: lecture.slideCount,
      },
      presentation: {
        id: lecture.presentation.id,
        title: lecture.presentation.title,
        sourceType: lecture.presentation.sourceType,
      },
      polls,
      participants: participantSet.size,
      totalAnswers,
    };
  }

  async exportJson(id: string, user: AuthUser) {
    const analytics = await this.analytics(id, user);
    const answers = await this.prisma.answer.findMany({
      where: { lectureId: id },
      orderBy: { createdAt: 'asc' },
      include: { poll: { select: { questionText: true, type: true } } },
    });
    return {
      ...analytics,
      rawAnswers: answers.map((a) => ({
        pollId: a.pollId,
        question: a.poll.questionText,
        type: a.poll.type,
        pseudonym: a.pseudonym,
        selectedOptionIds: a.selectedOptionIds,
        rankingOrder: a.rankingOrder,
        createdAt: a.createdAt,
      })),
    };
  }

  async exportCsv(id: string, user: AuthUser): Promise<string> {
    const slides = await this.prisma.slide.findMany({
      where: { presentationId: (await this.getOwned(id, user)).presentationId },
      include: { poll: { include: { options: true } } },
      orderBy: { index: 'asc' },
    });
    const optionText = new Map<string, string>();
    for (const s of slides) for (const o of s.poll?.options ?? []) optionText.set(o.id, o.text);

    const answers = await this.prisma.answer.findMany({
      where: { lectureId: id },
      orderBy: { createdAt: 'asc' },
      include: { poll: true },
    });

    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = ['Вопрос;Тип;Ответ;Время;Псевдоним'];
    for (const a of answers) {
      let answer = 'пропуск';
      if (a.poll.type === 'ranking') {
        const order = (a.rankingOrder as string[] | null) ?? [];
        answer = order.map((oid) => optionText.get(oid) ?? oid).join(' > ') || 'пропуск';
      } else {
        const selected = (a.selectedOptionIds as string[] | null) ?? [];
        answer = selected.map((oid) => optionText.get(oid) ?? oid).join(' | ') || 'пропуск';
      }
      rows.push(
        [esc(a.poll.questionText), a.poll.type, esc(answer), a.createdAt.toISOString(), a.pseudonym].join(';'),
      );
    }
    return '\uFEFF' + rows.join('\r\n');
  }

  private async getOwned(id: string, user: AuthUser) {
    const lecture = await this.prisma.lecture.findFirst({
      where: { id, teacherId: user.id },
      include: { presentation: { select: { id: true, title: true, sourceType: true } } },
    });
    if (!lecture) throw new NotFoundException('Лекция не найдена');
    return lecture;
  }

  private async generateVoteCode(): Promise<string> {
    // Короткий код для QR-ссылки (4 символа, ~920 тыс. комбинаций);
    // при коллизии (код уже занят) генерация повторяется
    for (let attempt = 0; attempt < 20; attempt++) {
      const bytes = randomBytes(8);
      let code = '';
      for (const b of bytes) code += VOTE_CODE_ALPHABET[b % VOTE_CODE_ALPHABET.length];
      code = code.slice(0, 4);
      const exists = await this.prisma.lecture.findUnique({ where: { voteCode: code } });
      if (!exists) return code;
    }
    throw new Error('Не удалось сгенерировать код сессии');
  }

  private voteUrl(code: string): string {
    // QR-код один на всю лекцию: страница студента сама открывает каждый новый вопрос
    return `${this.config.get<string>('publicBaseUrl')}/v/${code}`;
  }

  /** Добавляет счётчики ответов к списку лекций (для истории). */
  private async decorate<T extends { id: string }>(lectures: T[]) {
    if (lectures.length === 0) return [];
    const counts = await this.prisma.answer.groupBy({
      by: ['lectureId'],
      where: { lectureId: { in: lectures.map((l) => l.id) } },
      _count: { _all: true },
    });
    const map = new Map(counts.map((c) => [c.lectureId, c._count._all]));
    return lectures.map((l) => ({ ...l, answersCount: map.get(l.id) ?? 0 }));
  }
}
