import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Lecture, Poll, PollOption, Slide, User } from '@prisma/client';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { aggregateResults, PollResults } from '../lectures/results.helper';
import { computePseudonym, validateAnswerPayload } from './vote-logic';
import { SubmitAnswerDto } from './dto/vote.dto';

type SlideWithPoll = Slide & { poll: (Poll & { options: PollOption[] }) | null };
type LectureWithTeacher = Lecture & { teacher: User };

const ANON_COOKIE = 'anon';
const ANON_COOKIE_MS = 400 * 24 * 60 * 60 * 1000;

@Injectable()
export class VoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Публичная страница голосования: данные вопроса по коду сессии и индексу слайда. */
  async payload(code: string, slideIndex: number, req: Request, res: Response) {
    const { lecture, slide } = await this.resolve(code, slideIndex);
    const anonId = this.ensureAnon(req, res);

    const open = this.isOpen(lecture, slideIndex);
    const poll = slide.poll;

    let yourAnswer: { selectedOptionIds: string[]; rankingOrder: string[] } | null = null;
    if (poll) {
      const pseudonym = this.pseudonymFor(lecture, poll, anonId);
      const existing = await this.prisma.answer.findUnique({
        where: { lectureId_pollId_pseudonym: { lectureId: lecture.id, pollId: poll.id, pseudonym } },
      });
      if (existing) {
        yourAnswer = {
          selectedOptionIds: (existing.selectedOptionIds as string[] | null) ?? [],
          rankingOrder: (existing.rankingOrder as string[] | null) ?? [],
        };
      }
    }

    return {
      open,
      lectureTitle: lecture.title,
      question: poll
        ? {
            id: poll.id,
            type: poll.type,
            required: poll.required,
            questionText: poll.questionText,
            options: [...poll.options]
              .sort((a, b) => a.position - b.position)
              .map((o) => ({ id: o.id, text: o.text, position: o.position })),
          }
        : null,
      yourAnswer,
    };
  }

  /** Отправка/обновление ответа (анонимно, через псевдоним). */
  async submit(code: string, slideIndex: number, dto: SubmitAnswerDto, req: Request, res: Response) {
    const { lecture, slide } = await this.resolve(code, slideIndex);
    const anonId = this.ensureAnon(req, res);
    const poll = slide.poll;
    if (!poll) throw new NotFoundException('На этом слайде нет вопроса');

    if (!this.isOpen(lecture, slideIndex)) {
      throw new HttpException('Голосование по этому вопросу закрыто', HttpStatus.CONFLICT);
    }

    validateAnswerPayload(
      { type: poll.type, required: poll.required, optionIds: poll.options.map((o) => o.id) },
      dto,
    );

    const pseudonym = this.pseudonymFor(lecture, poll, anonId);
    const selected = dto.selectedOptionIds ?? [];
    const ranking = dto.rankingOrder ?? [];

    await this.prisma.answer.upsert({
      where: { lectureId_pollId_pseudonym: { lectureId: lecture.id, pollId: poll.id, pseudonym } },
      update: { selectedOptionIds: selected, rankingOrder: ranking },
      create: {
        lectureId: lecture.id,
        pollId: poll.id,
        pseudonym,
        selectedOptionIds: selected,
        rankingOrder: ranking,
      },
    });
    return { ok: true };
  }

  /** Итоги: доступны студенту только после закрытия вопроса (переход со слайда / конец лекции). */
  async results(code: string, slideIndex: number): Promise<{ closed: boolean; results?: PollResults }> {
    const { lecture, slide } = await this.resolve(code, slideIndex);
    if (!slide.poll) throw new NotFoundException('На этом слайде нет вопроса');

    if (!this.isClosed(lecture, slideIndex)) return { closed: false };

    const answers = await this.prisma.answer.findMany({
      where: { lectureId: lecture.id, pollId: slide.poll.id },
    });
    return { closed: true, results: aggregateResults(slide.poll, answers) };
  }

  private isOpen(lecture: Lecture, slideIndex: number): boolean {
    return lecture.status === 'active' && lecture.currentSlideIndex === slideIndex;
  }

  private isClosed(lecture: Lecture, slideIndex: number): boolean {
    return lecture.status !== 'active' || lecture.currentSlideIndex > slideIndex;
  }

  private async resolve(code: string, slideIndex: number): Promise<{ lecture: LectureWithTeacher; slide: SlideWithPoll }> {
    if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 10000) {
      throw new NotFoundException('Слайд не найден');
    }
    const lecture = await this.prisma.lecture.findUnique({
      where: { voteCode: code },
      include: { teacher: true },
    });
    if (!lecture) throw new NotFoundException('Сессия не найдена');

    const slide = await this.prisma.slide.findFirst({
      where: { presentationId: lecture.presentationId, index: slideIndex },
      include: { poll: { include: { options: true } } },
    });
    if (!slide) throw new NotFoundException('Слайд не найден');
    return { lecture, slide };
  }

  /**
   * Псевдоним устройства:
   *  - linkAnswers=true  -> HMAC(anon_id, teacher_salt): ответы связываются в рамках преподавателя (§3.2 ТЗ)
   *  - linkAnswers=false -> соль включает pollId: повторный голос учитывается, связь между вопросами невозможна
   */
  private pseudonymFor(lecture: LectureWithTeacher, poll: Poll, anonId: string): string {
    const key = lecture.linkAnswers
      ? lecture.teacher.salt
      : `${lecture.teacher.salt}:${lecture.id}:${poll.id}`;
    return computePseudonym(anonId, key);
  }

  /** Достаёт/создайёт anonymous_id: cookie -> X-Anon-Id (localStorage) -> новый UUID. */
  private ensureAnon(req: Request, res: Response): string {
    let anonId: string | undefined = req.cookies?.[ANON_COOKIE];
    if (!this.isValidUuid(anonId)) {
      const header = req.headers['x-anon-id'];
      anonId = Array.isArray(header) ? header[0] : header;
    }
    if (!this.isValidUuid(anonId)) anonId = randomUUID();

    res.cookie(ANON_COOKIE, anonId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<boolean>('isProd'),
      maxAge: ANON_COOKIE_MS,
      path: '/',
    });
    res.setHeader('X-Anon-Id', anonId);
    return anonId;
  }

  private isValidUuid(value: unknown): value is string {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }
}
