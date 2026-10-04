import { useEffect, useState } from 'react';

/** Обратный отсчёт: тикает локально каждую секунду, синхронизируется при изменении secondsLeft. */
export function Countdown({
  secondsLeft,
  className,
  warnBelow = 10,
}: {
  secondsLeft: number;
  className?: string;
  warnBelow?: number;
}) {
  const [left, setLeft] = useState(secondsLeft);

  useEffect(() => setLeft(secondsLeft), [secondsLeft]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const m = Math.floor(Math.max(0, left) / 60);
  const s = Math.max(0, left) % 60;
  const urgent = left <= warnBelow;

  return (
    <span className={`${className ?? ''} ${urgent ? 'text-rose-400' : ''} tabular-nums`}>
      ⏱ {m}:{String(s).padStart(2, '0')}
    </span>
  );
}
