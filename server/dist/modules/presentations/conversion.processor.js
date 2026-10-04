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
var ConversionProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversionProcessor = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const config_1 = require("@nestjs/config");
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const prisma_service_1 = require("../../prisma/prisma.service");
const converter_service_1 = require("./converter.service");
const conversion_constants_1 = require("./conversion.constants");
let ConversionProcessor = ConversionProcessor_1 = class ConversionProcessor extends bullmq_1.WorkerHost {
    prisma;
    converter;
    config;
    logger = new common_1.Logger(ConversionProcessor_1.name);
    constructor(prisma, converter, config) {
        super();
        this.prisma = prisma;
        this.converter = converter;
        this.config = config;
    }
    async process(job) {
        const { presentationId } = job.data;
        try {
            await this.run(presentationId);
        }
        catch (e) {
            const message = String(e?.message ?? e).slice(0, 500);
            this.logger.error(`Конвертация ${presentationId} не удалась: ${message}`);
            await this.prisma.presentation
                .update({ where: { id: presentationId }, data: { status: 'failed', error: message } })
                .catch(() => undefined);
            throw e;
        }
    }
    async run(presentationId) {
        const presentation = await this.prisma.presentation.findUnique({
            where: { id: presentationId },
        });
        if (!presentation || !presentation.originalPath || presentation.status === 'ready')
            return;
        const storageDir = this.config.get('storageDir');
        const originalAbs = node_path_1.default.join(storageDir, presentation.originalPath);
        const slidesDir = node_path_1.default.join(storageDir, 'slides', presentation.id);
        await (0, promises_1.rm)(slidesDir, { recursive: true, force: true });
        await (0, promises_1.mkdir)(slidesDir, { recursive: true });
        const workDir = node_path_1.default.join((0, node_os_1.tmpdir)(), `pulsecheck-${presentation.id}`);
        await (0, promises_1.mkdir)(workDir, { recursive: true });
        try {
            const pdfInput = presentation.sourceType === 'pptx'
                ? await this.converter.pptxToPdf(originalAbs, workDir)
                : originalAbs;
            const pages = await this.converter.rasterizePdf(pdfInput, slidesDir);
            await this.prisma.$transaction([
                this.prisma.slide.deleteMany({ where: { presentationId: presentation.id } }),
                this.prisma.slide.createMany({
                    data: pages.map((p, i) => ({
                        presentationId: presentation.id,
                        index: i,
                        imagePath: `slides/${presentation.id}/${p.fileName}`,
                    })),
                }),
                this.prisma.presentation.update({
                    where: { id: presentation.id },
                    data: { status: 'ready', slideCount: pages.length, error: null },
                }),
            ]);
            this.logger.log(`Презентация ${presentation.id}: ${pages.length} слайдов`);
        }
        finally {
            await (0, promises_1.rm)(workDir, { recursive: true, force: true });
        }
    }
};
exports.ConversionProcessor = ConversionProcessor;
exports.ConversionProcessor = ConversionProcessor = ConversionProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(conversion_constants_1.CONVERSION_QUEUE),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        converter_service_1.ConverterService,
        config_1.ConfigService])
], ConversionProcessor);
//# sourceMappingURL=conversion.processor.js.map