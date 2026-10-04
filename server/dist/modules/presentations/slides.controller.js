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
exports.SlidesController = exports.CopySlidesRequestDto = exports.AddGeneratedSlideDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const audit_service_1 = require("../audit/audit.service");
const slides_service_1 = require("./slides.service");
class AddGeneratedSlideDto {
    afterIndex;
}
exports.AddGeneratedSlideDto = AddGeneratedSlideDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AddGeneratedSlideDto.prototype, "afterIndex", void 0);
class CopySlidesRequestDto {
    slideIds;
    targetPresentationId;
    insertAfterIndex;
}
exports.CopySlidesRequestDto = CopySlidesRequestDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], CopySlidesRequestDto.prototype, "slideIds", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CopySlidesRequestDto.prototype, "targetPresentationId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(10000),
    __metadata("design:type", Number)
], CopySlidesRequestDto.prototype, "insertAfterIndex", void 0);
let SlidesController = class SlidesController {
    slides;
    audit;
    constructor(slides, audit) {
        this.slides = slides;
        this.audit = audit;
    }
    async addGenerated(presentationId, dto, user, req) {
        const slide = await this.slides.addGenerated(presentationId, dto.afterIndex, user);
        void this.audit.log(req, 'slide.create', {
            entityType: 'slide',
            entityId: slide.id,
            meta: { presentationId },
        });
        return slide;
    }
    async remove(presentationId, slideId, user, req) {
        const result = await this.slides.remove(presentationId, slideId, user);
        void this.audit.log(req, 'slide.delete', {
            entityType: 'slide',
            entityId: slideId,
            meta: { presentationId },
        });
        return result;
    }
    async copy(dto, user, req) {
        const result = await this.slides.copy({ slideIds: dto.slideIds, targetPresentationId: dto.targetPresentationId, insertAfterIndex: dto.insertAfterIndex }, user);
        void this.audit.log(req, 'slides.copy', {
            entityType: 'presentation',
            entityId: dto.targetPresentationId,
            meta: { count: result.copied, sourceSlides: dto.slideIds },
        });
        return result;
    }
};
exports.SlidesController = SlidesController;
__decorate([
    (0, common_1.Post)('presentations/:presentationId/slides'),
    (0, swagger_1.ApiOperation)({ summary: 'Добавить слайд-вопрос (генерируемый, без изображения) после afterIndex' }),
    __param(0, (0, common_1.Param)('presentationId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, AddGeneratedSlideDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SlidesController.prototype, "addGenerated", null);
__decorate([
    (0, common_1.Delete)('presentations/:presentationId/slides/:slideId'),
    (0, swagger_1.ApiOperation)({ summary: 'Удалить слайд (индексы последующих сдвигаются)' }),
    __param(0, (0, common_1.Param)('presentationId')),
    __param(1, (0, common_1.Param)('slideId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], SlidesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('slides/copy'),
    (0, swagger_1.ApiOperation)({ summary: 'Копировать слайды (с опросами) в другую презентацию' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CopySlidesRequestDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SlidesController.prototype, "copy", null);
exports.SlidesController = SlidesController = __decorate([
    (0, swagger_1.ApiTags)('Слайды'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [slides_service_1.SlidesService,
        audit_service_1.AuditService])
], SlidesController);
//# sourceMappingURL=slides.controller.js.map