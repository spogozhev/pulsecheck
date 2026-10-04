import { useEffect, useState } from 'react';
import type { Poll, PollType, Slide } from '../api/types';

export interface PollDraft {
  questionText: string;
  type: PollType;
  required: boolean;
  timeLimitSeconds: number | null;
  options: { text: string }[];
}

/** Слайд этой же презентации, с которого можно скопировать опрос. */
export interface PollCopySource {
  id: string;
  index: number;
  questionText: string;
}

const TYPE_LABELS: Record<PollType, string> = {
  single: 'Один вариант',
  multiple: 'Несколько вариантов',
  ranking: 'Ранжирование',
};

/** Форма создания/редактирования опроса на слайде. */
export function PollBuilder({
  slide,
  saving,
  error,
  disabled = false,
  copySources = [],
  copying = false,
  onCopyFrom,
  onSave,
  onRemove,
}: {
  slide: Slide;
  saving: boolean;
  error: string | null;
  disabled?: boolean;
  copySources?: PollCopySource[];
  copying?: boolean;
  onCopyFrom?: (fromSlideId: string) => void;
  onSave: (draft: PollDraft) => void;
  onRemove: () => void;
}) {
  const [questionText, setQuestionText] = useState('');
  const [type, setType] = useState<PollType>('single');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [copyFromId, setCopyFromId] = useState<string | null>(null);
  const [timeLimit, setTimeLimit] = useState('');

  useEffect(() => {
    const poll: Poll | null = slide.poll;
    if (poll) {
      setQuestionText(poll.questionText);
      setType(poll.type);
      setOptions([...poll.options].sort((a, b) => a.position - b.position).map((o) => o.text));
      setTimeLimit(poll.timeLimitSeconds != null ? String(poll.timeLimitSeconds) : '');
    } else {
      setQuestionText('');
      setType('single');
      setOptions(['', '']);
      setTimeLimit('');
    }
  }, [slide.id, slide.poll]);

  const setOption = (i: number, value: string) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= options.length) return;
    setOptions((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const timeLimitNum = timeLimit.trim() === '' ? null : Number(timeLimit);
  const timeLimitValid =
    timeLimitNum === null || (Number.isInteger(timeLimitNum) && timeLimitNum >= 5 && timeLimitNum <= 3600);

  const valid =
    questionText.trim().length >= 3 &&
    options.filter((o) => o.trim()).length >= 2 &&
    options.every((o) => o.trim() === '' || o.trim().length > 0) &&
    timeLimitValid;

  return (
    <div className="space-y-4">
      {!slide.poll && copySources.length > 0 && (
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="mb-1.5 text-xs font-medium text-slate-500">
            Скопировать опрос с другого слайда этой презентации:
          </div>
          <div className="flex gap-2">
            <select
              className="input flex-1 py-1.5 text-sm"
              defaultValue=""
              onChange={(e) => setCopyFromId(e.target.value || null)}
            >
              <option value="">— выберите слайд —</option>
              {copySources.map((s) => (
                <option key={s.id} value={s.id}>
                  №{s.index + 1} — {s.questionText}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary shrink-0 py-1.5 text-sm"
              disabled={!copyFromId || copying || disabled}
              onClick={() => copyFromId && onCopyFrom?.(copyFromId)}
            >
              {copying ? 'Копирование…' : 'Скопировать'}
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="label">Вопрос</label>
        <input
          className="input"
          value={questionText}
          maxLength={600}
          placeholder="Например: Какой язык вы используете чаще всего?"
          onChange={(e) => setQuestionText(e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-400">
          Формулы заключайте в знаки доллара, например:{' '}
          <code className="rounded bg-slate-100 px-1">$x^2-2x+1=0$</code>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Тип опроса</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as PollType)}>
            {(Object.keys(TYPE_LABELS) as PollType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ограничение времени (секунды)</label>
          <input
            className="input"
            inputMode="numeric"
            value={timeLimit}
            maxLength={4}
            placeholder="Без ограничения"
            onChange={(e) => setTimeLimit(e.target.value.replace(/[^0-9]/g, ''))}
          />
          {timeLimitValid ? (
            <div className="mt-1 text-xs text-slate-400">
              Пусто — без ограничения
            </div>
          ) : (
            <div className="mt-1 text-xs text-rose-600">От 5 до 3600 секунд</div>
          )}
        </div>
      </div>

      <div>
        <label className="label">
          Варианты ответа{' '}
          <span className="font-normal text-slate-400">
            {type === 'ranking' ? '(порядок — как на слайде)' : ''}
          </span>
        </label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 text-center text-xs text-slate-400">{i + 1}</span>
              <input
                className="input"
                value={opt}
                maxLength={300}
                placeholder={`Вариант ${i + 1}`}
                onChange={(e) => setOption(i, e.target.value)}
              />
              <button
                type="button"
                className="rounded px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                title="Выше"
              >
                ↑
              </button>
              <button
                type="button"
                className="rounded px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                disabled={i === options.length - 1}
                onClick={() => move(i, 1)}
                title="Ниже"
              >
                ↓
              </button>
              <button
                type="button"
                className="rounded px-1 text-rose-400 hover:text-rose-600 disabled:opacity-30"
                disabled={options.length <= 2}
                onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                title="Удалить"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {options.length < 10 && (
          <button
            type="button"
            className="btn-secondary mt-2"
            onClick={() => setOptions((prev) => [...prev, ''])}
          >
            + Добавить вариант
          </button>
        )}
      </div>

      {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {disabled && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Аккаунт не подтверждён администратором — сохранение недоступно.
        </div>
      )}

      <div className="flex gap-2">
        <button
          className="btn-primary"
          disabled={!valid || saving || disabled}
          onClick={() =>
            onSave({
              questionText: questionText.trim(),
              type,
              required: true,
              timeLimitSeconds: timeLimitNum,
              options: options.filter((o) => o.trim()).map((o) => ({ text: o.trim() })),
            })
          }
        >
          {saving ? 'Сохранение…' : slide.poll ? 'Обновить опрос' : 'Создать опрос'}
        </button>
        {slide.poll && (
          <button className="btn-danger" disabled={saving || disabled} onClick={onRemove}>
            Убрать опрос
          </button>
        )}
      </div>
    </div>
  );
}
