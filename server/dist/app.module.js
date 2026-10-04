"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const throttler_1 = require("@nestjs/throttler");
const bullmq_1 = require("@nestjs/bullmq");
const configuration_1 = require("./config/configuration");
const prisma_module_1 = require("./prisma/prisma.module");
const jwt_auth_guard_1 = require("./common/guards/jwt-auth.guard");
const approval_guard_1 = require("./common/guards/approval.guard");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
const audit_module_1 = require("./modules/audit/audit.module");
const auth_module_1 = require("./modules/auth/auth.module");
const admin_module_1 = require("./modules/admin/admin.module");
const presentations_module_1 = require("./modules/presentations/presentations.module");
const lectures_module_1 = require("./modules/lectures/lectures.module");
const vote_module_1 = require("./modules/vote/vote.module");
const storage_module_1 = require("./modules/storage/storage.module");
const health_module_1 = require("./modules/health/health.module");
const profile_module_1 = require("./modules/profile/profile.module");
const mail_module_1 = require("./shared/mail.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, load: [configuration_1.configFactory] }),
            throttler_1.ThrottlerModule.forRoot([{ ttl: 60_000, limit: 500 }]),
            jwt_1.JwtModule.registerAsync({
                global: true,
                useFactory: (config) => ({
                    secret: config.get('jwtSecret'),
                    signOptions: { expiresIn: '7d' },
                }),
                inject: [config_1.ConfigService],
            }),
            bullmq_1.BullModule.forRootAsync({
                useFactory: (config) => ({
                    connection: { url: config.get('redisUrl') },
                }),
                inject: [config_1.ConfigService],
            }),
            prisma_module_1.PrismaModule,
            audit_module_1.AuditModule,
            auth_module_1.AuthModule,
            admin_module_1.AdminModule,
            presentations_module_1.PresentationsModule,
            lectures_module_1.LecturesModule,
            vote_module_1.VoteModule,
            storage_module_1.StorageModule,
            health_module_1.HealthModule,
            profile_module_1.ProfileModule,
            mail_module_1.MailModule,
        ],
        providers: [
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
            { provide: core_1.APP_GUARD, useClass: jwt_auth_guard_1.JwtAuthGuard },
            { provide: core_1.APP_GUARD, useClass: approval_guard_1.ApprovalGuard },
            { provide: core_1.APP_FILTER, useClass: all_exceptions_filter_1.AllExceptionsFilter },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map