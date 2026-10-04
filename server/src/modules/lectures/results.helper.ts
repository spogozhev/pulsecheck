import { Answer, Poll, PollOption } from '@prisma/client';

export interface OptionResult {
  id: string;
  text: string;
  position: number;
  count: number;
  share: number;
  avgRank: number | null; // средняя позиция (1 = лучший), только для ranking
  points: number; // очки Борда (n - позиция), только для ranking
}

export interface PollResults {
  pollId: string;
  questionText: string;
  type: string;
  totalResponses: number; // все отправки, включая пропуски
  answeredNonEmpty: number;
  options: OptionResult[];
}

type PollWithOptions = Poll & { options: PollOption[] };

/** Агрегация ответов по опросу: счётчики, доли, ранги/очки Борда. */
export function aggregateResults(poll: PollWithOptions, answers: Answer[]): PollResults {
  const options = [...poll.options].sort((a, b) => a.position - b.position);
  const stats = new Map<string, { count: number; rankSum: number; points: number }>();
  for (const o of options) stats.set(o.id, { count: 0, rankSum: 0, points: 0 });

  let answeredNonEmpty = 0;
  for (const answer of answers) {
    const nonEmpty =
      ((answer.selectedOptionIds as string[] | null)?.length ?? 0) > 0 ||
      ((answer.rankingOrder as string[] | null)?.length ?? 0) > 0;
    if (!nonEmpty) continue;
    answeredNonEmpty++;

    if (poll.type === 'ranking') {
      const order = (answer.rankingOrder as string[] | null) ?? [];
      order.forEach((optionId, idx) => {
        const s = stats.get(optionId);
        if (!s) return;
        s.count += 1;
        s.rankSum += idx + 1;
        s.points += order.length - idx; // первое место даёт максимум
      });
    } else {
      const selected = (answer.selectedOptionIds as string[] | null) ?? [];
      for (const optionId of selected) {
        const s = stats.get(optionId);
        if (s) s.count += 1;
      }
    }
  }

  const optionResults: OptionResult[] = options.map((o) => {
    const s = stats.get(o.id)!;
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
