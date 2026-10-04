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
exports.VoteController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const vote_service_1 = require("./vote.service");
const vote_dto_1 = require("./dto/vote.dto");
let VoteController = class VoteController {
    vote;
    constructor(vote) {
        this.vote = vote;
    }
    async sessionState(code) {
        return this.vote.sessionState(code);
    }
    async payload(code, slide, req, res) {
        return this.vote.payload(code, slide, req, res);
    }
    async submit(code, slide, dto, req, res) {
        return this.vote.submit(code, slide, dto, req, res);
    }
    async results(code, slide) {
        return this.vote.results(code, slide);
    }
};
exports.VoteController = VoteController;
__decorate([
    (0, common_1.Get)(':code'),
    (0, throttler_1.Throttle)({ default: { limit: 240, ttl: 60_000 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Состояние сессии: активный вопрос (страница студента опрашивает её)' }),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VoteController.prototype, "sessionState", null);
__decorate([
    (0, common_1.Get)(':code/:slide'),
    (0, throttler_1.Throttle)({ default: { limit: 120, ttl: 60_000 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Данные вопроса по QR-ссылке /v/{code}/{slide}' }),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Param)('slide', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Object, Object]),
    __metadata("design:returntype", Promise)
], VoteController.prototype, "payload", null);
__decorate([
    (0, common_1.Post)(':code/:slide/answer'),
    (0, throttler_1.Throttle)({ default: { limit: 60, ttl: 60_000 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Отправить/обновить ответ (анонимно)' }),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Param)('slide', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, vote_dto_1.SubmitAnswerDto, Object, Object]),
    __metadata("design:returntype", Promise)
], VoteController.prototype, "submit", null);
__decorate([
    (0, common_1.Get)(':code/:slide/results'),
    (0, throttler_1.Throttle)({ default: { limit: 120, ttl: 60_000 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Итоги вопроса (только после закрытия голосования)' }),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Param)('slide', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], VoteController.prototype, "results", null);
exports.VoteController = VoteController = __decorate([
    (0, swagger_1.ApiTags)('Голосование (публичное)'),
    (0, common_1.Controller)('vote'),
    (0, public_decorator_1.Public)(),
    __metadata("design:paramtypes", [vote_service_1.VoteService])
], VoteController);
//# sourceMappingURL=vote.controller.js.map