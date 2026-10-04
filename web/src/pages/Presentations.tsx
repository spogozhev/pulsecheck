import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '../api/client';
import type { Presentation } from '../api/types';

export function PresentationsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['presentations', search, courseFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (courseFilter) params.set('course', courseFilter);
      return api.get<Presentation[]>(`/api/presentations?${params.toString()}`);
    },
    refetchInterval: (q) =>
      q.state.data?.some((p) => p.status === 'processing') ? 3000 : false,
  });

  const tags = useQuery({
    queryKey: ['presentationTags'],
    queryFn: () => api.get<string[]>('/api/presentations/tags'),
    staleTime: 30_000,
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      // название передаём явно: имена файлов в multipart браузер шлёт UTF-8,
      // а поле формы сервер декодирует корректно всегда
      form.append('title', file.name.replace(/\.(pdf|pptx)$/i, '').trim());
      return api.post<Presentation>('/api/presentations', form);
    },
    onSuccess: () => {
      setUploadError(null);
      void qc.invalidateQueries({ queryKey: ['presentations'] });
    },
    onError: (e) => setUploadError(e instanceof Error ? e.message : 'Ошибка загрузки'),
  });

  const importZip = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post<Presentation>('/api/presentations/import', form);
    },
    onSuccess: () => {
      setUploadError(null);
      void qc.invalidateQueries({ queryKey: ['presentations'] });
    },
    onError: (e) => setUploadError(e instanceof Error ? e.message : 'Ошибка импорта'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/presentations/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['presentations'] }),
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Презентации</h1>
        <div className="flex gap-2">
          <input
            ref={importRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importZip.mutate(file);
              e.target.value = '';
            }}
          />
          <button
            className="btn-secondary"
            onClick={() => importRef.current?.click()}
            disabled={importZip.isPending}
            title="Импорт portable-архива PulseCheck (.zip)"
          >
            {importZip.isPending ? 'Импорт…' : '⬆ Импорт архива'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = '';
            }}
          />
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? 'Загрузка…' : '+ Загрузить PDF/PPTX'}
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{uploadError}</div>
      )}

      {/* Быстрый поиск и теги курсов */}
      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <input
          className="input max-w-xs flex-1"
          value={search}
          placeholder="Поиск по названию или курсу"
          onChange={(e) => setSearch(e.target.value)}
        />
        {(tags.data ?? []).map((t) => (
          <button
            key={t}
            onClick={() => setCourseFilter(courseFilter === t ? null : t)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              courseFilter === t
                ? 'bg-sky-600 text-white'
                : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
            }`}
            title={`Показать только презентации курса «${t}»`}
          >
            #{t}
          </button>
        ))}
        {courseFilter && (
          <button
            className="text-xs text-slate-400 hover:text-slate-700"
            onClick={() => setCourseFilter(null)}
          >
            сбросить фильтр ✕
          </button>
        )}
      </div>

      {list.isLoading ? (
        <div className="text-slate-400">Загрузка…</div>
      ) : !list.data?.length ? (
        <div className="card p-10 text-center text-slate-400">
          Пока нет презентаций. Загрузите PDF или PPTX, чтобы начать.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.data.map((p) => {
            const slide = p.slides?.[0] ?? null;
            return (
              <div key={p.id} className="card group relative overflow-hidden">
                <Link to={`/presentations/${p.id}`} className="block">
                  <div className="flex h-36 items-center justify-center bg-slate-100">
                    {slide?.imagePath ? (
                      <img src={`/api/storage/${slide.imagePath}`} alt="" className="max-h-36" />
                    ) : (
                      <span className="text-4xl">📄</span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="mb-1 truncate font-medium text-slate-800">{p.title}</div>
                    <div className="text-xs text-slate-400">
                      {p.sourceType.toUpperCase()} · {dayjs(p.createdAt).format('D MMM YYYY')}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {p.status === 'processing' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                          ⏳ Обработка…
                        </span>
                      )}
                      {p.status === 'ready' && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                          {p._count?.slides ?? p.slideCount} слайдов
                        </span>
                      )}
                      {p.status === 'failed' && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700" title={p.error ?? ''}>
                          Ошибка обработки
                        </span>
                      )}
                      {p.course && (
                        <button
                          className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
                          title={`Показать только презентации курса «${p.course}»`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCourseFilter(p.course!);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          #{p.course}
                        </button>
                      )}
                    </div>
                  </div>
                </Link>
                <button
                  className="absolute right-2 top-2 hidden rounded-lg bg-white/90 px-2 py-1 text-xs text-rose-600 shadow group-hover:block"
                  onClick={() => {
                    if (confirm(`Удалить «${p.title}»?`)) remove.mutate(p.id);
                  }}
                >
                  Удалить
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
