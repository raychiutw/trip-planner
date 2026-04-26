/**
 * NewTripModal — 「想去哪裡」優先的行程建立 modal。
 *
 * 取代舊的「行程名稱 + 兩顆日期」三欄表單。新流程對齊 mindtrip 的
 * Where to? 模式：
 *   1. 目的地（destination）— 主欄位，placeholder 給靈感（沖繩・京都・首爾…）
 *   2. 日期模式切換（dateMode）— 「選日期」/「彈性日期」二選一
 *      - select：showStart/End picker
 *      - flexible：留白，submit 時用今天 + 5 天當佔位（之後可在行程內改）
 *   3. 旅伴偏好（preferences）— 選填 textarea，存進 trip.description
 *      讓 AI 之後可以參照（例：想去溫泉、別太累、預算 5 萬）
 *
 * Submit:
 *   - tripId 由目的地 slug + 4-char base36 timestamp 組成，user 不需手動輸入。
 *   - name = 目的地（最少摩擦），title/description 都可後續在 trip 內編輯。
 *   - countries 用 keyword 偵測：沖繩/京都/東京/大阪 → JP，首爾/釜山 → KR，
 *     台北/花蓮 → TW，否則 fallback "JP"（最大宗）。
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
  width: 100%; max-width: 460px;
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
.tp-new-form-row input,
.tp-new-form-row textarea {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font: inherit;
  font-size: var(--font-size-callout);
  min-height: var(--spacing-tap-min);
}
.tp-new-form-row textarea {
  resize: vertical;
  min-height: 72px;
  line-height: 1.5;
}
.tp-new-form-row input:focus,
.tp-new-form-row textarea:focus {
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

/* Date mode segmented control — mirrors mindtrip 的 Flexible / Select dates。
 * 對齊 nav-tabs：Terracotta accent fill 表示 active，hairline border + ink text 表示 inactive。 */
.tp-new-segmented {
  display: inline-flex; gap: 2px;
  padding: 4px; border-radius: var(--radius-md);
  background: var(--color-secondary);
  align-self: flex-start;
}
.tp-new-segmented button {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 10px 16px; border-radius: var(--radius-sm);
  border: none; background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  transition: all 0.15s;
  /* H4: Apple HIG 44px tap target — terracotta-preview 用 36px 是 mockup
   * 簡化，這裡實作守住 44px 確保手機操作不誤點。 */
  min-height: var(--spacing-tap-min);
}
.tp-new-segmented button.is-active {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
}
.tp-new-segmented button:hover:not(.is-active) {
  color: var(--color-foreground);
  background: var(--color-tertiary);
}
.tp-new-flexible-hint {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  padding: 8px 0 0;
}
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

/**
 * Lightweight country-code detection by keyword.
 * Default JP（最大宗）— 沒命中 keyword 也不擋 submit。
 */
function detectCountries(destination: string): string {
  const s = destination.toLowerCase();
  if (/沖繩|沖縄|京都|東京|大阪|北海道|福岡|名古屋|奈良|kyoto|tokyo|osaka|okinawa|japan|jp/i.test(destination) || /jp/.test(s)) return 'JP';
  if (/首爾|釜山|濟州|seoul|busan|jeju|korea|kr/i.test(destination)) return 'KR';
  if (/台北|台中|台南|花蓮|高雄|墾丁|taipei|taichung|tainan|hualien|kaohsiung|taiwan|tw/i.test(destination)) return 'TW';
  if (/曼谷|清邁|普吉|bangkok|chiang|phuket|thailand|th/i.test(destination)) return 'TH';
  if (/巴黎|羅馬|倫敦|paris|rome|london|europe/i.test(destination)) return 'EU';
  return 'JP';
}

/**
 * 「彈性日期」fallback：今天 + 5 天，user 之後可在行程內改。
 * yyyy-mm-dd 格式（API expected）。
 */
function flexibleDates(): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const start = fmt(now);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 5);
  return { start, end: fmt(endDate) };
}

export interface NewTripModalProps {
  open: boolean;
  ownerEmail: string;
  onClose: () => void;
  onCreated: (tripId: string) => void;
}

type DateMode = 'select' | 'flexible';

export default function NewTripModal({ open, ownerEmail, onClose, onCreated }: NewTripModalProps) {
  const [destination, setDestination] = useState('');
  const [dateMode, setDateMode] = useState<DateMode>('select');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preferences, setPreferences] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDestination('');
      setDateMode('select');
      setStartDate('');
      setEndDate('');
      setPreferences('');
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

  const datesValid =
    dateMode === 'flexible' ? true : !!startDate && !!endDate;
  const canSubmit = !!destination.trim() && datesValid && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const tripName = destination.trim();
    const tripId = genTripId(tripName);
    const dates = dateMode === 'flexible' ? flexibleDates() : { start: startDate, end: endDate };
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tripId,
          name: tripName,
          owner: ownerEmail,
          startDate: dates.start,
          endDate: dates.end,
          countries: detectCountries(tripName),
          description: preferences.trim() || undefined,
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
        <h2 id="new-trip-title">想去哪裡？</h2>
        <p className="tp-new-modal-sub">先說目的地跟想做什麼，AI 會幫你排日程、餐廳、住宿。</p>

        <div className="tp-new-form-row">
          <label htmlFor="new-trip-destination">目的地</label>
          <input
            id="new-trip-destination"
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="沖繩・京都・首爾・台南..."
            required
            autoFocus
            data-testid="new-trip-destination-input"
          />
        </div>

        <div className="tp-new-form-row">
          <label>日期</label>
          <div
            className="tp-new-segmented"
            role="tablist"
            aria-label="日期模式"
          >
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'select'}
              className={dateMode === 'select' ? 'is-active' : ''}
              onClick={() => setDateMode('select')}
              data-testid="new-trip-date-mode-select"
            >
              選日期
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'flexible'}
              className={dateMode === 'flexible' ? 'is-active' : ''}
              onClick={() => setDateMode('flexible')}
              data-testid="new-trip-date-mode-flexible"
            >
              彈性日期
            </button>
          </div>
        </div>

        {dateMode === 'select' ? (
          <div className="tp-new-form-grid">
            <div className="tp-new-form-row">
              <label htmlFor="new-trip-start">出發</label>
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
              <label htmlFor="new-trip-end">回程</label>
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
        ) : (
          <p className="tp-new-flexible-hint" data-testid="new-trip-flexible-hint">
            先建空行程，之後再決定具體日期就好。
          </p>
        )}

        <div className="tp-new-form-row">
          <label htmlFor="new-trip-preferences">想做什麼？（選填）</label>
          <textarea
            id="new-trip-preferences"
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            placeholder="想去溫泉、別太累、預算 5 萬 / 兩人..."
            rows={3}
            maxLength={2000}
            data-testid="new-trip-preferences-input"
          />
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
