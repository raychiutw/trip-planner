/**
 * CollabModal — TripsListPage 卡片 ⋯ 「共編」 直接 inline modal 開 CollabSheet。
 *
 * PR-AA 2026-04-26：原本 ⋯ 共編 navigate 到 /trips?selected=X&sheet=collab
 * 開整個 trip 詳情頁。User 指示「不要開啟行程頁」，改 inline modal 直接管共編。
 *
 * 走 createPortal to body，escape AppShell stacking context（同 NewTripModal
 * pattern）。z-index 走 --z-modal token (9000)。
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import CollabSheet from './CollabSheet';

const SCOPED_STYLES = `
.tp-collab-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(42, 31, 24, 0.55);
  z-index: var(--z-modal, 9000);
  display: grid; place-items: center;
  padding: 16px;
  animation: tp-collab-modal-fade 160ms var(--transition-timing-function-apple, ease-out);
}
@keyframes tp-collab-modal-fade { from { opacity: 0; } to { opacity: 1; } }

.tp-collab-modal {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 520px;
  max-height: calc(100dvh - 32px);
  display: flex; flex-direction: column;
  overflow: hidden;
  position: relative;
}
.tp-collab-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.tp-collab-modal-header h2 {
  font-size: var(--font-size-headline); font-weight: 800;
  letter-spacing: -0.01em;
  margin: 0;
  color: var(--color-foreground);
}
.tp-collab-modal-close {
  width: 36px; height: 36px;
  border-radius: var(--radius-full);
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  display: grid; place-items: center;
  cursor: pointer;
  font-size: 16px; color: var(--color-muted);
}
.tp-collab-modal-close:hover {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
}
.tp-collab-modal-close:focus-visible {
  outline: 2px solid var(--color-accent); outline-offset: 2px;
}
.tp-collab-modal-body {
  flex: 1; min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
`;

export interface CollabModalProps {
  tripId: string;
  onClose: () => void;
}

export default function CollabModal({ tripId, onClose }: CollabModalProps) {
  // Escape key dismiss
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return createPortal((
    <div
      className="tp-collab-modal-backdrop"
      onMouseDown={handleBackdrop}
      role="presentation"
      data-testid="collab-modal"
    >
      <style>{SCOPED_STYLES}</style>
      <div
        className="tp-collab-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collab-modal-title"
      >
        <header className="tp-collab-modal-header">
          <h2 id="collab-modal-title">共編設定</h2>
          <button
            type="button"
            className="tp-collab-modal-close"
            onClick={onClose}
            aria-label="關閉"
            data-testid="collab-modal-close"
          >
            ✕
          </button>
        </header>
        <div className="tp-collab-modal-body">
          <CollabSheet tripId={tripId} />
        </div>
      </div>
    </div>
  ), document.body);
}
