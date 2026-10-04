/**
 * Логотип PulseCheck: линия кардиограммы — ровная, в месте вопроса резкий «зубец»,
 * который превращается в галочку (ответ получен).
 */
export function Logo({ light = false, size = 'md' }: { light?: boolean; size?: 'md' | 'lg' }) {
  const textSize = size === 'lg' ? 'text-2xl' : 'text-xl';
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`${textSize} font-bold ${light ? 'text-white' : 'text-slate-800'}`}>
        Pulse<span className="text-sky-600">Check</span>
      </span>
      <svg
        viewBox="0 0 92 32"
        className={size === 'lg' ? 'h-8 w-auto' : 'h-7 w-auto'}
        aria-hidden="true"
      >
        <path
          d="M2 18 H26 L32 18 L38 6 L45 29 L52 12 L57 18 H68 L76 25 L88 7"
          fill="none"
          stroke="#0284c7"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
