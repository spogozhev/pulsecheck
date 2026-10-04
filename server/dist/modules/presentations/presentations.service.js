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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresentationsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../../prisma/prisma.service");
const conversion_constants_1 = require("./conversion.constants");
const ALLOWED_EXTENSIONS = new Set(['pdf', 'pptx']);
const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;
function decodeFilename(name) {
    const repaired = Buffer.from(name, 'latin1').toString('utf8');
    return repaired.includes('\uFFFD') ? name : repaired;
}
let PresentationsService = class PresentationsService {
    prisma;
    config;
    conversionQueue;
    constructor(prisma, config, conversionQueue) {
        this.prisma = prisma;
        this.config = config;
        this.conversionQueue = conversionQueue;
    }
    async create(file, title, user, course) {
        if (!file)
            throw new common_1.BadRequestException('Файл не передан');
        if (file.size > MAX_UPLOAD_BYTES)
            throw new common_1.BadRequestException('Файл больше 300 МБ');
        const ext = node_path_1.default.extname(file.originalname ?? '').replace('.', '').toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            throw new common_1.BadRequestException('Поддерживаются только файлы PDF и PPTX');
        }
        const id = (0, node_crypto_1.randomUUID)();
        const relativeDir = node_path_1.default.posix.join('originals', id);
        const storageDir = this.config.get('storageDir');
        const absDir = node_path_1.default.join(storageDir, relativeDir);
        await (0, promises_1.mkdir)(absDir, { recursive: true });
        const relativePath = node_path_1.default.posix.join(relativeDir, `original.${ext}`);
        await (0, promises_1.writeFile)(node_path_1.default.join(storageDir, relativePath), file.buffer);
        const fallbackTitle = node_path_1.default
            .basename(decodeFilename(file.originalname ?? ''), node_path_1.default.extname(file.originalname ?? ''))
            .trim();
        const cleanTitle = (title ?? fallbackTitle).trim().slice(0, 200);
        const cleanCourse = course?.trim().slice(0, 100) || null;
        const presentation = await this.prisma.presentation.create({
            data: {
                id,
                teacherId: user.id,
                title: cleanTitle || 'Презентация без названия',
                course: cleanCourse,
                sourceType: ext,
                originalPath: relativePath,
                status: 'processing',
            },
        });
        try {
            await this.conversionQueue.add('convert', { presentationId: id });
        }
        catch (e) {
            await this.prisma.presentation.update({
                where: { id },
                data: { status: 'failed', error: `Очередь конвертации недоступна: ${String(e)}` },
            });
            throw new common_1.ServiceUnavailableException('Очередь конвертации недоступна, попробуйте позже');
        }
        return presentation;
    }
    async list(user, filters = {}) {
        const where = { teacherId: user.id };
        if (filters.course)
            where.course = filters.course;
        if (filters.search) {
            where.OR = [
                { title: { contains: filters.search, mode: 'insensitive' } },
                { course: { contains: filters.search, mode: 'insensitive' } },
            ];
        }
        return this.prisma.presentation.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { slides: true, lectures: true } } },
        });
    }
    async listTags(user) {
        const rows = await this.prisma.presentation.findMany({
            where: { teacherId: user.id, course: { not: null } },
            distinct: ['course'],
            select: { course: true },
            orderBy: { course: 'asc' },
        });
        return rows.map((r) => r.course).filter((c) => c.trim().length > 0);
    }
    async updateProperties(id, user, props) {
        await this.getOwned(id, user);
        const data = {};
        if (props.title !== undefined)
            data.title = props.title.trim().slice(0, 200);
        if (props.course !== undefined)
            data.course = props.course.trim() ? props.course.trim().slice(0, 100) : null;
        if (Object.keys(data).length === 0)
            return this.getOwned(id, user);
        return this.prisma.presentation.update({ where: { id }, data });
    }
    async getOwned(id, user) {
        const presentation = await this.prisma.presentation.findFirst({
            where: { id, teacherId: user.id },
            include: {
                slides: {
                    orderBy: { index: 'asc' },
                    include: { poll: { include: { options: { orderBy: { position: 'asc' } } } } },
                },
            },
        });
        if (!presentation)
            throw new common_1.NotFoundException('Презентация не найдена');
        return presentation;
    }
    async remove(id, user) {
        const presentation = await this.getOwned(id, user);
        const lecturesCount = await this.prisma.lecture.count({ where: { presentationId: id } });
        if (lecturesCount > 0) {
            throw new common_1.ConflictException('Нельзя удалить презентацию, которая используется в истории лекций');
        }
        const storageDir = this.config.get('storageDir');
        await (0, promises_1.rm)(node_path_1.default.join(storageDir, 'originals', id), { recursive: true, force: true });
        await (0, promises_1.rm)(node_path_1.default.join(storageDir, 'slides', id), { recursive: true, force: true });
        await this.prisma.presentation.delete({ where: { id } });
    }
    async originalAbsolutePath(id, user) {
        const presentation = await this.getOwned(id, user);
        if (!presentation.originalPath)
            throw new common_1.NotFoundException('Оригинальный файл отсутствует');
        return {
            absPath: node_path_1.default.join(this.config.get('storageDir'), presentation.originalPath),
            downloadName: `${presentation.title}.${presentation.sourceType}`,
        };
    }
};
exports.PresentationsService = PresentationsService;
exports.PresentationsService = PresentationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, bullmq_1.InjectQueue)(conversion_constants_1.CONVERSION_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        bullmq_2.Queue])
], PresentationsService);
//# sourceMappingURL=presentations.service.js.map