import type { KeyboardEvent } from 'react';

/** Keyboard navigation for the existing destination search input and option buttons. */
export function handleSearchOptionKeys(event: KeyboardEvent<HTMLDivElement>, onEscape: () => void) {
  if (!(event.target instanceof HTMLInputElement) &&
      !(event.target instanceof HTMLButtonElement && event.target.getAttribute('role') === 'option')) return;
  if (event.key === 'Escape') {
    onEscape();
    event.currentTarget.querySelector('input')?.focus();
    return;
  }
  if (event.key === 'Enter' && event.target instanceof HTMLButtonElement && event.target.getAttribute('role') === 'option') {
    event.preventDefault();
    event.target.click();
    return;
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
  if (options.length === 0) return;
  event.preventDefault();
  const current = options.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === 'ArrowDown'
    ? Math.min(current + 1, options.length - 1)
    : current < 0 ? options.length - 1 : Math.max(current - 1, 0);
  options[next]?.focus();
}
