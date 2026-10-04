import { aggregateResults } from '../../src/modules/lectures/results.helper';

const options = [
  { id: 'a', pollId: 'p1', text: 'A', position: 0 },
  { id: 'b', pollId: 'p1', text: 'B', position: 1 },
  { id: 'c', pollId: 'p1', text: 'C', position: 2 },
];

const poll = (type: string) => ({
  id: 'p1',
  slideId: 's1',
  questionText: 'Q',
  type,
  required: true,
  createdAt: new Date(),
  options,
});

const answer = (selected: string[] | null, ranking: string[] | null, i: number) => ({
  id: `ans${i}`,
  lectureId: 'l1',
  pollId: 'p1',
  pseudonym: `anon${i}`,
  selectedOptionIds: selected,
  rankingOrder: ranking,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('aggregateResults', () => {
  it('single: считает голоса и доли', () => {
    const r = aggregateResults(poll('single'), [
      answer(['a'], null, 1),
      answer(['a'], null, 2),
      answer(['b'], null, 3),
    ]);
    expect(r.totalResponses).toBe(3);
    expect(r.answeredNonEmpty).toBe(3);
    expect(r.options.find((o) => o.id === 'a')!.count).toBe(2);
    expect(r.options.find((o) => o.id === 'a')!.share).toBeCloseTo(2 / 3);
    expect(r.options.find((o) => o.id === 'c')!.count).toBe(0);
  });

  it('multiple: один студент может дать голоса нескольким вариантам', () => {
    const r = aggregateResults(poll('multiple'), [answer(['a', 'c'], null, 1)]);
    expect(r.answeredNonEmpty).toBe(1);
    expect(r.options.find((o) => o.id === 'a')!.count).toBe(1);
    expect(r.options.find((o) => o.id === 'c')!.count).toBe(1);
    expect(r.options.find((o) => o.id === 'b')!.count).toBe(0);
  });

  it('ranking: очки Борда и средние места', () => {
    // два студента: [a,b,c] и [a,c,b]
    const r = aggregateResults(poll('ranking'), [
      answer(null, ['a', 'b', 'c'], 1),
      answer(null, ['a', 'c', 'b'], 2),
    ]);
    const a = r.options.find((o) => o.id === 'a')!;
    const b = r.options.find((o) => o.id === 'b')!;
    const c = r.options.find((o) => o.id === 'c')!;
    expect(a.points).toBe(6); // 3+3
    expect(b.points).toBe(3); // 2+1
    expect(c.points).toBe(3); // 1+2
    expect(a.avgRank).toBe(1);
    expect(b.avgRank).toBe(2.5);
    expect(c.avgRank).toBeCloseTo(2.5); // места 3 и 2
  });

  it('пропуск не попадает в answeredNonEmpty, но входит в totalResponses', () => {
    const r = aggregateResults(poll('single'), [answer([], null, 1), answer(['a'], null, 2)]);
    expect(r.totalResponses).toBe(2);
    expect(r.answeredNonEmpty).toBe(1);
    expect(r.options.find((o) => o.id === 'a')!.share).toBe(1);
  });
});
