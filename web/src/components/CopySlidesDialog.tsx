import { useState } from 'react';
import type { Presentation } from '../api/types';

/** Диалог копирования выбранных слайдов в другую презентацию. */
export function CopySlidesDialog({
  count,
  presentations,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  count: number;
  presentations: Presentation[];
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (targetPresentationId: string, insertAfterIndex: number | null) => void;
}) {
  const [targetId, setTargetId] = useState('');
  const [position, setPosition] = useState<'end' | 'after'>('end');
  const target = presentations.find((p) => p.id === targetId);
  const [afterIndex, setAfterIndex] = useState<number>(0);

  const ready = presentations.filter((p) => p.status === 'ready' || p.slideCount > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="card w-full max-w-md p-5">
        <h3 className="mb-4 text-lg font-semibold text-slate-800">
          Копировать слайды ({count} шт.)
        </h3>
        <div className="space-y-4">
          <div>
            <label className="label">Куда (презентация)</label>
            <select className="input" value={targetId} onChange={(e) => {
              setTargetId(e.target.value);
              const t = presentations.find((p) => p.id === e.target.value);
              setAfterIndex((t?.slideCount ?? 1) - 1);
            }}>
              <option value="">— выберите —</option>
              {ready.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p._count?.slides ?? p.slideCount} слайдов)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Куда вставить</label>
            <div className="flex gap-4 text-sm text-slate-700">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  className="accent-sky-600"
                  checked={position === 'end'}
                  onChange={() => setPosition('end')}
                />
                В конец
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  className="accent-sky-600"
                  checked={position === 'after'}
                  disabled={!target}
                  onChange={() => setPosition('after')}
                />
                После слайда №
              </label>
              {position === 'after' && target && (
                <select
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                  value={afterIndex}
                  onChange={(e) => setAfterIndex(Number(e.target.value))}
                >
                  {Array.from({ length: target.slideCount }, (_, i) => (
                    <option key={i} value={i}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={onCancel} disabled={busy}>
              Отмена
            </button>
            <button
              className="btn-primary"
              disabled={!targetId || busy}
              onClick={() => onConfirm(targetId, position === 'end' ? null : afterIndex)}
            >
              {busy ? 'Копирование…' : 'Копировать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
