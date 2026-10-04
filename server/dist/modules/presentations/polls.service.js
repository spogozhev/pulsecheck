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
exports.PollsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const presentations_service_1 = require("./presentations.service");
const POLL_TYPES = ['single', 'multiple', 'ranking'];
let PollsService = class PollsService {
    prisma;
    presentations;
    constructor(prisma, presentations) {
        this.prisma = prisma;
        this.presentations = presentations;
    }
    async save(presentationId, slideId, dto, user) {
        if (!POLL_TYPES.includes(dto.type)) {
            throw new common_1.BadRequestException('Недопустимый тип опроса');
        }
        if (dto.options.some((o) => !o.text.trim())) {
            throw new common_1.BadRequestException('Текст варианта не может быть пустым');
        }
        const presentation = await this.presentations.getOwned(presentationId, user);
        const slide = presentation.slides.find((s) => s.id === slideId);
        if (!slide)
            throw new common_1.NotFoundException('Слайд не найден');
        const active = await this.prisma.lecture.count({
            where: { presentationId, status: 'active' },
        });
        if (active > 0) {
            throw new common_1.BadRequestException('Нельзя изменять опрос во время активной лекции по этой презентации');
        }
        const existing = await this.prisma.poll.findUnique({ where: { slideId } });
        const poll = existing
            ? await this.prisma.poll.update({
                where: { id: existing.id },
                data: {
                    questionText: dto.questionText.trim(),
                    type: dto.type,
                    required: dto.required ?? true,
                    timeLimitSeconds: dto.timeLimitSeconds ?? null,
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
                    timeLimitSeconds: dto.timeLimitSeconds ?? null,
                    options: {
                        create: dto.options.map((o, i) => ({ text: o.text.trim(), position: i })),
                    },
                },
                include: { options: { orderBy: { position: 'asc' } } },
            });
        return poll;
    }
    async remove(presentationId, slideId, user) {
        const presentation = await this.presentations.getOwned(presentationId, user);
        const slide = presentation.slides.find((s) => s.id === slideId);
        if (!slide)
            throw new common_1.NotFoundException('Слайд не найден');
        if (!slide.poll)
            throw new common_1.NotFoundException('На слайде нет опроса');
        const active = await this.prisma.lecture.count({
            where: { presentationId, status: 'active' },
        });
        if (active > 0) {
            throw new common_1.BadRequestException('Нельзя изменять опрос во время активной лекции');
        }
        await this.prisma.poll.delete({ where: { id: slide.poll.id } });
        return { ok: true };
    }
    async copyFromSlide(presentationId, targetSlideId, fromSlideId, user) {
        if (targetSlideId === fromSlideId) {
            throw new common_1.BadRequestException('Слайд-источник совпадает с целевым');
        }
        const presentation = await this.presentations.getOwned(presentationId, user);
        const target = presentation.slides.find((s) => s.id === targetSlideId);
        if (!target)
            throw new common_1.NotFoundException('Слайд не найден');
        if (target.poll)
            throw new common_1.ConflictException('На этом слайде уже есть опрос');
        const source = presentation.slides.find((s) => s.id === fromSlideId);
        if (!source)
            throw new common_1.NotFoundException('Слайд-источник не найден');
        if (!source.poll)
            throw new common_1.BadRequestException('На слайде-источнике нет опроса');
        const active = await this.prisma.lecture.count({
            where: { presentationId, status: 'active' },
        });
        if (active > 0) {
            throw new common_1.BadRequestException('Нельзя изменять опросы во время активной лекции');
        }
        return this.prisma.poll.create({
            data: {
                slideId: target.id,
                questionText: source.poll.questionText,
                type: source.poll.type,
                required: source.poll.required,
                timeLimitSeconds: source.poll.timeLimitSeconds,
                options: {
                    create: [...source.poll.options]
                        .sort((a, b) => a.position - b.position)
                        .map((o) => ({ text: o.text, position: o.position })),
                },
            },
            include: { options: { orderBy: { position: 'asc' } } },
        });
    }
};
exports.PollsService = PollsService;
exports.PollsService = PollsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        presentations_service_1.PresentationsService])
], PollsService);
//# sourceMappingURL=polls.service.js.map