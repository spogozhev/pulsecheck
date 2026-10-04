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
};
exports.PollsService = PollsService;
exports.PollsService = PollsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        presentations_service_1.PresentationsService])
], PollsService);
//# sourceMappingURL=polls.service.js.map