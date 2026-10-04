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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const audit_service_1 = require("../audit/audit.service");
const auth_service_1 = require("./auth.service");
const auth_dto_1 = require("./dto/auth.dto");
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
let AuthController = class AuthController {
    auth;
    audit;
    config;
    constructor(auth, audit, config) {
        this.auth = auth;
        this.audit = audit;
        this.config = config;
    }
    async register(dto, req, res) {
        const session = await this.auth.register(dto);
        this.setCookies(res, session.token);
        void this.audit.log(req, 'auth.register', { entityId: session.user.id });
        return session;
    }
    async login(dto, req, res) {
        try {
            const session = await this.auth.login(dto);
            this.setCookies(res, session.token);
            void this.audit.log(req, 'auth.login', { entityId: session.user.id });
            return session;
        }
        catch (e) {
            void this.audit.log(req, 'auth.login_failed', { meta: { email: dto.email } });
            throw e;
        }
    }
    async logout(res) {
        res.clearCookie('sid', { path: '/' });
        res.clearCookie('csrf', { path: '/' });
        return { ok: true };
    }
    async me(user) {
        return { user };
    }
    setCookies(res, token) {
        const secure = this.config.get('isProd');
        res.cookie('sid', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure,
            maxAge: WEEK_MS,
            path: '/',
        });
        res.cookie('csrf', (0, node_crypto_1.randomBytes)(24).toString('hex'), {
            httpOnly: false,
            sameSite: 'lax',
            secure,
            maxAge: WEEK_MS,
            path: '/',
        });
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('register'),
    (0, swagger_1.ApiOperation)({ summary: 'Регистрация преподавателя' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.RegisterDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Вход (JWT в httpOnly-cookie sid + Bearer-токен в ответе)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.LoginDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Выход' }),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Текущий пользователь' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Аутентификация'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        audit_service_1.AuditService,
        config_1.ConfigService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map