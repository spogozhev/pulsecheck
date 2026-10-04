import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api/client';
import type { LectureState, PollResults } from '../api/types';
import { ResultsView } from '../components/ResultsView';
import { MathText } from '../components/MathText';
import { Countdown } from '../components/Countdown';

const TYPE_HINT: Record<string, string> = {
  single: 'выбор одного варианта',
  multiple: 'выбор нескольких вариантов',
  ranking: 'ранжирование вариантов',
};

export function PresentPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [panelVisible, setPanelVisible] = useState(false);

  // Панель управления появляется, только когда курсор в нижней зоне экрана
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setPanelVisible(e.clientY > window.innerHeight - 140);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const stateQ = useQuery({
    queryKey: ['lectureState', lectureId],
    queryFn: () => api.get<LectureState>(`/api/lectures/${lectureId}/state`),
    refetchInterval: 2500,
    enabled: !!lectureId,
  });

  const state = stateQ.data;

  // Итоги предыдущего вопроса, которые ещё не показывали (с сервера — чтобы синхронизировать студентов)
  const pendingPollId = state?.pendingResults?.pollId ?? null;
  const pendingResultsQ = useQuery({
    queryKey: ['pendingResults', lectureId, pendingPollId],
    queryFn: () => api.get<PollResults>(`/api/lectures/${lectureId}/results?pollId=${pendingPollId}`),
    enabled: !!pendingPollId,
  });

  const go = useCallback(
    async (index: number) => {
      if (!state || !lectureId) return;
      const clamped = Math.max(0, Math.min(state.slideCount - 1, index));
      const newState = await api.patch<LectureState>(`/api/lectures/${lectureId}/slide`, {
        index: clamped,
      });
      qc.setQueryData(['lectureState', lectureId], newState);
    },
    [state, lectureId, qc],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!state) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        void go(state.currentSlideIndex + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        void go(state.currentSlideIndex - 1);
      } else if (e.key === 'Home') void go(0);
      else if (e.key === 'End') void go(state.slideCount - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, state]);

  const finish = useMutation({
    mutationFn: () => api.post(`/api/lectures/${lectureId}/finish`),
    onSuccess: () => navigate(`/lectures/${lectureId}`),
  });

  /** «Продолжить показ»: итоги показаны, студентам открывается следующий вопрос. */
  const revealResults = useCallback(async () => {
    await api.post(`/api/lectures/${lectureId}/reveal`);
    qc.setQueryData(['lectureState', lectureId], (old: LectureState | undefined) =>
      old ? { ...old, pendingResults: null } : old,
    );
  }, [lectureId, qc]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  if (stateQ.isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Загрузка…</div>;
  }
  if (stateQ.isError || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-rose-400">
        Лекция не найдена · <Link to="/lectures" className="ml-2 underline">к списку</Link>
      </div>
    );
  }

  const slide = state.slide;
  const poll = slide?.poll ?? null;

  return (
    <div className="relative h-screen overflow-hidden bg-slate-950">
      {/* Сцена: размытый слайд заполняет фон (никаких пустых полос), поверх — чёткий слайд целиком */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        {slide?.imageUrl && (
          <img
            src={slide.imageUrl}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 h-full w-full scale-110 select-none object-cover blur-2xl"
          />
        )}
        {slide?.imageUrl && (
          <img
            src={slide.imageUrl}
            alt={`Слайд ${state.currentSlideIndex + 1}`}
            className="absolute inset-0 h-full w-full select-none object-contain"
            draggable={false}
          />
        )}
        {slide && !slide.imageUrl ? (
          <div className="max-w-3xl px-6 text-center">
            <div className="mb-2 text-sm uppercase tracking-widest text-sky-400">
              {poll ? TYPE_HINT[poll.type] : 'слайд-вопрос'}
            </div>
            <div className="text-3xl font-bold leading-snug text-white sm:text-5xl">
              {poll ? <MathText text={poll.questionText} /> : 'Слайд-вопрос'}
            </div>
            {poll && (
              <ol className="mt-8 space-y-2 text-left text-xl text-slate-300">
                {poll.options.map((o, i) => (
                  <li key={o.id} className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2">
                    <span className="mr-2 font-mono text-sky-400">{i + 1}.</span>
                    <MathText text={o.text} />
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : (
          <div className="text-slate-500">Слайд недоступен</div>
        )}

        {/* QR-код на слайде-вопросе: приподнимается над панелью управления, когда та видна.
            Над QR — обратный отсчёт для опросов с ограничением времени. */}
        {poll && (
          <div
            className={`absolute right-4 z-20 rounded-2xl bg-white p-3 shadow-2xl transition-all duration-300 ${
              panelVisible ? 'bottom-24' : 'bottom-4'
            }`}
          >
            {poll.timeLimitSeconds != null && (state.secondsLeft ?? 0) > 0 && (
              <div className="mb-2 rounded-xl bg-slate-900 px-3 py-1.5 text-center shadow">
                <Countdown
                  secondsLeft={state.secondsLeft ?? 0}
                  className="text-2xl font-bold text-white"
                />
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  до конца опроса
                </div>
              </div>
            )}
            <QRCodeSVG value={state.voteUrl} size={222} level="M" />
            <div className="mt-1 text-center text-xs leading-tight text-slate-500">
              Наведите камеру
              <br />
              и ответьте
            </div>
            <div className="mt-1 rounded-full bg-sky-100 px-2 py-0.5 text-center text-sm font-semibold text-sky-700">
              Ответов: {poll.votedCount}
            </div>
          </div>
        )}

        {/* Результаты предыдущего вопроса: полностью закрывают экран (чёрный фон).
            Показываются, пока преподаватель не нажал «Продолжить показ» (максимум 10 секунд). */}
        {state.pendingResults && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950 p-6">
            {pendingResultsQ.data ? (
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Результаты предыдущего вопроса
                </div>
                <h3 className="mb-4 text-lg font-bold text-slate-800">
                  <MathText text={pendingResultsQ.data.questionText} />
                </h3>
                <ResultsView results={pendingResultsQ.data} />
                <button className="btn-primary mt-5 w-full" onClick={() => void revealResults()}>
                  Продолжить показ
                </button>
              </div>
            ) : (
              <div className="text-slate-500">Загрузка результатов…</div>
            )}
          </div>
        )}

        {state.status !== 'active' && (
          <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-amber-500/90 px-4 py-1 text-sm font-medium text-white">
            Лекция завершена ·{' '}
            <Link to={`/lectures/${state.id}`} className="underline">
              аналитика
            </Link>
          </div>
        )}
      </div>

      {/* Панель управления: плавающая, выезжает при наведении курсора на нижнюю зону */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-slate-800 bg-slate-900/95 px-4 py-2 text-slate-300 backdrop-blur transition-transform duration-300 ${
          panelVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <button
          className="btn-secondary"
          onClick={() => void go(state.currentSlideIndex - 1)}
          disabled={state.currentSlideIndex === 0}
        >
          ←
        </button>
        <span className="tabular-nums">
          {state.currentSlideIndex + 1} / {state.slideCount}
        </span>
        <button
          className="btn-secondary"
          onClick={() => void go(state.currentSlideIndex + 1)}
          disabled={state.currentSlideIndex >= state.slideCount - 1}
        >
          →
        </button>
        <div className="mx-2 hidden text-xs text-slate-500 sm:block">
          ← → пробел — переход · Home/End — края
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">Всего ответов: {state.answersTotal}</span>
          <button className="btn-secondary" onClick={toggleFullscreen}>
            ⛶ Полный экран
          </button>
          {state.status === 'active' && (
            <button
              className="btn-danger"
              disabled={finish.isPending}
              onClick={() => {
                if (confirm('Завершить лекцию?')) finish.mutate();
              }}
            >
              Завершить лекцию
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
