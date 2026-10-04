"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configFactory = void 0;
const node_path_1 = __importDefault(require("node:path"));
const configFactory = () => ({
    port: parseInt(process.env.PORT ?? '3001', 10),
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    jwtSecret: process.env.JWT_SECRET ?? 'dev-jwt-secret',
    storageDir: process.env.STORAGE_DIR
        ? node_path_1.default.resolve(process.cwd(), process.env.STORAGE_DIR)
        : node_path_1.default.resolve(process.cwd(), '../storage'),
    libreofficePath: process.env.LIBREOFFICE_PATH ?? 'soffice',
    webOrigins: (process.env.WEB_ORIGIN ?? 'http://localhost:5180')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? 'http://localhost:5180').replace(/\/+$/, ''),
    isProd: process.env.NODE_ENV === 'production',
});
exports.configFactory = configFactory;
//# sourceMappingURL=configuration.js.map