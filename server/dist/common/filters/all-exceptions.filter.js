"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
let AllExceptionsFilter = class AllExceptionsFilter {
    logger = new common_1.Logger('Exceptions');
    catch(exception, host) {
        const res = host.switchToHttp().getResponse();
        if (exception instanceof common_1.HttpException) {
            const body = exception.getResponse();
            const message = typeof body === 'string' ? body : (body.message ?? exception.message);
            return res.status(exception.getStatus()).json({ statusCode: exception.getStatus(), message });
        }
        const prismaError = exception;
        if (prismaError?.code === 'P2002') {
            return res.status(common_1.HttpStatus.CONFLICT).json({
                statusCode: common_1.HttpStatus.CONFLICT,
                message: 'Нарушение уникальности данных',
            });
        }
        if (prismaError?.code === 'P2025') {
            return res
                .status(common_1.HttpStatus.NOT_FOUND)
                .json({ statusCode: common_1.HttpStatus.NOT_FOUND, message: 'Объект не найден' });
        }
        this.logger.error(exception?.stack ?? String(exception));
        return res
            .status(common_1.HttpStatus.INTERNAL_SERVER_ERROR)
            .json({ statusCode: 500, message: 'Внутренняя ошибка сервера' });
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map