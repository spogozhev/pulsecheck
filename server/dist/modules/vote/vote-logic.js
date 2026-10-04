"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAnswerPayload = validateAnswerPayload;
exports.computePseudonym = computePseudonym;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
function validateAnswerPayload(poll, payload) {
    const ids = payload.selectedOptionIds ?? [];
    const ranking = payload.rankingOrder ?? [];
    const validIds = new Set(poll.optionIds);
    const allValid = (arr) => arr.every((id) => validIds.has(id));
    if (poll.type === 'ranking') {
        if (ids.length > 0) {
            throw new common_1.BadRequestException('Для ранжирования передайте rankingOrder');
        }
        if (ranking.length > 0) {
            if (ranking.length !== validIds.size || new Set(ranking).size !== ranking.length || !allValid(ranking)) {
                throw new common_1.BadRequestException('Ранжирование должно содержать все варианты ровно один раз');
            }
        }
        else if (poll.required) {
            throw new common_1.BadRequestException('Упорядочьте все варианты');
        }
        return;
    }
    if (ranking.length > 0) {
        throw new common_1.BadRequestException('rankingOrder допустим только для ранжирования');
    }
    if (ids.length > 0) {
        if (!allValid(ids) || new Set(ids).size !== ids.length) {
            throw new common_1.BadRequestException('Переданы недопустимые варианты ответа');
        }
        if (poll.type === 'single' && ids.length > 1) {
            throw new common_1.BadRequestException('В этом вопросе можно выбрать только один вариант');
        }
    }
    else if (poll.required) {
        throw new common_1.BadRequestException('Выберите хотя бы один вариант');
    }
}
function computePseudonym(anonId, key) {
    return (0, node_crypto_1.createHmac)('sha256', key).update(anonId).digest('hex');
}
//# sourceMappingURL=vote-logic.js.map