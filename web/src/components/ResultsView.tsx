import type { PollResults } from '../api/types';
import { MathText } from './MathText';

const BAR_COLORS = [
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-cyan-600',
  'bg-lime-600',
  'bg-fuchsia-500',
  'bg-orange-500',
  'bg-teal-500',
];

/** Диаграмма результатов: полосы для single/multiple, таблица Борда для ranking. */
export function ResultsView({ results, compact = false }: { results: PollResults; compact?: boolean }) {
  const isRanking = results.type === 'ranking';
  const sorted = isRanking
    ? [...results.options].sort((a, b) => b.points - a.points || (a.avgRank ?? 99) - (b.avgRank ?? 99))
    : [...results.options].sort((a, b) => b.count - a.count);
  const max = isRanking
    ? Math.max(1, ...sorted.map((o) => o.points))
    : Math.max(1, ...sorted.map((o) => o.count));

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {sorted.map((o, i) => (
        <div key={o.id}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium text-slate-800">
              <MathText text={o.text} />
            </span>
            <span className="shrink-0 tabular-nums text-slate-500">
              {isRanking ? (
                <>очки {o.points} · ср. место {o.avgRank !== null ? o.avgRank.toFixed(1) : '—'}</>
              ) : (
                <>
                  {o.count}{' '}
                  <span className="text-xs">
                    ({results.answeredNonEmpty > 0 ? Math.round(o.share * 100) : 0}%)
                  </span>
                </>
              )}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
              style={{
                width: `${Math.max(2, Math.round(((isRanking ? o.points : o.count) / max) * 100))}%`,
              }}
            />
          </div>
        </div>
      ))}
      <div className="pt-1 text-xs text-slate-400">
        Ответов: {results.totalResponses}
        {results.totalResponses !== results.answeredNonEmpty &&
          ` (из них по существу: ${results.answeredNonEmpty})`}
      </div>
    </div>
  );
}
