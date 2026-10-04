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
exports.PollsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const audit_service_1 = require("../audit/audit.service");
const polls_service_1 = require("./polls.service");
const poll_dto_1 = require("./dto/poll.dto");
class CopyPollDto {
    fromSlideId;
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CopyPollDto.prototype, "fromSlideId", void 0);
let PollsController = class PollsController {
    polls;
    audit;
    constructor(polls, audit) {
        this.polls = polls;
        this.audit = audit;
    }
    async save(presentationId, slideId, dto, user, req) {
        const poll = await this.polls.save(presentationId, slideId, dto, user);
        void this.audit.log(req, 'poll.save', { entityType: 'poll', entityId: poll.id });
        return poll;
    }
    async copy(presentationId, slideId, dto, user, req) {
        const poll = await this.polls.copyFromSlide(presentationId, slideId, dto.fromSlideId, user);
        void this.audit.log(req, 'poll.copy', { entityType: 'poll', entityId: poll.id });
        return poll;
    }
    async remove(presentationId, slideId, user, req) {
        const result = await this.polls.remove(presentationId, slideId, user);
        void this.audit.log(req, 'poll.delete', { entityType: 'slide', entityId: slideId });
        return result;
    }
};
exports.PollsController = PollsController;
__decorate([
    (0, common_1.Put)(),
    (0, swagger_1.ApiOperation)({ summary: 'Создать/обновить опрос на слайде (типы: single, multiple, ranking)' }),
    __param(0, (0, common_1.Param)('presentationId')),
    __param(1, (0, common_1.Param)('slideId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, poll_dto_1.SavePollDto, Object, Object]),
    __metadata("design:returntype", Promise)
], PollsController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('copy'),
    (0, swagger_1.ApiOperation)({ summary: 'Скопировать опрос с другого слайда этой же презентации' }),
    __param(0, (0, common_1.Param)('presentationId')),
    __param(1, (0, common_1.Param)('slideId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, CopyPollDto, Object, Object]),
    __metadata("design:returntype", Promise)
], PollsController.prototype, "copy", null);
__decorate([
    (0, common_1.Delete)(),
    (0, swagger_1.ApiOperation)({ summary: 'Удалить опрос со слайда' }),
    __param(0, (0, common_1.Param)('presentationId')),
    __param(1, (0, common_1.Param)('slideId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], PollsController.prototype, "remove", null);
exports.PollsController = PollsController = __decorate([
    (0, swagger_1.ApiTags)('Опросы'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('presentations/:presentationId/slides/:slideId/poll'),
    __metadata("design:paramtypes", [polls_service_1.PollsService,
        audit_service_1.AuditService])
], PollsController);
//# sourceMappingURL=polls.controller.js.map