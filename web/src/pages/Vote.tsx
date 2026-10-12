import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { VotePayload, VoteResultsResponse } from '../api/types';
import { ResultsView } from '../components/ResultsView';
import { Logo } from '../components/Logo';
import { MathText } from '../components/MathText';
import { Countdown } from '../components/Countdown';

function anonId(): string {
  let v = localStorage.getItem('anon_id');
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem('anon_id', v);
  }
  return v;
}

const TYPE_LABEL: Record<string, string> = {
  single: 'Выберите один вариант',
  multiple: 'Можно выбрать несколько вариантов',
  ranking: 'Расставьте варианты по порядку: нажимайте от лучшего к худшему',
};

interface SessionState {
  lectureTitle: string;
  active: boolean;
  slideIndex: number;
  hasPoll: boolean;
  /** Активный вопрос открыт (лекция идёт, слайд текущий, время не истекло) */
  questionOpen: boolean;
  /** true — преподаватель показал итоги предыдущего вопроса (или истёк таймаут 10 с) */
  revealed: boolean;
}

/**
 * Страница студента: один QR-код на всю лекцию. Страница следит за сессией и сама
 * открывает активный вопрос, показывает итоги закрытого и переключается на следующий.
 */
export function VotePage() {
  const { code } = useParams<{ code: string }>();
  const headers = useMemo(() => ({ 'X-Anon-Id': anonId() }), []);

  // Состояние сессии: какой вопрос сейчас активен у преподавателя
  const sessionQ = useQuery({
    queryKey: ['voteSession', code],
    queryFn: () => api.get<SessionState>(`/api/vote/${code}`, headers),
    refetchInterval: 2000,
    retry: false,
  });
  const session = sessionQ.data;

  // Какой вопрос сейчас показываем
  const [viewSlide, setViewSlide] = useState<number | null>(null);
  const [resultsMode, setResultsMode] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!session) return;
    if (session.active && session.hasPoll && session.slideIndex === viewSlide) {
      // тот же вопрос
      if (resultsMode && session.revealed && session.questionOpen) {
        // открыли заново — разрешаем (пере)ответить
        setResultsMode(false);
        setSubmitted(false);
      } else if (!resultsMode && !session.questionOpen) {
        // время вышло / вопрос закрыт — показываем итоги
        setResultsMode(true);
        setSubmitted(false);
      }
    } else if (session.active && session.hasPoll && session.slideIndex !== viewSlide) {
      // Вопрос закрыт, активен другой слайд. При движении вперёд студент сначала видит итоги
      // своего последнего вопроса, а новый вопрос открывается, когда преподаватель показал
      // его на экране (кнопка «Продолжить показ»; без нажатия — автоматически через 10 секунд).
      // При возврате назад итогов между вопросами нет — форма открывается сразу.
      const forward = session.slideIndex > (viewSlide ?? -1);
      const hadResults = viewSlide !== null && forward;
      if (hadResults) {
        setResultsMode(true);
        setSubmitted(false);
        if (session.revealed) {
          setViewSlide(session.slideIndex);
          setResultsMode(false);
          setSubmitted(false);
        }
      } else {
        setViewSlide(session.slideIndex);
        setResultsMode(false);
        setSubmitted(false);
      }
    } else if (session.active && session.hasPoll && resultsMode && session.revealed) {
      // тот же вопрос открыли заново — разрешаем (пере)ответить
      setResultsMode(false);
      setSubmitted(false);
    } else if (viewSlide !== null && !(session.active && session.hasPoll)) {
      // слайд без опроса или лекция завершена — итоги последнего вопроса
      setResultsMode(true);
      setSubmitted(false);
    }
  }, [session, viewSlide, resultsMode]);

  const payloadQ = useQuery({
    queryKey: ['votePayload', code, viewSlide],
    queryFn: () => api.get<VotePayload>(`/api/vote/${code}/${viewSlide}`, headers),
    enabled: viewSlide !== null && !resultsMode && !!session?.active,
    refetchInterval: (q) => (q.state.error ? 3000 : q.state.data?.open ? 4000 : false),
    retry: false,
  });

  const resultsQ = useQuery({
    queryKey: ['voteResults', code, viewSlide],
    queryFn: () => api.get<VoteResultsResponse>(`/api/vote/${code}/${viewSlide}/results`, headers),
    enabled: viewSlide !== null && resultsMode,
    refetchInterval: (q) =>
      q.state.error ? 3000 : q.state.data && !q.state.data.closed ? 2000 : false,
    retry: false,
  });

  const question = payloadQ.data?.question ?? null;
  const questionId = question?.id ?? null;

  // выбор пользователя — сбрасывается при смене вопроса, восстанавливая ранее отправленный ответ
  const [selected, setSelected] = useState<string[]>([]);
  const [ranking, setRanking] = useState<string[]>([]);

  useEffect(() => {
    if (payloadQ.data?.yourAnswer) {
      setSelected(payloadQ.data.yourAnswer.selectedOptionIds ?? []);
      setRanking(payloadQ.data.yourAnswer.rankingOrder ?? []);
    } else {
      setSelected([]);
      setRanking([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  const submit = useMutation({
    mutationFn: (body: { selectedOptionIds?: string[]; rankingOrder?: string[] }) =>
      api.post(`/api/vote/${code}/${viewSlide}/answer`, body, headers),
    onSuccess: () => setSubmitted(true),
  });

  const toggle = (id: string) => {
    if (question?.type === 'single') {
      setSelected([id]);
    } else {
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
  };

  const rankingToggle = (id: string) => {
    setRanking((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // --- Состояния страницы ---
  // «Не найдено» — только настоящий 404 сервера. Временные сбои (429/5xx/сеть) не убивают
  // страницу: опрос состояния продолжается, при уже загруженных данных показываем их
  // с плашкой «переподключаемся» (аудитория за одним Wi-Fi упирается в rate-limit).
  const sessionNotFound = sessionQ.error instanceof ApiError && sessionQ.error.status === 404;

  if (sessionNotFound) {
    return (
      <Shell>
        <div className="py-8 text-center">
          <div className="mb-2 text-5xl">🤷</div>
          <div className="font-medium text-slate-700">Голосование не найдено</div>
          <div className="mt-1 text-sm text-slate-400">
            Проверьте ссылку по QR-коду или спросите преподавателя
          </div>
        </div>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell>
        <div className="py-8 text-center">
          <div className="mb-3 flex justify-center">
            <span className="flex h-4 w-4 animate-ping rounded-full bg-sky-500 opacity-75" />
          </div>
          <div className="font-medium text-slate-700">Подключаемся…</div>
          <div className="mt-1 text-sm text-slate-400">
            Если не получается долго — проверьте интернет и откройте ссылку заново
          </div>
        </div>
      </Shell>
    );
  }

  // Итоги закрытого вопроса
  if (resultsMode && viewSlide !== null) {
    if (!resultsQ.data?.closed || !resultsQ.data.results) {
      return (
        <Shell lectureTitle={session.lectureTitle} offline={sessionQ.isError}>
          <div className="py-10 text-center text-slate-400">
            <div className="mb-3 text-4xl">⏳</div>
            Вопрос закрыт, загружаем итоги…
          </div>
        </Shell>
      );
    }
    const results = resultsQ.data.results;
    return (
      <Shell lectureTitle={session.lectureTitle} offline={sessionQ.isError}>
        <h1 className="mb-1 text-xl font-bold leading-snug text-slate-900">
          <MathText text={results.questionText} />
        </h1>
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-emerald-600">
          Голосование завершено · итоги
        </div>
        <ResultsView results={results} />
        <div className="mt-6 text-center text-sm text-slate-400">
          {submitted || payloadQ.data?.yourAnswer ? 'Спасибо за участие!' : 'Спасибо за внимание!'}
          {session!.active && (
            <div className="mt-1">Следующий вопрос откроется, когда преподаватель продолжит показ.</div>
          )}
        </div>
      </Shell>
    );
  }

  // Активного вопроса нет — ожидание либо завершённая лекция
  if (viewSlide === null || !session.active) {
    return (
      <Shell lectureTitle={session.lectureTitle} offline={sessionQ.isError}>
        <div className="py-10 text-center">
          {session!.active ? (
            <>
              <div className="mb-4 flex justify-center">
                <span className="flex h-4 w-4 animate-ping rounded-full bg-sky-500 opacity-75" />
              </div>
              <div className="text-lg font-semibold text-slate-800">Ждём вопрос…</div>
              <div className="mx-auto mt-2 max-w-xs text-sm text-slate-400">
                Страница открыта: как только преподаватель запустит голосование, вопрос появится
                здесь автоматически. Обновлять ничего не нужно.
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 text-4xl">🏁</div>
              <div className="font-medium text-slate-700">Лекция завершена</div>
              <div className="mt-1 text-sm text-slate-400">Спасибо за участие!</div>
            </>
          )}
        </div>
      </Shell>
    );
  }

  if (payloadQ.isLoading || !payloadQ.data) {
    return (
      <Shell lectureTitle={session.lectureTitle}>
        <div className="text-slate-400">Загрузка вопроса…</div>
      </Shell>
    );
  }

  const payload = payloadQ.data;

  /** Время на ответ истекло (для опросов с ограничением) */
  const timeExpired =
    question != null && question.timeLimitSeconds != null && (question.secondsLeft ?? 1) <= 0;

  const canSubmit = (() => {
    if (!question || timeExpired) return false;
    if (question.type === 'ranking')
      return question.required ? ranking.length === question.options.length : true;
    return question.required ? selected.length > 0 : true;
  })();

  if (!question) {
    return (
      <Shell lectureTitle={session.lectureTitle}>
        <div className="py-8 text-center text-slate-500">На этом слайде нет вопроса</div>
      </Shell>
    );
  }

  // Ответ уже отправлен — подтверждение, пока вопрос открыт
  if (submitted || (payload.yourAnswer && payload.open)) {
    return (
      <Shell lectureTitle={session.lectureTitle} offline={sessionQ.isError}>
        <div className="py-10 text-center">
          <div className="mb-3 text-5xl">✅</div>
          <div className="text-lg font-semibold text-slate-800">Ответ сохранён</div>
          <div className="mx-auto mt-2 max-w-xs text-sm text-slate-400">
            Можно изменить ответ, пока вопрос открыт. Итоги появятся, когда преподаватель перейдёт
            к следующему слайду, а новый вопрос откроется здесь сам.
          </div>
          <button className="btn-secondary mt-5" onClick={() => setSubmitted(false)}>
            Изменить ответ
          </button>
        </div>
      </Shell>
    );
  }

  if (!payload.open) {
    return (
      <Shell lectureTitle={session.lectureTitle} offline={sessionQ.isError}>
        <div className="py-10 text-center">
          <div className="mb-3 text-4xl">⏳</div>
          <div className="font-medium text-slate-700">Вопрос сейчас не активен</div>
          <div className="mt-1 text-sm text-slate-400">
            Дождитесь следующего вопроса — он откроется автоматически
          </div>
        </div>
      </Shell>
    );
  }

  // Форма активного вопроса
  return (
    <Shell lectureTitle={session.lectureTitle} offline={sessionQ.isError}>
      <h1 className="mb-1 text-xl font-bold leading-snug text-slate-900">
        <MathText text={question.questionText} />
      </h1>
      <div className="mb-4 text-sm text-slate-500">
        {TYPE_LABEL[question.type]}
        {!question.required && ' · можно пропустить'}
      </div>

      {question.timeLimitSeconds != null && question.secondsLeft != null && (
        <div className="mb-4 flex justify-center">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-5 py-1 text-xl font-bold text-slate-800">
            <Countdown secondsLeft={question.secondsLeft} />
          </span>
        </div>
      )}

      <div className="space-y-2">
        {question.options.map((o) => {
          const rank = ranking.indexOf(o.id) + 1;
          const chosen = selected.includes(o.id);
          const active = question.type === 'ranking' ? rank > 0 : chosen;
          return (
            <button
              key={o.id}
              onClick={() => (question.type === 'ranking' ? rankingToggle(o.id) : toggle(o.id))}
              className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base font-medium transition-colors ${
                active
                  ? 'border-sky-500 bg-sky-50 text-sky-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {question.type === 'ranking' ? (
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    rank > 0 ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {rank > 0 ? rank : ''}
                </span>
              ) : (
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-${
                    question.type === 'single' ? 'full' : 'md'
                  } border-2 ${
                    active ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300'
                  }`}
                >
                  {active && <span className="text-xs">✓</span>}
                </span>
              )}
              <span className="flex-1">
                <MathText text={o.text} />
              </span>
            </button>
          );
        })}
      </div>

      {question.type === 'ranking' && ranking.length > 0 && (
        <button className="mt-2 text-sm text-sky-600 hover:underline" onClick={() => setRanking([])}>
          Сбросить порядок
        </button>
      )}

      {submit.isError && (
        <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {submit.error instanceof ApiError && submit.error.status === 429
            ? 'Слишком много запросов — попробуйте ещё раз через несколько секунд'
            : (submit.error as Error).message}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          className="btn-primary flex-1 py-3 text-base"
          disabled={!canSubmit || submit.isPending}
          title={timeExpired ? 'Время на ответ истекло' : undefined}
          onClick={() =>
            submit.mutate({
              selectedOptionIds: question.type === 'ranking' ? [] : selected,
              rankingOrder: question.type === 'ranking' ? ranking : [],
            })
          }
        >
          {timeExpired ? 'Время вышло' : submit.isPending ? 'Отправка…' : 'Отправить ответ'}
        </button>
        {!question.required && (
          <button
            className="btn-secondary py-3"
            disabled={submit.isPending}
            onClick={() => submit.mutate({ selectedOptionIds: [], rankingOrder: [] })}
          >
            Пропустить
          </button>
        )}
      </div>
    </Shell>
  );
}

function Shell({
  children,
  lectureTitle,
  offline,
}: {
  children: React.ReactNode;
  lectureTitle?: string;
  /** Временная потеря связи с сервером: показываем последний контент и плашку ретрая */
  offline?: boolean;
}) {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      {offline && (
        <div className="fixed left-1/2 top-2 z-50 -translate-x-1/2 rounded-full bg-amber-100 px-4 py-1 text-xs font-medium text-amber-800 shadow">
          Нет связи с сервером — переподключаемся…
        </div>
      )}
      <div className="mx-auto max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <Logo />
          <div className="max-w-56 truncate text-xs text-slate-400">{lectureTitle ?? ''}</div>
        </div>
        <div className="card p-5">{children}</div>
      </div>
    </div>
  );
}
