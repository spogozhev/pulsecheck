"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LecturesService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../../prisma/prisma.service");
const results_helper_1 = require("./results.helper");
const VOTE_CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
let LecturesService = class LecturesService {
    prisma;
    config;
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    async start(dto, user) {
        const presentation = await this.prisma.presentation.findFirst({
            where: { id: dto.presentationId, teacherId: user.id },
        });
        if (!presentation)
            throw new common_1.NotFoundException('Презентация не найдена');
        if (presentation.status === 'processing') {
            throw new common_1.ConflictException('Презентация ещё обрабатывается, дождитесь готовности слайдов');
        }
        if (presentation.status === 'failed') {
            throw new common_1.ConflictException('Не удалось обработать презентацию — загрузите файл заново');
        }
        if (presentation.slideCount === 0) {
            throw new common_1.ConflictException('В презентации нет слайдов');
        }
        const lecture = await this.prisma.lecture.create({
            data: {
                teacherId: user.id,
                presentationId: presentation.id,
                title: dto.title?.trim() || presentation.title,
                course: dto.course?.trim() || presentation.course || null,
                linkAnswers: true,
                slideCount: presentation.slideCount,
                currentSlideIndex: 0,
                voteCode: await this.generateVoteCode(),
            },
        });
        return (await this.decorate([lecture]))[0];
    }
    async list(dto, user) {
        const where = { teacherId: user.id };
        if (dto.status)
            where.status = dto.status;
        if (dto.course)
            where.course = { contains: dto.course, mode: 'insensitive' };
        if (dto.from || dto.to) {
            where.startedAt = {};
            if (dto.from) {
                const from = new Date(dto.from);
                if (isNaN(from.getTime()))
                    throw new common_1.BadRequestException('Некорректная дата "from"');
                where.startedAt.gte = from;
            }
            if (dto.to) {
                const to = new Date(dto.to);
                if (isNaN(to.getTime()))
                    throw new common_1.BadRequestException('Некорректная дата "to"');
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
    async remove(id, user) {
        const lecture = await this.getOwned(id, user);
        if (lecture.status === 'active') {
            throw new common_1.ConflictException('Сначала завершите лекцию — активную сессию удалить нельзя');
        }
        await this.prisma.lecture.delete({ where: { id } });
    }
    async state(id, user) {
        const lecture = await this.getOwned(id, user);
        let slide = await this.prisma.slide.findFirst({
            where: { presentationId: lecture.presentationId, index: lecture.currentSlideIndex },
            include: { poll: { include: { options: { orderBy: { position: 'asc' } } } } },
        });
        if (!slide && lecture.currentSlideIndex > 0) {
            slide = await this.prisma.slide.findFirst({
                where: { presentationId: lecture.presentationId, index: { lt: lecture.currentSlideIndex } },
                orderBy: { index: 'desc' },
                include: { poll: { include: { options: { orderBy: { position: 'asc' } } } } },
            });
        }
        let votedCount = 0;
        let pollPayload = null;
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
        let pendingSlide = lecture.pendingRevealSlideIndex !== null && lecture.resultsRevealedAt === null
            ? await this.prisma.slide.findFirst({
                where: {
                    presentationId: lecture.presentationId,
                    index: lecture.pendingRevealSlideIndex,
                },
                include: { poll: { select: { id: true } } },
            })
            : null;
        if (!pendingSlide &&
            slide?.poll?.timeLimitSeconds &&
            lecture.status === 'active' &&
            lecture.resultsRevealedAt === null &&
            Date.now() - lecture.slideChangedAt.getTime() > slide.poll.timeLimitSeconds * 1000) {
            pendingSlide = slide;
        }
        const pendingResults = pendingSlide?.poll ? { slideIndex: pendingSlide.index, pollId: pendingSlide.poll.id } : null;
        let secondsLeft = null;
        if (slide?.poll?.timeLimitSeconds && lecture.status === 'active') {
            secondsLeft = Math.max(0, Math.ceil((slide.poll.timeLimitSeconds * 1000 - (Date.now() - lecture.slideChangedAt.getTime())) / 1000));
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
    async setSlide(id, index, user) {
        const lecture = await this.getOwned(id, user);
        if (lecture.status !== 'active')
            throw new common_1.ConflictException('Лекция уже завершена');
        if (index < 0 || index >= lecture.slideCount) {
            throw new common_1.BadRequestException('Индекс слайда вне диапазона');
        }
        const leaveSlide = index > lecture.currentSlideIndex
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
        const wasPendingUnrevealed = lecture.pendingRevealSlideIndex !== null && lecture.resultsRevealedAt === null;
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
    async revealResults(id, user) {
        const lecture = await this.getOwned(id, user);
        if (lecture.status !== 'active')
            throw new common_1.ConflictException('Лекция уже завершена');
        await this.prisma.lecture.update({
            where: { id },
            data: { resultsRevealedAt: new Date() },
        });
        return { ok: true };
    }
    async finish(id, user) {
        const lecture = await this.getOwned(id, user);
        if (lecture.status === 'active') {
            await this.prisma.lecture.update({
                where: { id },
                data: { status: 'finished', endedAt: new Date() },
            });
        }
        return { ok: true };
    }
    async pollResults(id, pollId, user) {
        const lecture = await this.getOwned(id, user);
        const poll = await this.prisma.poll.findFirst({
            where: { id: pollId, slide: { presentationId: lecture.presentationId } },
            include: { options: true },
        });
        if (!poll)
            throw new common_1.NotFoundException('Опрос не найден');
        const answers = await this.prisma.answer.findMany({ where: { lectureId: id, pollId } });
        return (0, results_helper_1.aggregateResults)(poll, answers);
    }
    async analytics(id, user) {
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
        const polls = slides
            .filter((s) => s.poll)
            .map((s) => ({
            slideIndex: s.index,
            pollId: s.poll.id,
            questionText: s.poll.questionText,
            type: s.poll.type,
            results: (0, results_helper_1.aggregateResults)(s.poll, s.poll.answers),
            responseTimestamps: s.poll.answers.map((a) => a.createdAt.toISOString()),
        }));
        const participantSet = new Set();
        let totalAnswers = 0;
        for (const p of polls) {
            totalAnswers += p.results.totalResponses;
        }
        const allAnswers = await this.prisma.answer.findMany({
            where: { lectureId: id },
            select: { pseudonym: true },
        });
        for (const a of allAnswers)
            participantSet.add(a.pseudonym);
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
    async exportJson(id, user) {
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
    async exportCsv(id, user) {
        const slides = await this.prisma.slide.findMany({
            where: { presentationId: (await this.getOwned(id, user)).presentationId },
            include: { poll: { include: { options: true } } },
            orderBy: { index: 'asc' },
        });
        const optionText = new Map();
        for (const s of slides)
            for (const o of s.poll?.options ?? [])
                optionText.set(o.id, o.text);
        const answers = await this.prisma.answer.findMany({
            where: { lectureId: id },
            orderBy: { createdAt: 'asc' },
            include: { poll: true },
        });
        const esc = (v) => `"${v.replace(/"/g, '""')}"`;
        const rows = ['Вопрос;Тип;Ответ;Время;Псевдоним'];
        for (const a of answers) {
            let answer = 'пропуск';
            if (a.poll.type === 'ranking') {
                const order = a.rankingOrder ?? [];
                answer = order.map((oid) => optionText.get(oid) ?? oid).join(' > ') || 'пропуск';
            }
            else {
                const selected = a.selectedOptionIds ?? [];
                answer = selected.map((oid) => optionText.get(oid) ?? oid).join(' | ') || 'пропуск';
            }
            rows.push([esc(a.poll.questionText), a.poll.type, esc(answer), a.createdAt.toISOString(), a.pseudonym].join(';'));
        }
        return '\uFEFF' + rows.join('\r\n');
    }
    async getOwned(id, user) {
        const lecture = await this.prisma.lecture.findFirst({
            where: { id, teacherId: user.id },
            include: { presentation: { select: { id: true, title: true, sourceType: true } } },
        });
        if (!lecture)
            throw new common_1.NotFoundException('Лекция не найдена');
        return lecture;
    }
    async generateVoteCode() {
        for (let attempt = 0; attempt < 20; attempt++) {
            const bytes = (0, node_crypto_1.randomBytes)(8);
            let code = '';
            for (const b of bytes)
                code += VOTE_CODE_ALPHABET[b % VOTE_CODE_ALPHABET.length];
            code = code.slice(0, 4);
            const exists = await this.prisma.lecture.findUnique({ where: { voteCode: code } });
            if (!exists)
                return code;
        }
        throw new Error('Не удалось сгенерировать код сессии');
    }
    voteUrl(code) {
        return `${this.config.get('publicBaseUrl')}/v/${code}`;
    }
    async decorate(lectures) {
        if (lectures.length === 0)
            return [];
        const counts = await this.prisma.answer.groupBy({
            by: ['lectureId'],
            where: { lectureId: { in: lectures.map((l) => l.id) } },
            _count: { _all: true },
        });
        const map = new Map(counts.map((c) => [c.lectureId, c._count._all]));
        return lectures.map((l) => ({ ...l, answersCount: map.get(l.id) ?? 0 }));
    }
};
exports.LecturesService = LecturesService;
exports.LecturesService = LecturesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], LecturesService);
//# sourceMappingURL=lectures.service.js.map