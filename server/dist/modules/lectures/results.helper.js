"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateResults = aggregateResults;
function aggregateResults(poll, answers) {
    const options = [...poll.options].sort((a, b) => a.position - b.position);
    const stats = new Map();
    for (const o of options)
        stats.set(o.id, { count: 0, rankSum: 0, points: 0 });
    let answeredNonEmpty = 0;
    for (const answer of answers) {
        const nonEmpty = (answer.selectedOptionIds?.length ?? 0) > 0 ||
            (answer.rankingOrder?.length ?? 0) > 0;
        if (!nonEmpty)
            continue;
        answeredNonEmpty++;
        if (poll.type === 'ranking') {
            const order = answer.rankingOrder ?? [];
            order.forEach((optionId, idx) => {
                const s = stats.get(optionId);
                if (!s)
                    return;
                s.count += 1;
                s.rankSum += idx + 1;
                s.points += order.length - idx;
            });
        }
        else {
            const selected = answer.selectedOptionIds ?? [];
            for (const optionId of selected) {
                const s = stats.get(optionId);
                if (s)
                    s.count += 1;
            }
        }
    }
    const optionResults = options.map((o) => {
        const s = stats.get(o.id);
        return {
            id: o.id,
            text: o.text,
            position: o.position,
            count: s.count,
            share: answeredNonEmpty > 0 ? s.count / answeredNonEmpty : 0,
            avgRank: poll.type === 'ranking' && s.count > 0 ? s.rankSum / s.count : null,
            points: s.points,
        };
    });
    return {
        pollId: poll.id,
        questionText: poll.questionText,
        type: poll.type,
        totalResponses: answers.length,
        answeredNonEmpty,
        options: optionResults,
    };
}
//# sourceMappingURL=results.helper.js.map