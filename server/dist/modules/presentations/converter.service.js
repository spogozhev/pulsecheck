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
var ConverterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConverterService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_child_process_1 = require("node:child_process");
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const node_url_1 = require("node:url");
const nativeImport = new Function('specifier', 'return import(specifier)');
let ConverterService = ConverterService_1 = class ConverterService {
    config;
    logger = new common_1.Logger(ConverterService_1.name);
    pdfLib = null;
    constructor(config) {
        this.config = config;
    }
    loadPdfLib() {
        if (!this.pdfLib)
            this.pdfLib = nativeImport('pdf-to-img');
        return this.pdfLib;
    }
    async pptxToPdf(inputPath, workDir) {
        const profileDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), 'pulsecheck-lo-'));
        const args = [
            `-env:UserInstallation=${(0, node_url_1.pathToFileURL)(profileDir).href}`,
            '--headless',
            '--norestore',
            '--nologo',
            '--nolockcheck',
            '--nodefault',
            '--convert-to',
            'pdf',
            '--outdir',
            workDir,
            inputPath,
        ];
        const soffice = this.config.get('libreofficePath');
        const output = await new Promise((resolve, reject) => {
            const proc = (0, node_child_process_1.spawn)(soffice, args, { windowsHide: true });
            let out = '';
            proc.stdout.on('data', (d) => (out += d.toString()));
            proc.stderr.on('data', (d) => (out += d.toString()));
            const timer = setTimeout(() => {
                proc.kill();
                reject(new Error(`Превышено время конвертации LibreOffice: ${out.slice(-500)}`));
            }, 180_000);
            proc.on('error', (err) => {
                clearTimeout(timer);
                reject(new Error(`Не удалось запустить LibreOffice (${soffice}): ${err.message}`));
            });
            proc.on('close', (code) => {
                clearTimeout(timer);
                if (code === 0)
                    resolve(out);
                else
                    reject(new Error(`LibreOffice завершился с кодом ${code}: ${out.slice(-500)}`));
            });
        });
        this.logger.log(`LibreOffice: ${output.trim().split('\n').slice(-1)[0]}`);
        const pdfPath = node_path_1.default.join(workDir, node_path_1.default.basename(inputPath, node_path_1.default.extname(inputPath)) + '.pdf');
        try {
            await (0, promises_1.access)(pdfPath);
        }
        catch {
            throw new Error('LibreOffice не создал PDF-файл');
        }
        return pdfPath;
    }
    async rasterizePdf(pdfInput, outDir) {
        const { pdf } = await this.loadPdfLib();
        const document = await pdf(pdfInput, { scale: 2 });
        const pageCount = document.length;
        if (!pageCount)
            throw new Error('PDF не содержит страниц');
        const pages = [];
        for (let i = 1; i <= pageCount; i++) {
            const buffer = await document.getPage(i);
            const fileName = `${String(i).padStart(3, '0')}.png`;
            await (0, promises_1.writeFile)(node_path_1.default.join(outDir, fileName), buffer);
            pages.push({ number: i, fileName });
        }
        return pages;
    }
};
exports.ConverterService = ConverterService;
exports.ConverterService = ConverterService = ConverterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ConverterService);
//# sourceMappingURL=converter.service.js.map