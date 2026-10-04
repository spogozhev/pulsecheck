import { BadRequestException } from '@nestjs/common';
import { computePseudonym, validateAnswerPayload } from '../../src/modules/vote/vote-logic';

const rule = (type: string, required = true) => ({
  type,
  required,
  optionIds: ['a', 'b', 'c'],
});

describe('validateAnswerPayload', () => {
  it('single: один корректный вариант проходит', () => {
    expect(() => validateAnswerPayload(rule('single'), { selectedOptionIds: ['a'] })).not.toThrow();
  });

  it('single: два варианта отклоняются', () => {
    expect(() => validateAnswerPayload(rule('single'), { selectedOptionIds: ['a', 'b'] })).toThrow(
      BadRequestException,
    );
  });

  it('multiple: несколько вариантов проходят', () => {
    expect(() => validateAnswerPayload(rule('multiple'), { selectedOptionIds: ['a', 'c'] })).not.toThrow();
  });

  it('неизвестный optionId отклоняется', () => {
    expect(() => validateAnswerPayload(rule('single'), { selectedOptionIds: ['zzz'] })).toThrow(
      BadRequestException,
    );
  });

  it('обязательный вопрос без выбора отклоняется; необязательный — нет', () => {
    expect(() => validateAnswerPayload(rule('single', true), {})).toThrow(BadRequestException);
    expect(() => validateAnswerPayload(rule('single', false), {})).not.toThrow();
  });

  it('ranking: полная перестановка проходит, частичная — нет', () => {
    expect(() => validateAnswerPayload(rule('ranking'), { rankingOrder: ['c', 'a', 'b'] })).not.toThrow();
    expect(() => validateAnswerPayload(rule('ranking'), { rankingOrder: ['a'] })).toThrow(
      BadRequestException,
    );
    expect(() => validateAnswerPayload(rule('ranking'), { rankingOrder: ['a', 'a', 'b'] })).toThrow(
      BadRequestException,
    );
  });

  it('ranking не принимает selectedOptionIds, single — rankingOrder', () => {
    expect(() => validateAnswerPayload(rule('ranking'), { selectedOptionIds: ['a'] })).toThrow(
      BadRequestException,
    );
    expect(() => validateAnswerPayload(rule('single'), { rankingOrder: ['a', 'b', 'c'] })).toThrow(
      BadRequestException,
    );
  });
});

describe('computePseudonym', () => {
  const anon = '11111111-2222-4333-8444-555555555555';

  it('детерминирован для одного устройства и ключа', () => {
    expect(computePseudonym(anon, 'salt1')).toBe(computePseudonym(anon, 'salt1'));
  });

  it('различается между устройствами и между ключами (преподавателями/вопросами)', () => {
    expect(computePseudonym(anon, 'salt1')).not.toBe(computePseudonym(anon, 'salt2'));
    expect(computePseudonym(anon, 'salt1')).not.toBe(computePseudonym('other-anon', 'salt1'));
    // без связывания: разные pollId дают разные псевдонимы
    expect(computePseudonym(anon, 's:l1:p1')).not.toBe(computePseudonym(anon, 's:l1:p2'));
  });

  it('не раскрывает anonymous_id (односторонний HMAC)', () => {
    const p = computePseudonym(anon, 'salt1');
    expect(p).not.toContain(anon);
    expect(p).toMatch(/^[0-9a-f]{64}$/);
  });
});
