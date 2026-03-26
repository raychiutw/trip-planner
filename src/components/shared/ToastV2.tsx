import '../../../css/tokens.css';

interface ToastProps {
  message: string;
  icon: 'offline' | 'online';
  visible: boolean;
}

const ICON_COLOR = {
  offline: 'text-warning',
  online: 'text-success',
} as const;

/**
 * iOS-style floating Toast notification (V2 — Tailwind inline).
 * Slides in from top when visible=true, slides out when false.
 * Frosted glass background, 16px rounded corners.
 */
export default function ToastV2({ message, icon, visible }: ToastProps) {
  return (
    <div
      className={[
        'fixed left-1/2 -translate-x-1/2 flex items-center pointer-events-none',
        'gap-[var(--spacing-2)] px-[var(--spacing-5)] py-[var(--spacing-3)]',
        'rounded-lg',
        'bg-[color-mix(in_srgb,var(--color-secondary)_85%,transparent)]',
        'backdrop-blur-[20px] [-webkit-backdrop-filter:blur(20px)]',
        'shadow-[var(--shadow-lg),0_0_0_1px_color-mix(in_srgb,var(--color-border)_60%,transparent)]',
        'text-subheadline font-semibold whitespace-nowrap',
        'text-foreground',
        'top-[calc(var(--spacing-nav-h)+var(--spacing-3))]',
        'z-[calc(var(--z-sticky-nav)+50)]',
        visible
          ? 'animate-[toast-slide-down_var(--transition-duration-slow)_var(--transition-timing-function-apple)_forwards]'
          : 'animate-[toast-slide-up_var(--transition-duration-normal)_ease_forwards] opacity-0',
      ].join(' ')}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={`flex items-center shrink-0 ${ICON_COLOR[icon]}`} aria-hidden="true">
        {icon === 'offline' ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 7.5a10 10 0 0 1 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M5.5 10.5a6.5 6.5 0 0 1 9 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M8 13.5a3 3 0 0 1 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="10" cy="16" r="1.2" fill="currentColor"/>
            <line x1="2" y1="18" x2="18" y2="2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M6.5 10.5 L9 13 L14 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <span>{message}</span>
    </div>
  );
}
