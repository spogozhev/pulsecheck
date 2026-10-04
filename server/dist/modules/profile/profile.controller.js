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
exports.PasswordRecoveryController = exports.ProfileController = exports.ResetPasswordDto = exports.ForgotPasswordDto = exports.ChangePasswordDto = exports.UpdateProfileDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const audit_service_1 = require("../audit/audit.service");
const profile_service_1 = require("./profile.service");
class UpdateProfileDto {
    name;
    email;
    currentPassword;
}
exports.UpdateProfileDto = UpdateProfileDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "currentPassword", void 0);
class ChangePasswordDto {
    currentPassword;
    newPassword;
}
exports.ChangePasswordDto = ChangePasswordDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "currentPassword", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "newPassword", void 0);
class ForgotPasswordDto {
    email;
}
exports.ForgotPasswordDto = ForgotPasswordDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], ForgotPasswordDto.prototype, "email", void 0);
class ResetPasswordDto {
    token;
    newPassword;
}
exports.ResetPasswordDto = ResetPasswordDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "token", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "newPassword", void 0);
let ProfileController = class ProfileController {
    profile;
    audit;
    constructor(profile, audit) {
        this.profile = profile;
        this.audit = audit;
    }
    async update(dto, user, req) {
        const updated = await this.profile.updateProfile(user, dto);
        void this.audit.log(req, 'profile.update', {
            entityType: 'user',
            entityId: user.id,
            meta: { nameChanged: dto.name !== undefined, emailChanged: dto.email !== undefined },
        });
        return updated;
    }
    async changePassword(dto, user, req) {
        await this.profile.changePassword(user, dto.currentPassword, dto.newPassword);
        void this.audit.log(req, 'profile.password', { entityType: 'user', entityId: user.id });
        return { ok: true };
    }
};
exports.ProfileController = ProfileController;
__decorate([
    (0, common_1.Put)(),
    (0, swagger_1.ApiOperation)({ summary: 'Обновить профиль: имя и/или email (email — с текущим паролем)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UpdateProfileDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('password'),
    (0, swagger_1.ApiOperation)({ summary: 'Сменить пароль (текущий + новый)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ChangePasswordDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "changePassword", null);
exports.ProfileController = ProfileController = __decorate([
    (0, swagger_1.ApiTags)('Профиль'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('profile'),
    __metadata("design:paramtypes", [profile_service_1.ProfileService,
        audit_service_1.AuditService])
], ProfileController);
let PasswordRecoveryController = class PasswordRecoveryController {
    profile;
    audit;
    constructor(profile, audit) {
        this.profile = profile;
        this.audit = audit;
    }
    async forgot(dto, req) {
        const result = await this.profile.requestPasswordReset(dto.email);
        void this.audit.log(req, 'password.forgot', { meta: { email: dto.email } });
        return { ok: true, ...result };
    }
    async reset(dto, req) {
        await this.profile.resetPassword(dto.token, dto.newPassword);
        void this.audit.log(req, 'password.reset');
        return { ok: true };
    }
};
exports.PasswordRecoveryController = PasswordRecoveryController;
__decorate([
    (0, common_1.Post)('forgot'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Запросить восстановление пароля (письмо со ссылкой)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ForgotPasswordDto, Object]),
    __metadata("design:returntype", Promise)
], PasswordRecoveryController.prototype, "forgot", null);
__decorate([
    (0, common_1.Post)('reset'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Установить новый пароль по токену из письма' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ResetPasswordDto, Object]),
    __metadata("design:returntype", Promise)
], PasswordRecoveryController.prototype, "reset", null);
exports.PasswordRecoveryController = PasswordRecoveryController = __decorate([
    (0, swagger_1.ApiTags)('Восстановление пароля'),
    (0, common_1.Controller)('auth/password'),
    __metadata("design:paramtypes", [profile_service_1.ProfileService,
        audit_service_1.AuditService])
], PasswordRecoveryController);
//# sourceMappingURL=profile.controller.js.map