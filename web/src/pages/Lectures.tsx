import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '../api/client';
import type { Lecture } from '../api/types';

export function LecturesPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [course, setCourse] = useState('');
  const [status, setStatus] = useState('');

  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (course.trim()) params.set('course', course.trim());
  if (status) params.set('status', status);

  const list = useQuery({
    queryKey: ['lectures', from, to, course, status],
    queryFn: () => api.get<Lecture[]>(`/api/lectures?${params.toString()}`),
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Лекции</h1>

      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">С</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">По</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="min-w-48 flex-1">
          <label className="label">Курс</label>
          <input className="input" value={course} placeholder="Фильтр по курсу" onChange={(e) => setCourse(e.target.value)} />
        </div>
        <div>
          <label className="label">Статус</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Все</option>
            <option value="active">Идут сейчас</option>
            <option value="finished">Завершённые</option>
          </select>
        </div>
        {(from || to || course || status) && (
          <button
            className="btn-secondary"
            onClick={() => {
              setFrom('');
              setTo('');
              setCourse('');
              setStatus('');
            }}
          >
            Сбросить
          </button>
        )}
      </div>

      {list.isLoading ? (
        <div className="text-slate-400">Загрузка…</div>
      ) : !list.data?.length ? (
        <div className="card p-10 text-center text-slate-400">
          Лекций пока нет. Запустите презентацию со страницы{' '}
          <Link to="/presentations" className="text-sky-600 hover:underline">
            презентаций
          </Link>
          .
        </div>
      ) : (
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
              </tr>
            </thead>
            <tbody>
              {list.data.map((l) => (
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
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">идёт</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">завершена</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
