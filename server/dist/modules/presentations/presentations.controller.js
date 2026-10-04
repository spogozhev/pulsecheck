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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresentationsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const audit_service_1 = require("../audit/audit.service");
const presentations_service_1 = require("./presentations.service");
const portable_service_1 = require("./portable.service");
class UpdatePresentationDto {
    title;
    course;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdatePresentationDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], UpdatePresentationDto.prototype, "course", void 0);
class PresentationFilterDto {
    course;
    search;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], PresentationFilterDto.prototype, "course", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], PresentationFilterDto.prototype, "search", void 0);
let PresentationsController = class PresentationsController {
    presentations;
    portable;
    audit;
    constructor(presentations, portable, audit) {
        this.presentations = presentations;
        this.portable = portable;
        this.audit = audit;
    }
    async upload(file, title, course, user, req) {
        const presentation = await this.presentations.create(file, typeof title === 'string' ? title : undefined, user, typeof course === 'string' ? course : undefined);
        void this.audit.log(req, 'presentation.upload', {
            entityType: 'presentation',
            entityId: presentation.id,
            meta: { sourceType: presentation.sourceType },
        });
        return presentation;
    }
    async list(filters, user) {
        return this.presentations.list(user, filters);
    }
    async tags(user) {
        return this.presentations.listTags(user);
    }
    async get(id, user) {
        return this.presentations.getOwned(id, user);
    }
    async update(id, dto, user) {
        return this.presentations.updateProperties(id, user, dto);
    }
    async remove(id, user, req) {
        await this.presentations.remove(id, user);
        void this.audit.log(req, 'presentation.delete', { entityType: 'presentation', entityId: id });
        return { ok: true };
    }
    async importZip(file, title, user, req) {
        const presentation = await this.portable.importZip(file, typeof title === 'string' ? title : undefined, user);
        void this.audit.log(req, 'presentation.import', {
            entityType: 'presentation',
            entityId: presentation.id,
        });
        return presentation;
    }
    async exportZip(id, user, res) {
        const { buffer, fileName } = await this.portable.exportZip(id, user);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="export.zip"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        res.send(buffer);
    }
    async original(id, user, res) {
        const { absPath, downloadName } = await this.presentations.originalAbsolutePath(id, user);
        res.download(absPath, downloadName);
    }
};
exports.PresentationsController = PresentationsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Загрузка PDF/PPTX (multipart, поле file); запускает конвертацию в слайды' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: 300 * 1024 * 1024 } })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)('title')),
    __param(2, (0, common_1.Body)('course')),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], PresentationsController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Список презентаций (фильтры: course — точный тег, search — по названию/курсу)' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PresentationFilterDto, Object]),
    __metadata("design:returntype", Promise)
], PresentationsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('tags'),
    (0, swagger_1.ApiOperation)({ summary: 'Различные курсы/дисциплины преподавателя (теги для фильтрации)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PresentationsController.prototype, "tags", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Презентация со слайдами и опросами' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PresentationsController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Обновить свойства: название и/или курс-дисциплину (пустой course очищает)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdatePresentationDto, Object]),
    __metadata("design:returntype", Promise)
], PresentationsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Удаление (запрещено, если есть лекции по презентации)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], PresentationsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, swagger_1.ApiOperation)({ summary: 'Импорт презентации из portable-архива PulseCheck (.zip)' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: 300 * 1024 * 1024 } })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)('title')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], PresentationsController.prototype, "importZip", null);
__decorate([
    (0, common_1.Get)(':id/export'),
    (0, swagger_1.ApiOperation)({ summary: 'Экспорт презентации в portable-архив (.zip): слайды, опросы, оригинал' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], PresentationsController.prototype, "exportZip", null);
__decorate([
    (0, common_1.Get)(':id/original'),
    (0, swagger_1.ApiOperation)({ summary: 'Скачать оригинальный файл' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], PresentationsController.prototype, "original", null);
exports.PresentationsController = PresentationsController = __decorate([
    (0, swagger_1.ApiTags)('Презентации'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('presentations'),
    __metadata("design:paramtypes", [presentations_service_1.PresentationsService,
        portable_service_1.PortableService,
        audit_service_1.AuditService])
], PresentationsController);
//# sourceMappingURL=presentations.controller.js.map