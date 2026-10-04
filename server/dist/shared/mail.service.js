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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer_1 = require("nodemailer");
let MailService = class MailService {
    config;
    logger = new common_1.Logger('Mail');
    transporter;
    from;
    constructor(config) {
        this.config = config;
        const host = this.config.get('smtpHost');
        this.from = this.config.get('mailFrom') ?? 'PulseCheck <no-reply@localhost>';
        if (!host) {
            this.transporter = null;
            this.logger.warn('SMTP_HOST не задан — письма выводятся в консоль (dev-режим)');
            return;
        }
        const port = this.config.get('smtpPort') ?? 587;
        const user = this.config.get('smtpUser');
        const pass = this.config.get('smtpPass');
        this.transporter = (0, nodemailer_1.createTransport)({
            host,
            port,
            secure: port === 465,
            auth: user ? { user, pass } : undefined,
        });
    }
    get enabled() {
        return this.transporter !== null;
    }
    async send(to, subject, text) {
        if (!this.transporter) {
            this.logger.log(`[dev] Кому: ${to} | ${subject}\n${text}`);
            return;
        }
        try {
            await this.transporter.sendMail({ from: this.from, to, subject, text });
        }
        catch (e) {
            this.logger.error(`Не удалось отправить письмо на ${to}: ${String(e)}`);
            throw e;
        }
    }
    async onModuleDestroy() {
        await this.transporter?.close();
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MailService);
//# sourceMappingURL=mail.service.js.map