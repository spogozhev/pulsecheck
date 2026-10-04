import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { PollResults, VotePayload, VoteResultsResponse } from '../api/types';
import { ResultsView } from '../components/ResultsView';
import { Logo } from '../components/Logo';

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

export function VotePage() {
  const { code, slide: slideParam } = useParams<{ code: string; slide: string }>();
  const slideIndex = Number(slideParam);
  const headers = useMemo(() => ({ 'X-Anon-Id': anonId() }), []);

  const payloadQ = useQuery({
    queryKey: ['vote', code, slideIndex],
    queryFn: () => api.get<VotePayload>(`/api/vote/${code}/${slideIndex}`, headers),
    refetchInterval: (q) => (q.state.data?.open ? 5000 : false),
    retry: false,
  });

  const resultsQ = useQuery({
    queryKey: ['voteResults', code, slideIndex],
    queryFn: () => api.get<VoteResultsResponse>(`/api/vote/${code}/${slideIndex}/results`, headers),
    enabled: !!payloadQ.data && !payloadQ.data.open && !!payloadQ.data.question,
    refetchInterval: (q) => (q.state.data && !q.state.data.closed ? 3000 : false),
    retry: false,
  });

  const payload = payloadQ.data;
  const question = payload?.question ?? null;

  // выбор пользователя
  const [selected, setSelected] = useState<string[]>([]);
  const [ranking, setRanking] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const questionId = question?.id ?? null;
  useEffect(() => {
    // сброс формы при смене вопроса и восстановление ранее отправленного ответа
    setSubmitted(false);
    if (payload?.yourAnswer) {
      setSelected(payload.yourAnswer.selectedOptionIds ?? []);
      setRanking(payload.yourAnswer.rankingOrder ?? []);
    } else {
      setSelected([]);
      setRanking([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  const submit = useMutation({
    mutationFn: (body: { selectedOptionIds?: string[]; rankingOrder?: string[] }) =>
      api.post(`/api/vote/${code}/${slideIndex}/answer`, body, headers),
    onSuccess: () => setSubmitted(true),
  });

  const canSubmit = (() => {
    if (!question) return false;
    if (question.type === 'ranking')
      return question.required ? ranking.length === question.options.length : true;
    return question.required ? selected.length > 0 : true;
  })();

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
  if (payloadQ.isLoading) {
    return <Shell><div className="text-slate-400">Загрузка…</div></Shell>;
  }
  if (payloadQ.isError) {
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
  if (!question) {
    return (
      <Shell>
        <div className="py-8 text-center text-slate-500">На этом слайде нет вопроса для голосования</div>
      </Shell>
    );
  }

  const results: PollResults | undefined = resultsQ.data?.results;

  // Голосование закрыто — показываем финальные итоги (решение заказчика)
  if (!payloadQ.data!.open && resultsQ.data?.closed && results) {
    return (
      <Shell lectureTitle={payload!.lectureTitle}>
        <h1 className="mb-1 text-xl font-bold leading-snug text-slate-900">{question.questionText}</h1>
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-emerald-600">
          Голосование завершено · итоги
        </div>
        <ResultsView results={results} />
        <div className="mt-6 text-center text-sm text-slate-400">
          {submitted || payload?.yourAnswer ? 'Спасибо за участие!' : 'Спасибо за внимание!'}
        </div>
      </Shell>
    );
  }

  // Ответ отправлен, ждём закрытия голосования
  if (submitted || (payload?.yourAnswer && payloadQ.data!.open)) {
    return (
      <Shell lectureTitle={payload!.lectureTitle}>
        <div className="py-10 text-center">
          <div className="mb-3 text-5xl">✅</div>
          <div className="text-lg font-semibold text-slate-800">Ответ сохранён</div>
          <div className="mx-auto mt-2 max-w-xs text-sm text-slate-400">
            Можно изменить ответ, пока преподаватель на этом слайде. Итоги появятся после перехода к
            следующему слайду.
          </div>
          <button className="btn-secondary mt-5" onClick={() => setSubmitted(false)}>
            Изменить ответ
          </button>
        </div>
      </Shell>
    );
  }

  // Вопрос ещё не активен
  if (!payloadQ.data!.open) {
    return (
      <Shell lectureTitle={payload!.lectureTitle}>
        <div className="py-10 text-center">
          <div className="mb-3 text-4xl">⏳</div>
          <div className="font-medium text-slate-700">Вопрос сейчас не активен</div>
          <div className="mt-1 text-sm text-slate-400">
            Ожидайте, когда преподаватель перейдёт к этому слайду
          </div>
        </div>
      </Shell>
    );
  }

  // Активная форма голосования
  return (
    <Shell lectureTitle={payload!.lectureTitle}>
      <h1 className="mb-1 text-xl font-bold leading-snug text-slate-900">{question.questionText}</h1>
      <div className="mb-4 text-sm text-slate-500">
        {TYPE_LABEL[question.type]}
        {!question.required && ' · можно пропустить'}
      </div>

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
              <span className="flex-1">{o.text}</span>
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
          {(submit.error as Error).message}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          className="btn-primary flex-1 py-3 text-base"
          disabled={!canSubmit || submit.isPending}
          onClick={() =>
            submit.mutate({
              selectedOptionIds: question.type === 'ranking' ? [] : selected,
              rankingOrder: question.type === 'ranking' ? ranking : [],
            })
          }
        >
          {submit.isPending ? 'Отправка…' : 'Отправить ответ'}
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

function Shell({ children, lectureTitle }: { children: React.ReactNode; lectureTitle?: string }) {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
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
