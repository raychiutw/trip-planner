/**
 * NewTripModal — minimal form modal for creating a blank trip.
 *
 * Posts to POST /api/trips, which requires { id, name, owner, startDate, endDate }.
 * tripId is auto-generated from the name (slug + 4-char base36 timestamp suffix)
 * because the user-facing flow on /trips landing should not surface a raw ID
 * field. Trip is created with `published: 1` so it shows up on the list right
 * away; the empty trip_days are scaffolded server-side from the date range.
 *
 * On success → onCreated(tripId) — host page swaps the selection.
 */
import { useEffect, useState } from 'react';

const SCOPED_STYLES = `
.tp-new-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: var(--z-modal, 60);
  display: grid; place-items: center;
  padding: 16px;
  animation: tp-new-modal-fade 160ms var(--transition-timing-function-apple);
}
@keyframes tp-new-modal-fade { from { opacity: 0; } to { opacity: 1; } }
.tp-new-modal {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 24px;
  width: 100%; max-width: 420px;
  font: inherit;
}
.tp-new-modal h2 {
  font-size: var(--font-size-title2);
  font-weight: 800;
  letter-spacing: -0.01em;
  margin: 0 0 6px;
}
.tp-new-modal-sub {
  color: var(--color-muted);
  font-size: var(--font-size-callout);
  margin: 0 0 20px;
  line-height: 1.5;
}
.tp-new-form-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.tp-new-form-row label {
  font-size: var(--font-size-footnote);
  font-weight: 600;
  color: var(--color-muted);
  letter-spacing: 0.04em;
}
.tp-new-form-row input {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font: inherit;
  font-size: var(--font-size-callout);
  min-height: var(--spacing-tap-min);
}
.tp-new-form-row input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-subtle);
}
.tp-new-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.tp-new-modal-error {
  color: var(--color-destructive);
  font-size: var(--font-size-footnote);
  margin: 4px 0 0;
}
.tp-new-modal-actions {
  display: flex; gap: 8px; justify-content: flex-end;
  margin-top: 16px;
}
.tp-new-modal-btn {
  padding: 10px 20px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-foreground);
  font: inherit; font-weight: 600;
  font-size: var(--font-size-callout);
  cursor: pointer;
  min-height: var(--spacing-tap-min);
  transition: filter 120ms;
}
.tp-new-modal-btn:hover:not(:disabled) { background: var(--color-hover); }
.tp-new-modal-btn-primary {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  border-color: var(--color-accent);
}
.tp-new-modal-btn-primary:hover:not(:disabled) { filter: brightness(var(--hover-brightness)); }
.tp-new-modal-btn:disabled { opacity: 0.5; cursor: not-allowed; }
`;

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'trip'
  );
}

function genTripId(name: string): string {
  const slug = slugify(name);
  const suffix = Date.now().toString(36).slice(-4);
  return `${slug}-${suffix}`.slice(0, 100);
}

export interface NewTripModalProps {
  open: boolean;
  ownerEmail: string;
  onClose: () => void;
  onCreated: (tripId: string) => void;
}

export default function NewTripModal({ open, ownerEmail, onClose, onCreated }: NewTripModalProps) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName('');
      setStartDate('');
      setEndDate('');
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const canSubmit = !!name.trim() && !!startDate && !!endDate && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const tripId = genTripId(name);
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tripId,
          name: name.trim(),
          owner: ownerEmail,
          startDate,
          endDate,
          countries: 'JP',
          published: 1,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = '建立行程失敗，請稍後再試。';
        try {
          const data = JSON.parse(text) as { message?: string };
          if (data?.message) message = data.message;
        } catch {
          // not JSON, keep default
        }
        throw new Error(message);
      }
      const data = (await res.json()) as { tripId: string };
      onCreated(data.tripId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立行程失敗。');
      setSubmitting(false);
    }
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget && !submitting) onClose();
  }

  return (
    <div
      className="tp-new-modal-backdrop"
      onMouseDown={handleBackdrop}
      role="presentation"
      data-testid="new-trip-modal"
    >
      <style>{SCOPED_STYLES}</style>
      <form
        className="tp-new-modal"
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-trip-title"
      >
        <h2 id="new-trip-title">新增行程</h2>
        <p className="tp-new-modal-sub">先填基本資訊建立空白行程，之後可在行程內加景點與餐廳。</p>

        <div className="tp-new-form-row">
          <label htmlFor="new-trip-name">行程名稱</label>
          <input
            id="new-trip-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：沖繩五日"
            required
            autoFocus
            data-testid="new-trip-name-input"
          />
        </div>

        <div className="tp-new-form-grid">
          <div className="tp-new-form-row">
            <label htmlFor="new-trip-start">出發日期</label>
            <input
              id="new-trip-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              data-testid="new-trip-start-input"
            />
          </div>
          <div className="tp-new-form-row">
            <label htmlFor="new-trip-end">回程日期</label>
            <input
              id="new-trip-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              min={startDate || undefined}
              data-testid="new-trip-end-input"
            />
          </div>
        </div>

        {error && (
          <p className="tp-new-modal-error" role="alert" data-testid="new-trip-error">
            {error}
          </p>
        )}

        <div className="tp-new-modal-actions">
          <button
            type="button"
            className="tp-new-modal-btn"
            onClick={onClose}
            disabled={submitting}
            data-testid="new-trip-cancel"
          >
            取消
          </button>
          <button
            type="submit"
            className="tp-new-modal-btn tp-new-modal-btn-primary"
            disabled={!canSubmit}
            data-testid="new-trip-submit"
          >
            {submitting ? '建立中…' : '建立行程'}
          </button>
        </div>
      </form>
    </div>
  );
}
