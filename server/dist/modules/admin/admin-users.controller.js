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
exports.AdminUsersController = exports.SetStatusDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const admin_guard_1 = require("../../common/guards/admin.guard");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../../prisma/prisma.service");
class SetStatusDto {
    status;
}
exports.SetStatusDto = SetStatusDto;
__decorate([
    (0, class_validator_1.IsIn)(['approved', 'blocked']),
    __metadata("design:type", String)
], SetStatusDto.prototype, "status", void 0);
let AdminUsersController = class AdminUsersController {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(status) {
        const users = await this.prisma.user.findMany({
            where: status ? { status } : undefined,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                status: true,
                createdAt: true,
                _count: { select: { presentations: true, lectures: true } },
            },
        });
        return users;
    }
    async approve(id, admin, req) {
        return this.setStatus(id, 'approved', admin, req);
    }
    async block(id, admin, req) {
        if (id === admin.id) {
            throw new common_1.NotFoundException('Нельзя заблокировать самого себя');
        }
        return this.setStatus(id, 'blocked', admin, req);
    }
    async setStatus(id, status, admin, req) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user)
            throw new common_1.NotFoundException('Пользователь не найден');
        const updated = await this.prisma.user.update({
            where: { id },
            data: { status },
            select: { id: true, email: true, name: true, role: true, status: true },
        });
        void this.audit.log(req, `user.${status === 'approved' ? 'approve' : 'block'}`, {
            entityType: 'user',
            entityId: id,
            meta: { email: user.email },
        });
        return updated;
    }
};
exports.AdminUsersController = AdminUsersController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Список пользователей (фильтр: status=pending|approved|blocked)' }),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, swagger_1.ApiOperation)({ summary: 'Подтвердить пользователя (pending/blocked -> approved)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/block'),
    (0, swagger_1.ApiOperation)({ summary: 'Заблокировать пользователя (approved/blocked -> blocked)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "block", null);
exports.AdminUsersController = AdminUsersController = __decorate([
    (0, swagger_1.ApiTags)('Администрирование'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, common_1.Controller)('admin/users'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], AdminUsersController);
//# sourceMappingURL=admin-users.controller.js.map