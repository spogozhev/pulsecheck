import logoUrl from '../assets/pulsecheck-logo.svg';

/**
 * Логотип PulseCheck — фирменный файл (линия ЭКГ + слово-логотип и подпись).
 * Иконка favicon задаётся отдельно в index.html и не меняется.
 */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass =
    size === 'lg' ? 'h-14 w-auto' : size === 'sm' ? 'w-auto' : 'h-24 w-auto';
  return (
    <img
      src={logoUrl}
      alt="PulseCheck"
      className={sizeClass}
      draggable={false}
    />
  );
}
