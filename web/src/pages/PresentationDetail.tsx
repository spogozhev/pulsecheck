import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Lecture, Presentation } from '../api/types';
import { PollBuilder, PollDraft } from '../components/PollBuilder';
import { CopySlidesDialog } from '../components/CopySlidesDialog';
import { useAuth } from '../state/auth';

export function PresentationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const notApproved = user?.status !== 'approved';

  const [selected, setSelected] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [copyOpen, setCopyOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [launchCourse, setLaunchCourse] = useState('');
  const [launchLink, setLaunchLink] = useState(true);

  const presQ = useQuery({
    queryKey: ['pres', id],
    queryFn: () => api.get<Presentation>(`/api/presentations/${id}`),
    refetchInterval: (q) => (q.state.data?.status === 'processing' ? 3000 : false),
  });
  const presentationsQ = useQuery({
    queryKey: ['presentations'],
    queryFn: () => api.get<Presentation[]>('/api/presentations'),
  });

  const pres = presQ.data;
  const slides = useMemo(() => pres?.slides ?? [], [pres]);
  const slide = slides.find((s) => s.index === selected) ?? null;
  const ready = pres?.status === 'ready';

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['pres', id] });
    void qc.invalidateQueries({ queryKey: ['presentations'] });
  };
  const fail = (e: unknown) => setActionError(e instanceof Error ? e.message : 'Ошибка');

  const rename = useMutation({
    mutationFn: (title: string) => api.patch(`/api/presentations/${id}`, { title }),
    onSuccess: invalidate,
    onError: fail,
  });

  const launch = useMutation({
    mutationFn: () =>
      api.post<Lecture>('/api/lectures', {
        presentationId: id,
        course: launchCourse.trim() || undefined,
        linkAnswers: launchLink,
      }),
    onSuccess: (lecture) => navigate(`/present/${lecture.id}`),
    onError: fail,
  });

  const savePoll = useMutation({
    mutationFn: (draft: PollDraft) =>
      api.put(`/api/presentations/${id}/slides/${slide!.id}/poll`, draft),
    onSuccess: invalidate,
    onError: fail,
  });

  const removePoll = useMutation({
    mutationFn: () => api.del(`/api/presentations/${id}/slides/${slide!.id}/poll`),
    onSuccess: invalidate,
    onError: fail,
  });

  const addQuestionSlide = useMutation({
    mutationFn: (afterIndex: number | null) =>
      api.post(`/api/presentations/${id}/slides`, afterIndex === null ? {} : { afterIndex }),
    onSuccess: (s) => {
      invalidate();
      setSelected((s as { index: number }).index);
    },
    onError: fail,
  });

  const deleteSlide = useMutation({
    mutationFn: (slideId: string) => api.del(`/api/presentations/${id}/slides/${slideId}`),
    onSuccess: () => {
      setSelected(0);
      invalidate();
    },
    onError: fail,
  });

  const copySlides = useMutation({
    mutationFn: (args: { target: string; insertAfterIndex: number | null }) =>
      api.post('/api/slides/copy', {
        slideIds: [...checked],
        targetPresentationId: args.target,
        insertAfterIndex: args.insertAfterIndex ?? undefined,
      }),
    onSuccess: () => {
      setCopyOpen(false);
      setChecked(new Set());
      invalidate();
    },
    onError: fail,
  });

  const removePresentation = useMutation({
    mutationFn: () => api.del(`/api/presentations/${id}`),
    onSuccess: () => navigate('/presentations'),
    onError: fail,
  });

  if (presQ.isLoading) return <div className="text-slate-400">Загрузка…</div>;
  if (presQ.isError || !pres)
    return <div className="card p-6 text-rose-600">Презентация не найдена. <Link to="/presentations" className="text-sky-600 hover:underline">К списку</Link></div>;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Шапка */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-md text-lg font-semibold"
          defaultValue={pres.title}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== pres.title) rename.mutate(v);
          }}
        />
        {pres.status === 'processing' && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">⏳ Обработка…</span>
        )}
        {pres.status === 'failed' && (
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-700" title={pres.error ?? ''}>
            Ошибка обработки
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <a className="btn-secondary" href={`/api/presentations/${id}/original`}>
            Оригинал
          </a>
          <button
            className="btn-danger"
            onClick={() => {
              if (confirm(`Удалить «${pres.title}»?`)) removePresentation.mutate();
            }}
          >
            Удалить
          </button>
        </div>
      </div>

      {/* Панель запуска лекции */}
      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Курс/дисциплина (для истории)</label>
          <input
            className="input w-56"
            value={launchCourse}
            placeholder="Например: Алгоритмы"
            onChange={(e) => setLaunchCourse(e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-sky-600"
            checked={launchLink}
            onChange={(e) => setLaunchLink(e.target.checked)}
          />
          Связывать ответы одного студента между вопросами
        </label>
        <button
          className="btn-primary ml-auto"
          disabled={!ready || launch.isPending || notApproved}
          onClick={() => launch.mutate()}
          title={notApproved ? 'Аккаунт не подтверждён администратором' : undefined}
        >
          {launch.isPending ? 'Запуск…' : '▶ Запустить лекцию'}
        </button>
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{actionError}</div>
      )}

      {/* Лента слайдов */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-slate-700">Слайды ({slides.length})</h2>
        <div className="flex gap-2">
          <button
            className="btn-secondary"
            disabled={!ready || notApproved}
            onClick={() => addQuestionSlide.mutate(selected)}
            title="Вставить слайд-вопрос после выбранного"
          >
            + Слайд-вопрос
          </button>
          <button
            className="btn-secondary"
            disabled={checked.size === 0 || !ready || notApproved}
            onClick={() => setCopyOpen(true)}
          >
            Копировать выбранные ({checked.size})
          </button>
        </div>
      </div>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {slides.map((s) => (
          <button
            key={s.id}
            className={`relative w-36 shrink-0 rounded-lg border-2 p-1 text-left transition-colors ${
              s.index === selected ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-slate-300'
            }`}
            onClick={() => setSelected(s.index)}
          >
            <input
              type="checkbox"
              className="absolute left-1 top-1 z-10 h-4 w-4 accent-sky-600"
              checked={checked.has(s.id)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const next = new Set(checked);
                if (e.target.checked) next.add(s.id);
                else next.delete(s.id);
                setChecked(next);
              }}
            />
            <div className="flex h-20 items-center justify-center overflow-hidden rounded bg-slate-100">
              {s.imagePath ? (
                <img src={`/api/storage/${s.imagePath}`} alt="" className="max-h-20" />
              ) : (
                <span className="text-2xl">❓</span>
              )}
            </div>
            <div className="flex items-center justify-between px-1 pt-1 text-xs text-slate-500">
              <span>№{s.index + 1}</span>
              {s.poll && <span className="rounded bg-violet-100 px-1 text-violet-700">опрос</span>}
            </div>
          </button>
        ))}
      </div>

      {/* Редактор выбранного слайда */}
      {slide && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">
                Слайд №{slide.index + 1}{' '}
                {slide.isGenerated && <span className="text-xs text-slate-400">(слайд-вопрос)</span>}
              </h3>
              <button
                className="text-xs text-rose-500 hover:underline disabled:opacity-40"
                disabled={!ready || slides.length <= 1}
                onClick={() => {
                  if (confirm('Удалить этот слайд?')) deleteSlide.mutate(slide.id);
                }}
              >
                Удалить слайд
              </button>
            </div>
            <div className="flex min-h-56 items-center justify-center rounded-lg bg-slate-100 p-2">
              {slide.imagePath ? (
                <img src={`/api/storage/${slide.imagePath}`} alt="" className="max-h-80" />
              ) : (
                <div className="p-8 text-center text-slate-400">
                  Слайд-вопрос: отображается как полноэкранная заставка с текстом вопроса
                </div>
              )}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-3 font-semibold text-slate-700">
              Опрос на этом слайде {!ready && <span className="text-xs text-slate-400">(после обработки)</span>}
            </h3>
            {ready ? (
              <PollBuilder
                key={slide.id}
                slide={slide}
                saving={savePoll.isPending || removePoll.isPending}
                error={savePoll.isError || removePoll.isError ? actionError : null}
                disabled={notApproved}
                onSave={(draft) => savePoll.mutate(draft)}
                onRemove={() => removePoll.mutate()}
              />
            ) : (
              <div className="text-sm text-slate-400">Дождитесь обработки презентации.</div>
            )}
          </div>
        </div>
      )}

      {copyOpen && (
        <CopySlidesDialog
          count={checked.size}
          presentations={(presentationsQ.data ?? []).filter((p) => p.id !== id)}
          busy={copySlides.isPending}
          error={copySlides.isError ? (copySlides.error as Error).message : null}
          onCancel={() => setCopyOpen(false)}
          onConfirm={(target, insertAfterIndex) => copySlides.mutate({ target, insertAfterIndex })}
        />
      )}
    </div>
  );
}
