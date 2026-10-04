import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '../api/client';
import type { Analytics } from '../api/types';
import { ResultsView } from '../components/ResultsView';

const TYPE_RU: Record<string, string> = {
  single: 'один вариант',
  multiple: 'несколько вариантов',
  ranking: 'ранжирование',
};

/** Мини-график темпа ответов: 12 столбиков по времени. */
function Timeline({ timestamps }: { timestamps: string[] }) {
  if (timestamps.length < 2) return null;
  const times = timestamps.map((t) => new Date(t).getTime()).sort((a, b) => a - b);
  const min = times[0];
  const max = times[times.length - 1];
  const buckets = 12;
  const counts = new Array(buckets).fill(0);
  for (const t of times) {
    const idx = Math.min(buckets - 1, Math.floor(((t - min) / Math.max(1, max - min)) * buckets));
    counts[idx]++;
  }
  const peak = Math.max(1, ...counts);
  return (
    <div className="mt-3 flex h-10 items-end gap-1">
      {counts.map((c, i) => (
        <div
          key={i}
          className="w-full rounded-t bg-sky-200"
          style={{ height: `${Math.max(6, (c / peak) * 100)}%` }}
          title={`${c} ответ(ов)`}
        />
      ))}
    </div>
  );
}

export function LectureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['lectureAnalytics', id],
    queryFn: () => api.get<Analytics>(`/api/lectures/${id}`),
  });

  if (isLoading) return <div className="text-slate-400">Загрузка…</div>;
  if (isError || !data)
    return <div className="card p-6 text-rose-600">Лекция не найдена</div>;

  const { lecture, presentation, polls, participants, totalAnswers } = data;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-bold text-slate-800">{lecture.title}</h1>
        {lecture.status === 'active' && (
          <Link to={`/present/${lecture.id}`} className="text-sm text-sky-600 hover:underline">
            вернуться к показу →
          </Link>
        )}
      </div>
      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
        <span>{dayjs(lecture.startedAt).format('D MMMM YYYY, HH:mm')}</span>
        {lecture.endedAt && <span>завершена {dayjs(lecture.endedAt).format('HH:mm')}</span>}
        <span>Презентация: {presentation.title}</span>
        {lecture.course && <span>Курс: {lecture.course}</span>}
        <span>
          {lecture.linkAnswers ? 'связывание ответов включено' : 'связывание ответов выключено'}
        </span>
      </div>

      <div className="card mb-6 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <div>
          <div className="text-2xl font-bold text-slate-800">{totalAnswers}</div>
          <div className="text-xs text-slate-500">ответов всего</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-800">{participants}</div>
          <div className="text-xs text-slate-500">
            {lecture.linkAnswers ? 'участников (уникальных)' : 'сессий ответов'}
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-800">{polls.length}</div>
          <div className="text-xs text-slate-500">вопросов</div>
        </div>
        <div className="flex flex-col justify-center gap-2">
          <a className="btn-secondary text-xs" href={`/api/lectures/${id}/export?format=csv`}>
            ⬇ CSV
          </a>
          <a className="btn-secondary text-xs" href={`/api/lectures/${id}/export?format=json`}>
            ⬇ JSON
          </a>
        </div>
      </div>

      {polls.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          В этой лекции не было вопросов с голосованием
        </div>
      ) : (
        <div className="space-y-4">
          {polls.map((p) => (
            <div key={p.pollId} className="card p-5">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold text-slate-800">{p.questionText}</h3>
                <span className="text-xs text-slate-400">
                  слайд №{p.slideIndex + 1} · {TYPE_RU[p.type] ?? p.type}
                </span>
              </div>
              <ResultsView results={p.results} />
              {p.responseTimestamps.length > 1 && (
                <>
                  <Timeline timestamps={p.responseTimestamps} />
                  <div className="mt-1 text-xs text-slate-400">
                    Динамика ответов: {dayjs(p.responseTimestamps[0]).format('HH:mm:ss')} —{' '}
                    {dayjs(p.responseTimestamps[p.responseTimestamps.length - 1]).format('HH:mm:ss')}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
