"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalGuard = void 0;
const common_1 = require("@nestjs/common");
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
let ApprovalGuard = class ApprovalGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user)
            return true;
        if (READ_METHODS.has(request.method.toUpperCase()))
            return true;
        if (request.path.startsWith('/api/auth'))
            return true;
        if (user.status !== 'approved') {
            throw new common_1.ForbiddenException(user.status === 'pending'
                ? 'Аккаунт ожидает подтверждения администратором'
                : 'Аккаунт заблокирован администратором');
        }
        return true;
    }
};
exports.ApprovalGuard = ApprovalGuard;
exports.ApprovalGuard = ApprovalGuard = __decorate([
    (0, common_1.Injectable)()
], ApprovalGuard);
//# sourceMappingURL=approval.guard.js.map