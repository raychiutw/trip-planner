import React from 'react';

interface PageNavProps {
  /** If provided, renders a × close button on the right. Omit for standalone pages (e.g. AdminPage). */
  onClose?: () => void;
  /** Center content: title string or arbitrary React node (e.g. dropdown) */
  center?: React.ReactNode;
}

/**
 * Shared sticky glassmorphism nav bar used by ManagePage and AdminPage.
 * Renders optional center content and an optional close X button on the right.
 * Pass `onClose` only when the page is used as a modal-like overlay (e.g. ManagePage).
 * Omit `onClose` for standalone pages (e.g. AdminPage) to avoid modal/page confusion.
 */
export default function PageNav({ onClose, center }: PageNavProps) {
  return (
    <div
      className="sticky top-0 z-(--z-sticky-nav) border-b border-border bg-(--color-glass-nav) backdrop-blur-xl backdrop-saturate-200 text-foreground py-2 px-padding-h flex items-center gap-2"
      id="stickyNav"
    >
      {center && (
        <div className="absolute left-1/2 -translate-x-1/2">
          {center}
        </div>
      )}
      {onClose && (
        <button
          className="flex items-center justify-center w-tap-min h-tap-min p-0 border-none rounded-full bg-transparent text-foreground shrink-0 transition-colors duration-fast hover:text-accent hover:bg-accent-bg focus-visible:outline-none ml-auto"
          id="navCloseBtn"
          aria-label="關閉"
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      )}
    </div>
  );
}
