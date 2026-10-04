"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
const csrf_middleware_1 = require("./common/middleware/csrf.middleware");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const config = app.get(config_1.ConfigService);
    app.setGlobalPrefix('api');
    app.use((0, helmet_1.default)({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
    app.use((0, cookie_parser_1.default)());
    app.use(csrf_middleware_1.csrfMiddleware);
    app.enableCors({
        origin: config.get('webOrigins'),
        credentials: true,
    });
    app.useBodyParser('json', { limit: '1mb' });
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('PulseCheck API')
        .setDescription('API сервиса интерактивных опросов во время лекций. Аутентификация — Bearer или cookie sid (CSRF-заголовок x-csrf-token для мутаций).')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    swagger_1.SwaggerModule.setup('api/docs', app, swagger_1.SwaggerModule.createDocument(app, swaggerConfig));
    const port = config.get('port');
    await app.listen(port, '0.0.0.0');
    new common_1.Logger('Bootstrap').log(`API запущено: http://localhost:${port}/api, Swagger: http://localhost:${port}/api/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map