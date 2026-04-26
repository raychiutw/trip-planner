/**
 * NewTripModal — 「想去哪裡」優先的行程建立 modal（V2 split-hero）。
 *
 * 結構（≥768px desktop）：
 *   ┌──────────────┬──────────────────┐
 *   │  Hero pane   │  Form pane       │
 *   │  (SVG bg +   │  目的地 / 日期    │
 *   │   social     │   / 偏好 / 送出  │
 *   │   proof)     │                  │
 *   └──────────────┴──────────────────┘
 *
 * <768px 下 hero 收成上方 200px banner，form 全寬下接。
 *
 * 日期模式：
 *   - select：showStart/End picker（HTML date input，瀏覽器原生）
 *   - flexible：numeric stepper（1–30 天）+ 月份 carousel（未來 6 個月）
 *     submit 時用「該月 1 日」當 start，+ (days-1) 當 end
 *
 * 對應 mindtrip 8:31.31 split-screen 與 8:32.17 numeric stepper / month carousel。
 */
import { useEffect, useMemo, useState } from 'react';
import { apiFetchRaw } from '../../lib/apiClient';

const SCOPED_STYLES = `
.tp-new-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(42, 31, 24, 0.55);
  z-index: var(--z-modal, 60);
  display: grid; place-items: center;
  padding: 16px;
  animation: tp-new-modal-fade 160ms var(--transition-timing-function-apple, ease-out);
}
@keyframes tp-new-modal-fade { from { opacity: 0; } to { opacity: 1; } }

.tp-new-modal {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 880px;
  font: inherit;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr;
}
@media (min-width: 768px) {
  .tp-new-modal { grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); }
}

/* ===== Hero pane ===== */
.tp-new-hero {
  position: relative;
  padding: 24px;
  display: flex; flex-direction: column; justify-content: space-between;
  color: #fff;
  background: linear-gradient(160deg, var(--color-accent-deep, #B85C2E) 0%, var(--color-accent, #D97848) 50%, #E8956B 100%);
  overflow: hidden;
  min-height: 200px;
  gap: 20px;
}
@media (min-width: 768px) {
  .tp-new-hero { padding: 32px; min-height: auto; }
}
.tp-new-hero > * { position: relative; z-index: 1; }
.tp-new-hero-svg { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0.5; z-index: 0; }
.tp-new-hero-eyebrow {
  font-size: var(--font-size-caption, 0.75rem); font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.12em;
  background: rgba(255,255,255,0.2);
  padding: 6px 12px; border-radius: var(--radius-full);
  align-self: flex-start;
  backdrop-filter: blur(8px);
}
.tp-new-hero-content h1 {
  font-size: var(--font-size-title, 1.75rem); font-weight: 800;
  line-height: 1.15; letter-spacing: -0.02em;
  margin: 0 0 12px;
  text-shadow: 0 2px 12px rgba(0,0,0,0.25);
}
@media (min-width: 768px) {
  .tp-new-hero-content h1 { font-size: var(--font-size-large-title, 2.125rem); }
}
.tp-new-hero-content p {
  font-size: var(--font-size-callout, 1rem);
  line-height: 1.5; margin: 0;
  opacity: 0.95;
  text-shadow: 0 1px 4px rgba(0,0,0,0.2);
}
.tp-new-hero-proof {
  display: flex; align-items: center; gap: 12px;
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  backdrop-filter: blur(8px);
}
.tp-new-hero-proof-avatars { display: flex; }
.tp-new-hero-proof-av {
  width: 28px; height: 28px;
  border-radius: var(--radius-full);
  border: 2px solid #fff;
  background: var(--color-accent-bg, #F7DFCB);
  margin-left: -8px;
  display: grid; place-items: center;
  font-size: var(--font-size-caption, 0.75rem); font-weight: 700;
  color: var(--color-accent-deep, #B85C2E);
}
.tp-new-hero-proof-av:first-child { margin-left: 0; }
.tp-new-hero-proof-av.plus { background: var(--color-accent-deep, #B85C2E); color: #fff; }
.tp-new-hero-proof-text { font-size: var(--font-size-footnote, 0.8125rem); line-height: 1.4; }
.tp-new-hero-proof-text b { font-weight: 700; }
.tp-new-hero-proof-text .sub { opacity: 0.85; display: block; }

/* ===== Form pane ===== */
.tp-new-form {
  padding: 24px;
  display: flex; flex-direction: column;
}
@media (min-width: 768px) {
  .tp-new-form { padding: 28px 32px; }
}
.tp-new-form-top { display: flex; justify-content: flex-end; margin-bottom: 8px; }
.tp-new-form-close {
  width: var(--spacing-tap-min, 44px); height: var(--spacing-tap-min, 44px);
  border-radius: var(--radius-full);
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  display: grid; place-items: center;
  cursor: pointer;
  font-size: 18px; color: var(--color-muted);
}
.tp-new-form-close:hover {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  border-color: var(--color-accent-bg);
}
.tp-new-modal h2 {
  font-size: var(--font-size-title, 1.75rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 6px;
}
.tp-new-modal-sub {
  color: var(--color-muted);
  font-size: var(--font-size-callout);
  margin: 0 0 20px;
  line-height: 1.5;
}
.tp-new-form-row { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.tp-new-form-row-spaced { margin-top: 16px; }
/* QA 2026-04-26 BUG-026：依 mockup .dest-input .pin spec — 目的地 input 左
 * 側固定 📍 icon 提供視覺重心。padding-left 從 14 → 44 騰出 icon 空間。 */
.tp-new-dest-wrap { position: relative; }
.tp-new-dest-wrap .tp-new-dest-pin {
  position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
  color: var(--color-accent); font-size: 20px;
  pointer-events: none;
  line-height: 1;
}
.tp-new-dest-wrap input { padding-left: 44px !important; font-weight: 600; }
.tp-new-form-row label {
  font-size: var(--font-size-footnote);
  font-weight: 700;
  color: var(--color-foreground);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.tp-new-form-row input,
.tp-new-form-row textarea {
  padding: 12px 14px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-secondary);
  color: var(--color-foreground);
  font: inherit;
  font-size: var(--font-size-body);
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
  background: var(--color-background);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-new-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tp-new-modal-error {
  color: var(--color-destructive);
  font-size: var(--font-size-footnote);
  margin: 4px 0 0;
}

/* ===== Date mode segmented control ===== */
.tp-new-segmented {
  display: inline-flex; gap: 0;
  padding: 4px; border-radius: var(--radius-full);
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  align-self: stretch;
}
.tp-new-segmented button {
  flex: 1;
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 10px 16px; border-radius: var(--radius-full);
  border: none; background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  transition: all 0.15s;
  /* H4: Apple HIG 44px tap target — keep 44px even inside the 4px-padded
   * segmented chrome so the inner button itself remains tappable. */
  min-height: var(--spacing-tap-min);
}
.tp-new-segmented button.is-active {
  /* QA 2026-04-26 BUG-029：原本只有 --shadow-sm 對比度不夠，加 accent border
   * + 升 --shadow-md 讓 active state 一眼看得出。仍守 mockup「白底 active」 base。 */
  background: var(--color-background);
  color: var(--color-accent-deep);
  box-shadow: var(--shadow-md), inset 0 0 0 1.5px var(--color-accent);
}
.tp-new-segmented button:hover:not(.is-active) {
  color: var(--color-foreground);
}

/* ===== Numeric stepper (flexible mode) ===== */
.tp-new-flex-stepper {
  display: flex; align-items: center; justify-content: center; gap: 16px;
  padding: 12px;
  background: var(--color-secondary); border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.tp-new-flex-step {
  width: 44px; height: 44px;
  border-radius: var(--radius-full);
  border: 1.5px solid var(--color-border);
  background: var(--color-background);
  cursor: pointer;
  display: grid; place-items: center;
  font-size: 22px; color: var(--color-foreground);
}
.tp-new-flex-step:hover:not(:disabled) {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent);
  color: var(--color-accent-deep);
}
.tp-new-flex-step:disabled { opacity: 0.4; cursor: not-allowed; }
.tp-new-flex-num {
  /* QA 2026-04-26 BUG-030：mockup spec 用 --font-size-large-title (2.125rem)
   * 給 stepper 數字大字權重。current --font-size-title (1.75rem) 太小。 */
  font-size: var(--font-size-large-title, 2.125rem); font-weight: 800;
  color: var(--color-foreground); min-width: 64px; text-align: center;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.tp-new-flex-unit { font-size: var(--font-size-callout); color: var(--color-muted); }

/* ===== Month carousel ===== */
.tp-new-flex-month-label {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  margin: 12px 0 6px; font-weight: 600;
}
.tp-new-flex-months {
  display: flex; gap: 8px; overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: thin;
}
.tp-new-flex-months::-webkit-scrollbar { height: 4px; }
.tp-new-flex-months::-webkit-scrollbar-thumb { background: var(--color-line-strong); border-radius: 2px; }
.tp-new-flex-month {
  flex: 0 0 auto; min-width: 80px;
  font: inherit;
  background: var(--color-secondary);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 10px 8px;
  text-align: center;
  cursor: pointer;
  min-height: var(--spacing-tap-min, 44px);
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  color: var(--color-foreground);
}
.tp-new-flex-month:hover:not(.is-active) {
  border-color: var(--color-accent-bg);
  background: var(--color-accent-subtle);
}
.tp-new-flex-month.is-active {
  background: var(--color-accent);
  color: var(--color-accent-foreground, #fff);
  border-color: var(--color-accent);
}
.tp-new-flex-month .icon { font-size: 16px; line-height: 1; }
.tp-new-flex-month .m { font-size: var(--font-size-footnote); font-weight: 700; }
.tp-new-flex-month .y { font-size: var(--font-size-caption); opacity: 0.75; }

/* ===== CTA ===== */
.tp-new-modal-actions {
  display: flex; gap: 8px; justify-content: flex-end; align-items: center;
  margin-top: 20px; padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.tp-new-modal-summary {
  flex: 1; font-size: var(--font-size-footnote); color: var(--color-muted);
}
.tp-new-modal-summary b { color: var(--color-foreground); font-weight: 700; }
.tp-new-modal-btn {
  padding: 12px 20px;
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
.tp-new-modal-btn-primary:hover:not(:disabled) { filter: brightness(var(--hover-brightness, 0.95)); }
.tp-new-modal-btn:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const HERO_SVG = (
  <svg className="tp-new-hero-svg" viewBox="0 0 400 600" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="80" cy="120" r="40" fill="#fff" opacity="0.15" />
    <circle cx="320" cy="180" r="60" fill="#fff" opacity="0.1" />
    <path d="M0 480 Q 100 460 200 470 T 400 460 L 400 600 L 0 600 Z" fill="#fff" opacity="0.15" />
    <path d="M0 520 Q 80 500 180 515 T 400 510 L 400 600 L 0 600 Z" fill="#fff" opacity="0.2" />
    <circle cx="320" cy="100" r="36" fill="#FFE4C8" opacity="0.5" />
    <ellipse cx="120" cy="380" rx="80" ry="22" fill="#fff" opacity="0.25" />
    <ellipse cx="280" cy="330" rx="100" ry="28" fill="#fff" opacity="0.2" />
    <path d="M0 420 Q 50 415 100 420 T 200 420 T 300 420 T 400 420" stroke="#fff" strokeWidth="1.5" opacity="0.3" fill="none" />
    <path d="M0 440 Q 50 435 100 440 T 200 440 T 300 440 T 400 440" stroke="#fff" strokeWidth="1.5" opacity="0.2" fill="none" />
  </svg>
);

const MONTH_ICONS = ['❄️', '🌸', '🌸', '🌸', '☀️', '☀️', '☀️', '🏝️', '🍁', '🍁', '🍂', '❄️'];
const MONTHS_AHEAD = 6;
const DEFAULT_FLEX_DAYS = 5;
const MIN_FLEX_DAYS = 1;
const MAX_FLEX_DAYS = 30;
const DEFAULT_TOTAL_TRIPS = 1247;

interface MonthChoice {
  key: string;
  label: string;
  year: number;
  month: number; // 0-indexed
  icon: string;
}

function buildMonthChoices(now: Date): MonthChoice[] {
  const out: MonthChoice[] = [];
  for (let i = 0; i < MONTHS_AHEAD; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    out.push({
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: `${month + 1} 月`,
      year,
      month,
      icon: MONTH_ICONS[month] ?? '📅',
    });
  }
  return out;
}

function flexDatesFromMonth(monthKey: string, days: number): { start: string; end: string } {
  const [y, m] = monthKey.split('-').map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, 1));
  const end = new Date(Date.UTC(y!, m! - 1, 1));
  end.setUTCDate(end.getUTCDate() + (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

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

function detectCountries(destination: string): string {
  const s = destination.toLowerCase();
  if (/沖繩|沖縄|京都|東京|大阪|北海道|福岡|名古屋|奈良|kyoto|tokyo|osaka|okinawa|japan|jp/i.test(destination) || /jp/.test(s)) return 'JP';
  if (/首爾|釜山|濟州|seoul|busan|jeju|korea|kr/i.test(destination)) return 'KR';
  if (/台北|台中|台南|花蓮|高雄|墾丁|taipei|taichung|tainan|hualien|kaohsiung|taiwan|tw/i.test(destination)) return 'TW';
  if (/曼谷|清邁|普吉|bangkok|chiang|phuket|thailand|th/i.test(destination)) return 'TH';
  if (/巴黎|羅馬|倫敦|paris|rome|london|europe/i.test(destination)) return 'EU';
  return 'JP';
}

function formatTripCount(n: number): string {
  return n.toLocaleString('en-US');
}

export interface NewTripModalProps {
  open: boolean;
  ownerEmail: string;
  onClose: () => void;
  onCreated: (tripId: string) => void;
  /** Total trips count for hero social proof. Defaults to 1247 placeholder. */
  totalTrips?: number;
}

type DateMode = 'select' | 'flexible';

export default function NewTripModal({ open, ownerEmail, onClose, onCreated, totalTrips }: NewTripModalProps) {
  const [destination, setDestination] = useState('');
  const [dateMode, setDateMode] = useState<DateMode>('select');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preferences, setPreferences] = useState('');
  const [flexDays, setFlexDays] = useState(DEFAULT_FLEX_DAYS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthChoices = useMemo(() => buildMonthChoices(new Date()), [open]);
  const [flexMonth, setFlexMonth] = useState<string>(() => monthChoices[0]?.key ?? '');

  useEffect(() => {
    if (!open) {
      setDestination('');
      setDateMode('select');
      setStartDate('');
      setEndDate('');
      setPreferences('');
      setFlexDays(DEFAULT_FLEX_DAYS);
      setSubmitting(false);
      setError(null);
    } else {
      setFlexMonth(monthChoices[0]?.key ?? '');
    }
  }, [open, monthChoices]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const proofCount = totalTrips ?? DEFAULT_TOTAL_TRIPS;
  const datesValid = dateMode === 'flexible' ? !!flexMonth && flexDays >= MIN_FLEX_DAYS : !!startDate && !!endDate;
  const canSubmit = !!destination.trim() && datesValid && !submitting;

  function adjustFlexDays(delta: number) {
    setFlexDays((d) => Math.min(MAX_FLEX_DAYS, Math.max(MIN_FLEX_DAYS, d + delta)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const tripName = destination.trim();
    const tripId = genTripId(tripName);
    const dates = dateMode === 'flexible'
      ? flexDatesFromMonth(flexMonth, flexDays)
      : { start: startDate, end: endDate };
    try {
      const res = await apiFetchRaw('/trips', {
        method: 'POST',
        credentials: 'same-origin',
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

  // QA 2026-04-26 BUG-027：destination 空時顯示「請先輸入目的地」 — 比「未
  // 選地點」更明確（user 可能誤以為「未選地點」 是 toggle option 而非 prompt）。
  const destShown = destination.trim();
  const summaryText = dateMode === 'flexible'
    ? destShown
      ? `${destShown} · ${flexDays} 天 · ${flexMonth ? monthChoices.find((m) => m.key === flexMonth)?.label : ''}`
      : '請先輸入目的地'
    : destShown
      ? `${destShown}${startDate && endDate ? ` · ${startDate} – ${endDate}` : ''}`
      : '請先輸入目的地';

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
        {/* Hero pane */}
        <aside className="tp-new-hero" data-testid="new-trip-hero" aria-hidden="true">
          {HERO_SVG}
          <span className="tp-new-hero-eyebrow">第 {formatTripCount(proofCount + 1)} 個行程</span>
          <div className="tp-new-hero-content">
            <h1>規劃下一<br />趟旅行</h1>
            <p>告訴我們去哪、待幾天，<br />剩下的我們陪你想。</p>
          </div>
          <div className="tp-new-hero-proof" data-testid="new-trip-social-proof">
            <div className="tp-new-hero-proof-avatars">
              <div className="tp-new-hero-proof-av">蔡</div>
              <div className="tp-new-hero-proof-av">林</div>
              <div className="tp-new-hero-proof-av">王</div>
              <div className="tp-new-hero-proof-av plus">+</div>
            </div>
            <div className="tp-new-hero-proof-text">
              <b>{formatTripCount(proofCount)} 個行程</b>已在 Tripline 上分享
              <span className="sub">平均規劃時間 8 分鐘</span>
            </div>
          </div>
        </aside>

        {/* Form pane */}
        <div className="tp-new-form">
          <div className="tp-new-form-top">
            <button
              type="button"
              className="tp-new-form-close"
              onClick={onClose}
              disabled={submitting}
              aria-label="關閉"
              data-testid="new-trip-close"
            >
              ✕
            </button>
          </div>

          <h2 id="new-trip-title">想去哪裡？</h2>
          <p className="tp-new-modal-sub">先說目的地跟想做什麼，AI 會幫你排日程、餐廳、住宿。</p>

          <div className="tp-new-form-row">
            <label htmlFor="new-trip-destination">目的地</label>
            <div className="tp-new-dest-wrap">
              <span className="tp-new-dest-pin" aria-hidden="true">📍</span>
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
            <div data-testid="new-trip-flex-block">
              <div className="tp-new-flex-stepper" data-testid="new-trip-flex-stepper">
                <button
                  type="button"
                  className="tp-new-flex-step"
                  onClick={() => adjustFlexDays(-1)}
                  disabled={flexDays <= MIN_FLEX_DAYS}
                  aria-label="減少一天"
                  data-testid="new-trip-flex-day-minus"
                >
                  −
                </button>
                <div className="tp-new-flex-num" data-testid="new-trip-flex-days">{flexDays}</div>
                <span className="tp-new-flex-unit">天</span>
                <button
                  type="button"
                  className="tp-new-flex-step"
                  onClick={() => adjustFlexDays(+1)}
                  disabled={flexDays >= MAX_FLEX_DAYS}
                  aria-label="增加一天"
                  data-testid="new-trip-flex-day-plus"
                >
                  +
                </button>
              </div>

              <div className="tp-new-flex-month-label">大概什麼時候出發？</div>
              <div className="tp-new-flex-months" data-testid="new-trip-flex-months" role="radiogroup" aria-label="出發月份">
                {monthChoices.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    role="radio"
                    aria-pressed={flexMonth === m.key}
                    aria-checked={flexMonth === m.key}
                    className={`tp-new-flex-month${flexMonth === m.key ? ' is-active' : ''}`}
                    onClick={() => setFlexMonth(m.key)}
                    data-testid={`new-trip-flex-month-${m.key}`}
                  >
                    <span className="icon" aria-hidden="true">{m.icon}</span>
                    <span className="m">{m.label}</span>
                    <span className="y">{m.year}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="tp-new-form-row tp-new-form-row-spaced">
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
            <div className="tp-new-modal-summary"><b>{summaryText}</b></div>
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
        </div>
      </form>
    </div>
  );
}
