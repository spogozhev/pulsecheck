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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const ioredis_1 = __importDefault(require("ioredis"));
const prisma_service_1 = require("../../prisma/prisma.service");
const public_decorator_1 = require("../../common/decorators/public.decorator");
let HealthController = class HealthController {
    prisma;
    redis;
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    async health() {
        const db = await this.prisma
            .$queryRaw `SELECT 1`
            .then(() => true)
            .catch(() => false);
        let redis = false;
        try {
            redis = (await this.redis.ping()) === 'PONG';
        }
        catch {
            redis = false;
        }
        const ok = db && redis;
        if (!ok)
            throw new common_1.ServiceUnavailableException({ statusCode: 503, ok, db, redis });
        return { ok: true, db, redis };
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Проверка живости: БД и очередь (для балансировщика/мониторинга)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "health", null);
exports.HealthController = HealthController = __decorate([
    (0, swagger_1.ApiTags)('Мониторинг'),
    (0, common_1.Controller)('health'),
    __param(1, (0, common_1.Inject)('HEALTH_REDIS')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ioredis_1.default])
], HealthController);
//# sourceMappingURL=health.controller.js.map