"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfMiddleware = csrfMiddleware;
const node_crypto_1 = require("node:crypto");
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT = [/^\/api\/auth\/(login|register|logout)$/, /^\/api\/vote(\/|$)/];
function csrfMiddleware(req, res, next) {
    if (SAFE_METHODS.has(req.method.toUpperCase()))
        return next();
    if (CSRF_EXEMPT.some((re) => re.test(req.path)))
        return next();
    if (req.headers.authorization?.startsWith('Bearer '))
        return next();
    const cookie = req.cookies?.csrf;
    const header = req.headers['x-csrf-token'];
    if (typeof cookie === 'string' &&
        typeof header === 'string' &&
        cookie.length === header.length &&
        cookie.length > 0 &&
        (0, node_crypto_1.timingSafeEqual)(Buffer.from(cookie), Buffer.from(header))) {
        return next();
    }
    res.status(403).json({ statusCode: 403, message: 'Недействительный CSRF-токен' });
}
//# sourceMappingURL=csrf.middleware.js.map