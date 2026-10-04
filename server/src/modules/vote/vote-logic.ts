import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'node:crypto';

export interface PollRule {
  type: string;
  required: boolean;
  optionIds: string[];
}

export interface AnswerPayload {
  selectedOptionIds?: string[];
  rankingOrder?: string[];
}

/** Проверка ответа по правилам типа опроса. Пустой payload допустим только для необязательных вопросов. */
export function validateAnswerPayload(poll: PollRule, payload: AnswerPayload): void {
  const ids = payload.selectedOptionIds ?? [];
  const ranking = payload.rankingOrder ?? [];
  const validIds = new Set(poll.optionIds);
  const allValid = (arr: string[]) => arr.every((id) => validIds.has(id));

  if (poll.type === 'ranking') {
    if (ids.length > 0) {
      throw new BadRequestException('Для ранжирования передайте rankingOrder');
    }
    if (ranking.length > 0) {
      if (ranking.length !== validIds.size || new Set(ranking).size !== ranking.length || !allValid(ranking)) {
        throw new BadRequestException('Ранжирование должно содержать все варианты ровно один раз');
      }
    } else if (poll.required) {
      throw new BadRequestException('Упорядочьте все варианты');
    }
    return;
  }

  if (ranking.length > 0) {
    throw new BadRequestException('rankingOrder допустим только для ранжирования');
  }
  if (ids.length > 0) {
    if (!allValid(ids) || new Set(ids).size !== ids.length) {
      throw new BadRequestException('Переданы недопустимые варианты ответа');
    }
    if (poll.type === 'single' && ids.length > 1) {
      throw new BadRequestException('В этом вопросе можно выбрать только один вариант');
    }
  } else if (poll.required) {
    throw new BadRequestException('Выберите хотя бы один вариант');
  }
}

/**
 * Псевдоним устройства: HMAC(anonymous_id, key).
 * key = соль преподавателя (связывание ответов) либо соль + lectureId + pollId (без связывания).
 */
export function computePseudonym(anonId: string, key: string): string {
  return createHmac('sha256', key).update(anonId).digest('hex');
}
