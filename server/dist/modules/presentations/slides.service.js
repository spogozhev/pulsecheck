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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlidesService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const presentations_service_1 = require("./presentations.service");
let SlidesService = class SlidesService {
    prisma;
    config;
    presentations;
    constructor(prisma, config, presentations) {
        this.prisma = prisma;
        this.config = config;
        this.presentations = presentations;
    }
    async addGenerated(presentationId, afterIndex, user) {
        const presentation = await this.presentations.getOwned(presentationId, user);
        await this.ensureNoActiveLecture(presentationId);
        const maxIndex = presentation.slides.length
            ? Math.max(...presentation.slides.map((s) => s.index))
            : -1;
        const newIndex = afterIndex === undefined || afterIndex === null
            ? maxIndex + 1
            : afterIndex + 1;
        if (newIndex < 0 || newIndex > maxIndex + 1) {
            throw new common_1.BadRequestException('Некорректная позиция вставки');
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
    async remove(presentationId, slideId, user) {
        const presentation = await this.presentations.getOwned(presentationId, user);
        const slide = presentation.slides.find((s) => s.id === slideId);
        if (!slide)
            throw new common_1.NotFoundException('Слайд не найден');
        await this.ensureNoActiveLecture(presentationId);
        await this.prisma.slide.delete({ where: { id: slideId } });
        await this.shiftDown(presentationId, slide.index);
        await this.prisma.presentation.update({
            where: { id: presentationId },
            data: { slideCount: { decrement: 1 } },
        });
        return { ok: true };
    }
    async copy(dto, user) {
        if (!Array.isArray(dto.slideIds) || dto.slideIds.length === 0) {
            throw new common_1.BadRequestException('Не выбраны слайды для копирования');
        }
        if (dto.slideIds.length > 100)
            throw new common_1.BadRequestException('Можно копировать не более 100 слайдов за раз');
        const sources = await this.prisma.slide.findMany({
            where: { id: { in: dto.slideIds } },
            include: {
                presentation: { select: { teacherId: true } },
                poll: { include: { options: true } },
            },
            orderBy: [{ presentationId: 'asc' }, { index: 'asc' }],
        });
        if (sources.length !== dto.slideIds.length) {
            throw new common_1.NotFoundException('Часть выбранных слайдов не найдена');
        }
        if (sources.some((s) => s.presentation.teacherId !== user.id)) {
            throw new common_1.NotFoundException('Часть выбранных слайдов не найдена');
        }
        const target = await this.presentations.getOwned(dto.targetPresentationId, user);
        await this.ensureNoActiveLecture(dto.targetPresentationId);
        const sourcePresentationIds = new Set(sources.map((s) => s.presentationId));
        for (const pid of sourcePresentationIds) {
            await this.ensureNoActiveLecture(pid);
        }
        const maxIndex = target.slides.length ? Math.max(...target.slides.map((s) => s.index)) : -1;
        const base = dto.insertAfterIndex === undefined || dto.insertAfterIndex === null
            ? maxIndex + 1
            : dto.insertAfterIndex + 1;
        if (base < 0 || base > maxIndex + 1) {
            throw new common_1.BadRequestException('Некорректная позиция вставки');
        }
        await this.shiftUp(dto.targetPresentationId, base, sources.length);
        const storageDir = this.config.get('storageDir');
        const targetSlidesDir = node_path_1.default.join(storageDir, 'slides', dto.targetPresentationId);
        await (0, promises_1.mkdir)(targetSlidesDir, { recursive: true });
        const created = [];
        for (let i = 0; i < sources.length; i++) {
            const src = sources[i];
            const newIndex = base + i;
            let imagePath = null;
            if (src.imagePath) {
                const ext = node_path_1.default.extname(src.imagePath);
                const fileName = `${newIndex}-${(0, node_crypto_1.randomBytes)(4).toString('hex')}${ext}`;
                await (0, promises_1.copyFile)(node_path_1.default.join(storageDir, src.imagePath), node_path_1.default.join(targetSlidesDir, fileName));
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
    async ensureNoActiveLecture(presentationId) {
        const active = await this.prisma.lecture.count({
            where: { presentationId, status: 'active' },
        });
        if (active > 0) {
            throw new common_1.ConflictException('Идёт активная лекция по этой презентации — завершите её перед изменением слайдов');
        }
    }
    async shiftUp(presentationId, from, shift = 1) {
        await this.prisma.$executeRaw(client_1.Prisma.sql `
        WITH ordered AS (
          SELECT id FROM slides
          WHERE presentation_id = ${presentationId} AND index >= ${from}
          ORDER BY index DESC
        )
        UPDATE slides SET index = slides.index + ${shift}
        FROM ordered WHERE slides.id = ordered.id
      `);
    }
    async shiftDown(presentationId, after) {
        await this.prisma.$executeRaw(client_1.Prisma.sql `
        WITH ordered AS (
          SELECT id FROM slides
          WHERE presentation_id = ${presentationId} AND index > ${after}
          ORDER BY index ASC
        )
        UPDATE slides SET index = slides.index - 1
        FROM ordered WHERE slides.id = ordered.id
      `);
    }
};
exports.SlidesService = SlidesService;
exports.SlidesService = SlidesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        presentations_service_1.PresentationsService])
], SlidesService);
//# sourceMappingURL=slides.service.js.map