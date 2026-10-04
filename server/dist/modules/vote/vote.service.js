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
exports.VoteService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../../prisma/prisma.service");
const results_helper_1 = require("../lectures/results.helper");
const vote_logic_1 = require("./vote-logic");
const ANON_COOKIE = 'anon';
const ANON_COOKIE_MS = 400 * 24 * 60 * 60 * 1000;
let VoteService = class VoteService {
    prisma;
    config;
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    async sessionState(code) {
        const lecture = await this.prisma.lecture.findUnique({ where: { voteCode: code } });
        if (!lecture)
            throw new common_1.NotFoundException('Сессия не найдена');
        const slide = await this.prisma.slide.findFirst({
            where: { presentationId: lecture.presentationId, index: lecture.currentSlideIndex },
            include: { poll: { select: { id: true } } },
        });
        const revealed = lecture.resultsRevealedAt !== null;
        return {
            lectureTitle: lecture.title,
            active: lecture.status === 'active',
            slideIndex: lecture.currentSlideIndex,
            hasPoll: !!slide?.poll,
            revealed,
        };
    }
    async payload(code, slideIndex, req, res) {
        const { lecture, slide } = await this.resolve(code, slideIndex);
        const anonId = this.ensureAnon(req, res);
        const open = this.isOpen(lecture, slideIndex);
        const poll = slide.poll;
        let yourAnswer = null;
        if (poll) {
            const pseudonym = this.pseudonymFor(lecture, poll, anonId);
            const existing = await this.prisma.answer.findUnique({
                where: { lectureId_pollId_pseudonym: { lectureId: lecture.id, pollId: poll.id, pseudonym } },
            });
            if (existing) {
                yourAnswer = {
                    selectedOptionIds: existing.selectedOptionIds ?? [],
                    rankingOrder: existing.rankingOrder ?? [],
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
    async submit(code, slideIndex, dto, req, res) {
        const { lecture, slide } = await this.resolve(code, slideIndex);
        const anonId = this.ensureAnon(req, res);
        const poll = slide.poll;
        if (!poll)
            throw new common_1.NotFoundException('На этом слайде нет вопроса');
        if (!this.isOpen(lecture, slideIndex)) {
            throw new common_1.HttpException('Голосование по этому вопросу закрыто', common_1.HttpStatus.CONFLICT);
        }
        (0, vote_logic_1.validateAnswerPayload)({ type: poll.type, required: poll.required, optionIds: poll.options.map((o) => o.id) }, dto);
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
    async results(code, slideIndex) {
        const { lecture, slide } = await this.resolve(code, slideIndex);
        if (!slide.poll)
            throw new common_1.NotFoundException('На этом слайде нет вопроса');
        if (!this.isClosed(lecture, slideIndex))
            return { closed: false };
        const answers = await this.prisma.answer.findMany({
            where: { lectureId: lecture.id, pollId: slide.poll.id },
        });
        return { closed: true, results: (0, results_helper_1.aggregateResults)(slide.poll, answers) };
    }
    isOpen(lecture, slideIndex) {
        return lecture.status === 'active' && lecture.currentSlideIndex === slideIndex;
    }
    isClosed(lecture, slideIndex) {
        return lecture.status !== 'active' || lecture.currentSlideIndex > slideIndex;
    }
    async resolve(code, slideIndex) {
        if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 10000) {
            throw new common_1.NotFoundException('Слайд не найден');
        }
        const lecture = await this.prisma.lecture.findUnique({
            where: { voteCode: code },
            include: { teacher: true },
        });
        if (!lecture)
            throw new common_1.NotFoundException('Сессия не найдена');
        const slide = await this.prisma.slide.findFirst({
            where: { presentationId: lecture.presentationId, index: slideIndex },
            include: { poll: { include: { options: true } } },
        });
        if (!slide)
            throw new common_1.NotFoundException('Слайд не найден');
        return { lecture, slide };
    }
    pseudonymFor(lecture, poll, anonId) {
        const key = lecture.linkAnswers
            ? lecture.teacher.salt
            : `${lecture.teacher.salt}:${lecture.id}:${poll.id}`;
        return (0, vote_logic_1.computePseudonym)(anonId, key);
    }
    ensureAnon(req, res) {
        let anonId = req.cookies?.[ANON_COOKIE];
        if (!this.isValidUuid(anonId)) {
            const header = req.headers['x-anon-id'];
            anonId = Array.isArray(header) ? header[0] : header;
        }
        if (!this.isValidUuid(anonId))
            anonId = (0, node_crypto_1.randomUUID)();
        res.cookie(ANON_COOKIE, anonId, {
            httpOnly: true,
            sameSite: 'lax',
            secure: this.config.get('isProd'),
            maxAge: ANON_COOKIE_MS,
            path: '/',
        });
        res.setHeader('X-Anon-Id', anonId);
        return anonId;
    }
    isValidUuid(value) {
        return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }
};
exports.VoteService = VoteService;
exports.VoteService = VoteService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], VoteService);
//# sourceMappingURL=vote.service.js.map