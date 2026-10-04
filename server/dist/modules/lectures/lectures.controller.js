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
exports.LecturesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const audit_service_1 = require("../audit/audit.service");
const lectures_service_1 = require("./lectures.service");
const lecture_dto_1 = require("./dto/lecture.dto");
let LecturesController = class LecturesController {
    lectures;
    audit;
    constructor(lectures, audit) {
        this.lectures = lectures;
        this.audit = audit;
    }
    async start(dto, user, req) {
        const lecture = await this.lectures.start(dto, user);
        void this.audit.log(req, 'lecture.start', {
            entityType: 'lecture',
            entityId: lecture.id,
            meta: { presentationId: dto.presentationId },
        });
        return lecture;
    }
    async list(dto, user) {
        return this.lectures.list(dto, user);
    }
    async remove(id, user, req) {
        await this.lectures.remove(id, user);
        void this.audit.log(req, 'lecture.delete', { entityType: 'lecture', entityId: id });
        return { ok: true };
    }
    async analytics(id, user) {
        return this.lectures.analytics(id, user);
    }
    async state(id, user) {
        return this.lectures.state(id, user);
    }
    async setSlide(id, dto, user) {
        return this.lectures.setSlide(id, dto.index, user);
    }
    async reveal(id, user) {
        return this.lectures.revealResults(id, user);
    }
    async finish(id, user, req) {
        const result = await this.lectures.finish(id, user);
        void this.audit.log(req, 'lecture.finish', { entityType: 'lecture', entityId: id });
        return result;
    }
    async results(id, pollId, user) {
        return this.lectures.pollResults(id, pollId, user);
    }
    async analyticsAlias(id, user) {
        return this.lectures.analytics(id, user);
    }
    async export(id, format, user, res) {
        if (format === 'csv') {
            const csv = await this.lectures.exportCsv(id, user);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="lecture-${id}.csv"`);
            res.send(csv);
            return;
        }
        const json = await this.lectures.exportJson(id, user);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="lecture-${id}.json"`);
        res.json(json);
    }
};
exports.LecturesController = LecturesController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Запустить новую сессию лекции по презентации' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [lecture_dto_1.StartLectureDto, Object, Object]),
    __metadata("design:returntype", Promise)
], LecturesController.prototype, "start", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'История лекций (фильтры: from, to, course, status; пагинация: page, pageSize)' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [lecture_dto_1.ListLecturesDto, Object]),
    __metadata("design:returntype", Promise)
], LecturesController.prototype, "list", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Удалить завершённую лекцию вместе с ответами (активную удалить нельзя)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], LecturesController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Лекция с аналитикой' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], LecturesController.prototype, "analytics", null);
__decorate([
    (0, common_1.Get)(':id/state'),
    (0, swagger_1.ApiOperation)({ summary: 'Состояние сессии для presenter view (поллинг)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], LecturesController.prototype, "state", null);
__decorate([
    (0, common_1.Patch)(':id/slide'),
    (0, swagger_1.ApiOperation)({ summary: 'Переключить слайд (закрывает голосование на предыдущем)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, lecture_dto_1.SetSlideDto, Object]),
    __metadata("design:returntype", Promise)
], LecturesController.prototype, "setSlide", null);
__decorate([
    (0, common_1.Post)(':id/reveal'),
    (0, swagger_1.ApiOperation)({ summary: 'Преподаватель показал итоги предыдущего вопроса («Продолжить показ»)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], LecturesController.prototype, "reveal", null);
__decorate([
    (0, common_1.Post)(':id/finish'),
    (0, swagger_1.ApiOperation)({ summary: 'Завершить лекцию' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], LecturesController.prototype, "finish", null);
__decorate([
    (0, common_1.Get)(':id/results'),
    (0, swagger_1.ApiOperation)({ summary: 'Результаты опроса (query: pollId) в рамках лекции' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('pollId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], LecturesController.prototype, "results", null);
__decorate([
    (0, common_1.Get)(':id/analytics'),
    (0, swagger_1.ApiOperation)({ summary: 'Полная аналитика по лекции' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], LecturesController.prototype, "analyticsAlias", null);
__decorate([
    (0, common_1.Get)(':id/export'),
    (0, swagger_1.ApiOperation)({ summary: 'Экспорт данных лекции (query: format=csv|json)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('format')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], LecturesController.prototype, "export", null);
exports.LecturesController = LecturesController = __decorate([
    (0, swagger_1.ApiTags)('Лекции и сессии'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('lectures'),
    __metadata("design:paramtypes", [lectures_service_1.LecturesService,
        audit_service_1.AuditService])
], LecturesController);
//# sourceMappingURL=lectures.controller.js.map