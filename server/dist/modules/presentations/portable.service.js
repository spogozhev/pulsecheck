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
exports.PortableService = exports.PORTABLE_VERSION = exports.PORTABLE_FORMAT = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jszip_1 = __importDefault(require("jszip"));
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../../prisma/prisma.service");
const presentations_service_1 = require("./presentations.service");
exports.PORTABLE_FORMAT = 'pulsecheck-presentation';
exports.PORTABLE_VERSION = 1;
const MAX_SLIDES = 500;
const POLL_TYPES = new Set(['single', 'multiple', 'ranking']);
let PortableService = class PortableService {
    prisma;
    config;
    presentations;
    constructor(prisma, config, presentations) {
        this.prisma = prisma;
        this.config = config;
        this.presentations = presentations;
    }
    async exportZip(id, user) {
        const presentation = await this.presentations.getOwned(id, user);
        if (presentation.status !== 'ready') {
            throw new common_1.BadRequestException('Презентация ещё обрабатывается — экспорт недоступен');
        }
        const zip = new jszip_1.default();
        const storageDir = this.config.get('storageDir');
        const manifest = {
            format: exports.PORTABLE_FORMAT,
            version: exports.PORTABLE_VERSION,
            exportedAt: new Date().toISOString(),
            title: presentation.title,
            sourceType: presentation.sourceType,
            slides: [],
        };
        const slides = manifest.slides;
        for (const slide of presentation.slides) {
            const entry = { index: slide.index };
            if (slide.imagePath) {
                const fileName = `slides/${String(slide.index).padStart(3, '0')}.png`;
                zip.file(fileName, await (0, promises_1.readFile)(node_path_1.default.join(storageDir, slide.imagePath)));
                entry.image = fileName;
            }
            if (slide.poll) {
                entry.poll = {
                    questionText: slide.poll.questionText,
                    type: slide.poll.type,
                    required: slide.poll.required,
                    options: [...slide.poll.options]
                        .sort((a, b) => a.position - b.position)
                        .map((o) => ({ text: o.text, position: o.position })),
                };
            }
            slides.push(entry);
        }
        if (presentation.originalPath) {
            zip.file(`original.${presentation.sourceType}`, await (0, promises_1.readFile)(node_path_1.default.join(storageDir, presentation.originalPath)));
        }
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));
        const buffer = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
        });
        const safeTitle = presentation.title.replace(/[^\p{L}\p{N}\- _]/gu, '').trim() || 'presentation';
        return { buffer, fileName: `${safeTitle}.pulsecheck.zip` };
    }
    async importZip(file, titleOverride, user) {
        if (!file)
            throw new common_1.BadRequestException('Файл не передан');
        const zip = await jszip_1.default.loadAsync(file.buffer).catch(() => {
            throw new common_1.BadRequestException('Не удалось прочитать архив — ожидается экспорт PulseCheck (.zip)');
        });
        const manifestFile = zip.file('manifest.json');
        if (!manifestFile) {
            throw new common_1.BadRequestException('В архиве нет manifest.json — это не экспорт PulseCheck');
        }
        const manifest = JSON.parse(await manifestFile.async('string'));
        this.validateManifest(manifest);
        const id = (0, node_crypto_1.randomUUID)();
        const storageDir = this.config.get('storageDir');
        const slidesDir = node_path_1.default.join(storageDir, 'slides', id);
        await (0, promises_1.mkdir)(slidesDir, { recursive: true });
        let originalPath = null;
        const originalEntry = zip.file(`original.${manifest.sourceType}`);
        if (originalEntry) {
            const originalDir = node_path_1.default.join(storageDir, 'originals', id);
            await (0, promises_1.mkdir)(originalDir, { recursive: true });
            await (0, promises_1.writeFile)(node_path_1.default.join(originalDir, `original.${manifest.sourceType}`), await originalEntry.async('nodebuffer'));
            originalPath = `originals/${id}/original.${manifest.sourceType}`;
        }
        const created = await this.prisma.presentation.create({
            data: {
                id,
                teacherId: user.id,
                title: (titleOverride?.trim() || manifest.title || 'Импортированная презентация').slice(0, 200),
                sourceType: manifest.sourceType,
                originalPath,
                status: 'ready',
                slideCount: manifest.slides.length,
            },
        });
        for (const slide of manifest.slides) {
            let imagePath = null;
            if (slide.image) {
                const entry = this.safeZipFile(zip, slide.image);
                if (!entry)
                    throw new common_1.BadRequestException(`В архиве нет файла слайда: ${slide.image}`);
                const fileName = `${String(slide.index).padStart(3, '0')}.png`;
                await (0, promises_1.writeFile)(node_path_1.default.join(slidesDir, fileName), await entry.async('nodebuffer'));
                imagePath = `slides/${id}/${fileName}`;
            }
            await this.prisma.slide.create({
                data: {
                    presentationId: id,
                    index: slide.index,
                    imagePath,
                    isGenerated: !slide.image,
                    poll: slide.poll
                        ? {
                            create: {
                                questionText: slide.poll.questionText,
                                type: slide.poll.type,
                                required: slide.poll.required ?? true,
                                options: {
                                    create: [...slide.poll.options]
                                        .sort((a, b) => a.position - b.position)
                                        .map((o, i) => ({ text: o.text, position: i })),
                                },
                            },
                        }
                        : undefined,
                },
            });
        }
        return created;
    }
    validateManifest(manifest) {
        if (!manifest || manifest.format !== exports.PORTABLE_FORMAT) {
            throw new common_1.BadRequestException('Неподдерживаемый формат манифеста');
        }
        if (manifest.version !== exports.PORTABLE_VERSION) {
            throw new common_1.BadRequestException(`Неподдерживаемая версия формата: ${String(manifest.version)}`);
        }
        if (manifest.sourceType !== 'pdf' && manifest.sourceType !== 'pptx') {
            throw new common_1.BadRequestException('В манифесте некорректный sourceType');
        }
        if (typeof manifest.title !== 'string' || manifest.title.trim().length === 0) {
            throw new common_1.BadRequestException('В манифесте нет названия презентации');
        }
        if (!Array.isArray(manifest.slides) || manifest.slides.length === 0) {
            throw new common_1.BadRequestException('В манифесте нет слайдов');
        }
        if (manifest.slides.length > MAX_SLIDES) {
            throw new common_1.BadRequestException(`Слишком много слайдов (максимум ${MAX_SLIDES})`);
        }
        const seenIndexes = new Set();
        for (const slide of manifest.slides) {
            if (!Number.isInteger(slide.index) || slide.index < 0 || slide.index >= manifest.slides.length) {
                throw new common_1.BadRequestException('Некорректный индекс слайда');
            }
            if (seenIndexes.has(slide.index))
                throw new common_1.BadRequestException('Дублирующийся индекс слайда');
            seenIndexes.add(slide.index);
            if (slide.image)
                this.assertSafeZipPath(slide.image);
            const poll = slide.poll;
            if (poll === undefined)
                continue;
            if (typeof poll.questionText !== 'string' || poll.questionText.trim().length < 3) {
                throw new common_1.BadRequestException('Некорректный текст вопроса в манифесте');
            }
            if (!POLL_TYPES.has(poll.type))
                throw new common_1.BadRequestException(`Недопустимый тип опроса: ${String(poll.type)}`);
            if (!Array.isArray(poll.options) || poll.options.length < 2 || poll.options.length > 10) {
                throw new common_1.BadRequestException('Опрос должен содержать от 2 до 10 вариантов');
            }
            for (const option of poll.options) {
                if (typeof option?.text !== 'string' || option.text.trim().length === 0) {
                    throw new common_1.BadRequestException('Пустой вариант ответа в манифесте');
                }
            }
        }
    }
    assertSafeZipPath(zipPath) {
        const normalized = node_path_1.default.posix.normalize(zipPath);
        if (normalized.startsWith('/') || normalized.startsWith('..') || normalized.includes('../')) {
            throw new common_1.BadRequestException('Недопустимый путь файла в архиве');
        }
    }
    safeZipFile(zip, zipPath) {
        this.assertSafeZipPath(zipPath);
        return zip.file(zipPath);
    }
};
exports.PortableService = PortableService;
exports.PortableService = PortableService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        presentations_service_1.PresentationsService])
], PortableService);
//# sourceMappingURL=portable.service.js.map