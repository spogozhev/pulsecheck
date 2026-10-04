import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '../api/client';
import type { LecturePage } from '../api/types';

const PAGE_SIZE = 10;

/** Прерванная сессия: активна дольше 2 часов с начала — можно принудительно завершить. */
const isStale = (l: { status: string; startedAt: string }) =>
  l.status === 'active' && dayjs().diff(dayjs(l.startedAt), 'hour', true) >= 2;

export function LecturesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [course, setCourse] = useState('');
  const [status, setStatus] = useState('');

  // раз в минуту перерисовываем список, чтобы кнопка «Завершить» появилась ровно через 2 часа
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const setFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (course.trim()) params.set('course', course.trim());
  if (status) params.set('status', status);
  params.set('page', String(page));
  params.set('pageSize', String(PAGE_SIZE));

  const list = useQuery({
    queryKey: ['lectures', from, to, course, status, page],
    queryFn: () => api.get<LecturePage>(`/api/lectures?${params.toString()}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/lectures/${id}`),
    onSuccess: () => {
      // если удалили последнюю запись на странице — переходим на предыдущую
      if (list.data && list.data.items.length === 1 && page > 1) setPage(page - 1);
      else void qc.invalidateQueries({ queryKey: ['lectures'] });
    },
  });

  const forceFinish = useMutation({
    mutationFn: (id: string) => api.post(`/api/lectures/${id}/finish`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['lectures'] }),
  });

  const lectures = list.data?.items ?? [];
  const pageCount = list.data?.pageCount ?? 1;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Лекции</h1>

      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">С</label>
          <input type="date" className="input" value={from} onChange={(e) => setFilter(() => setFrom(e.target.value))} />
        </div>
        <div>
          <label className="label">По</label>
          <input type="date" className="input" value={to} onChange={(e) => setFilter(() => setTo(e.target.value))} />
        </div>
        <div className="min-w-48 flex-1">
          <label className="label">Курс</label>
          <input
            className="input"
            value={course}
            placeholder="Фильтр по курсу"
            onChange={(e) => setFilter(() => setCourse(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Статус</label>
          <select className="input" value={status} onChange={(e) => setFilter(() => setStatus(e.target.value))}>
            <option value="">Все</option>
            <option value="active">Идут сейчас</option>
            <option value="finished">Завершённые</option>
          </select>
        </div>
        {(from || to || course || status) && (
          <button
            className="btn-secondary"
            onClick={() =>
              setFilter(() => {
                setFrom('');
                setTo('');
                setCourse('');
                setStatus('');
              })
            }
          >
            Сбросить
          </button>
        )}
      </div>

      {list.isLoading ? (
        <div className="text-slate-400">Загрузка…</div>
      ) : !lectures.length ? (
        <div className="card p-10 text-center text-slate-400">
          Лекций пока нет. Запустите презентацию со страницы{' '}
          <Link to="/presentations" className="text-sky-600 hover:underline">
            презентаций
          </Link>
          .
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Лекция</th>
                  <th className="px-4 py-3">Курс</th>
                  <th className="px-4 py-3">Презентация</th>
                  <th className="px-4 py-3">Начало</th>
                  <th className="px-4 py-3">Ответов</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {lectures.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/lectures/${l.id}`} className="font-medium text-sky-700 hover:underline">
                        {l.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.course ?? '—'}</td>
                    <td className="max-w-48 truncate px-4 py-3 text-slate-600">{l.presentation?.title ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{dayjs(l.startedAt).format('D MMM YYYY, HH:mm')}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{l.answersCount ?? 0}</td>
                    <td className="px-4 py-3">
                      {l.status === 'active' ? (
                        isStale(l) ? (
                          <button
                            className="btn-danger px-2 py-0.5 text-xs"
                            disabled={forceFinish.isPending}
                            title="Сессия идёт больше 2 часов — принудительно завершить"
                            onClick={() => {
                              if (
                                confirm(
                                  `Лекция «${l.title}» идёт больше 2 часов. Принудительно завершить её?`,
                                )
                              )
                                forceFinish.mutate(l.id);
                            }}
                          >
                            Завершить
                          </button>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                            идёт
                          </span>
                        )
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          завершена
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {l.status === 'active' ? (
                        <span
                          className="cursor-not-allowed text-xs text-slate-300"
                          title="Активную лекцию нельзя удалить — сначала завершите её"
                        >
                          Удалить
                        </span>
                      ) : (
                        <button
                          className="text-xs text-rose-500 hover:underline disabled:opacity-40"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (confirm(`Удалить лекцию «${l.title}» вместе с её ответами?`)) remove.mutate(l.id);
                          }}
                        >
                          Удалить
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Пагинация */}
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>
              Всего: {list.data?.total ?? 0} · страница {page} из {pageCount}
            </span>
            <div className="flex gap-2">
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                ← Назад
              </button>
              <button
                className="btn-secondary"
                disabled={page >= pageCount}
                onClick={() => setPage(page + 1)}
              >
                Вперёд →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
