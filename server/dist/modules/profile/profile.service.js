"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const bcrypt = __importStar(require("bcryptjs"));
const mail_service_1 = require("../../shared/mail.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
let ProfileService = class ProfileService {
    prisma;
    mail;
    constructor(prisma, mail) {
        this.prisma = prisma;
        this.mail = mail;
    }
    async updateProfile(user, dto) {
        const me = await this.prisma.user.findUnique({ where: { id: user.id } });
        if (!me)
            throw new common_1.NotFoundException('Пользователь не найден');
        const data = {};
        if (dto.name !== undefined) {
            const name = dto.name.trim();
            if (name.length < 2 || name.length > 120) {
                throw new common_1.BadRequestException('Имя: от 2 до 120 символов');
            }
            data.name = name;
        }
        if (dto.email !== undefined) {
            const email = dto.email.trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                throw new common_1.BadRequestException('Некорректный email');
            }
            if (!dto.currentPassword) {
                throw new common_1.BadRequestException('Для смены email введите текущий пароль');
            }
            if (!(await bcrypt.compare(dto.currentPassword, me.passwordHash))) {
                throw new common_1.BadRequestException('Текущий пароль указан неверно');
            }
            const exists = await this.prisma.user.findUnique({ where: { email } });
            if (exists && exists.id !== me.id) {
                throw new common_1.ConflictException('Этот email уже используется');
            }
            data.email = email;
        }
        if (Object.keys(data).length === 0) {
            throw new common_1.BadRequestException('Нет данных для обновления');
        }
        return this.prisma.user.update({
            where: { id: me.id },
            data,
            select: { id: true, email: true, name: true, role: true, status: true },
        });
    }
    async changePassword(user, currentPassword, newPassword) {
        if (newPassword.length < 8 || newPassword.length > 128) {
            throw new common_1.BadRequestException('Новый пароль: от 8 до 128 символов');
        }
        const me = await this.prisma.user.findUnique({ where: { id: user.id } });
        if (!me)
            throw new common_1.NotFoundException('Пользователь не найден');
        if (!(await bcrypt.compare(currentPassword, me.passwordHash))) {
            throw new common_1.BadRequestException('Текущий пароль указан неверно');
        }
        await this.prisma.user.update({
            where: { id: me.id },
            data: { passwordHash: await bcrypt.hash(newPassword, 12) },
        });
        await this.prisma.passwordResetToken.deleteMany({ where: { userId: me.id } });
    }
    async requestPasswordReset(email) {
        const emailNorm = email.trim().toLowerCase();
        const user = await this.prisma.user.findUnique({ where: { email: emailNorm } });
        if (user && user.status !== 'blocked') {
            await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
            const token = (0, node_crypto_1.randomBytes)(32).toString('hex');
            await this.prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash: (0, node_crypto_1.createHash)('sha256').update(token).digest('hex'),
                    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
                },
            });
            const link = `${process.env.PUBLIC_BASE_URL ?? 'http://localhost:5180'}/reset-password?token=${token}`;
            await this.mail.send(user.email, 'Восстановление пароля PulseCheck', 'Ссылка для восстановления пароля (действует 30 минут):\n' + link);
            if (!this.mail.enabled && process.env.NODE_ENV !== 'production') {
                return { devResetUrl: link };
            }
        }
        return {};
    }
    async resetPassword(token, newPassword) {
        if (newPassword.length < 8 || newPassword.length > 128) {
            throw new common_1.BadRequestException('Пароль: от 8 до 128 символов');
        }
        const tokenHash = (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
        const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
        if (!row || row.usedAt || row.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Ссылка недействительна или устарела');
        }
        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: row.userId },
                data: { passwordHash: await bcrypt.hash(newPassword, 12) },
            }),
            this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
        ]);
    }
};
exports.ProfileService = ProfileService;
exports.ProfileService = ProfileService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mail_service_1.MailService])
], ProfileService);
//# sourceMappingURL=profile.service.js.map