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
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetchRaw } from '../../lib/apiClient';
import InlineError from '../shared/InlineError';

interface PoiSearchResult {
  osm_id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  country?: string;
  country_name?: string;
}

const POI_SEARCH_DEBOUNCE_MS = 300;
const POI_SEARCH_MIN_LEN = 2;

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
  /* QA 2026-04-26 PR-M：限制 modal 高度 + 讓 form pane 內捲，避免 mobile 內容
   * 被 viewport / iOS home indicator / chrome bottom-nav 切到。32px = 上下
   * backdrop padding 各 16。dvh 走 dynamic viewport 對應 Safari URL bar。 */
  max-height: calc(100dvh - 32px);
  /* PR-V 2026-04-26：mobile single-column 必須明確 grid-template-rows: auto 1fr，
   * 否則 form 自然撐成內容高（755px）超過 modal 可用（812 - hero 222 = 590），
   * 被 modal 的 overflow:hidden 切掉，form 自己 overflow-y: auto 因為「自己沒被
   * 約束」根本不觸發 → user 看到內容被切但動不了。 */
  grid-template-rows: auto 1fr;
}
@media (min-width: 768px) {
  .tp-new-modal {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
    /* Desktop split-screen — hero 跟 form 並排，rows 一個就夠 */
    grid-template-rows: 1fr;
  }
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

/* ===== Form pane ===== */
.tp-new-form {
  padding: 24px;
  display: flex; flex-direction: column;
  /* QA 2026-04-26 PR-M：form pane 自己捲，避免整個 modal 撐爆 viewport。
   * min-height: 0 讓 grid child 可被 max-height 約束（grid 預設 min-height auto）。
   * padding-bottom 加 safe-area，避免 iOS home indicator 蓋到送出按鈕。
   * PR-V 2026-04-26：overscroll-behavior contain 防 iOS rubber-band 把 scroll
   * 傳到背景 page（user 截圖回報「捲動是捲動底部 layer」）。 */
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
  padding-bottom: max(24px, env(safe-area-inset-bottom, 24px));
}
@media (min-width: 768px) {
  .tp-new-form {
    padding: 28px 32px;
    padding-bottom: max(28px, env(safe-area-inset-bottom, 28px));
  }
}
/* PR-W 2026-04-26：close button 從 form-top inline 改 absolute 定位在 modal
 * 右上角（覆蓋 hero pane 上層）。z-index 2 高過 hero SVG（z-index 0/1）。
 * Mobile 跟 desktop 都同一位置。glass-style 在橘色 hero 上對比度 OK。 */
.tp-new-form-close {
  position: absolute;
  top: 12px; right: 12px;
  z-index: 2;
  width: var(--spacing-tap-min, 44px); height: var(--spacing-tap-min, 44px);
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(8px);
  display: grid; place-items: center;
  cursor: pointer;
  font-size: 18px; color: var(--color-foreground);
  box-shadow: var(--shadow-sm);
}
.tp-new-form-close:hover {
  background: var(--color-background);
  color: var(--color-accent-deep);
}
.tp-new-form-close:focus-visible {
  outline: 2px solid var(--color-accent); outline-offset: 2px;
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
/* QA 2026-04-26 PR-M：拿掉 📍 emoji 視覺重心（anti-slop emoji 濫用）。
 * label「目的地」+ placeholder 已經足夠定位 input 用途。 */
.tp-new-dest-wrap { position: relative; }
.tp-new-dest-wrap input { font-weight: 600; }

/* PR-BB 2026-04-26：destination autocomplete dropdown + locked POI chip */
.tp-new-dest-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  z-index: 3;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  max-height: 280px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.tp-new-dest-status {
  padding: 14px 16px;
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  text-align: center;
}
.tp-new-dest-result {
  display: flex; flex-direction: column; gap: 2px;
  width: 100%;
  padding: 10px 14px;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 120ms;
}
.tp-new-dest-result:last-child { border-bottom: 0; }
.tp-new-dest-result:hover {
  background: var(--color-accent-subtle);
}
.tp-new-dest-result:focus-visible {
  outline: 2px solid var(--color-accent); outline-offset: -2px;
}
.tp-new-dest-result .name {
  font-size: var(--font-size-callout); font-weight: 700;
  color: var(--color-foreground);
  line-height: 1.3;
}
.tp-new-dest-result .addr {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  line-height: 1.4;
  overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;
}

.tp-new-dest-locked {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1.5px solid var(--color-accent);
  border-radius: var(--radius-lg);
  background: var(--color-accent-subtle);
  min-height: var(--spacing-tap-min);
}
.tp-new-dest-locked-text {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 2px;
}
.tp-new-dest-locked-text strong {
  font-size: var(--font-size-body); font-weight: 700;
  color: var(--color-accent-deep);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tp-new-dest-locked-country {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
}
.tp-new-dest-clear {
  width: 32px; height: 32px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-muted);
  display: grid; place-items: center;
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
}
.tp-new-dest-clear:hover {
  background: var(--color-accent-bg);
  color: var(--color-accent-deep);
}
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
  /* QA 2026-04-26 BUG-031：右側 28px gradient mask 暗示「還有月份可滑」。
   * 比照 PR-A DayNav + PR-D mobile carousel 同 pattern。 */
  -webkit-mask-image: linear-gradient(to right, black calc(100% - 28px), transparent 100%);
  mask-image: linear-gradient(to right, black calc(100% - 28px), transparent 100%);
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
.tp-new-flex-month .m { font-size: var(--font-size-callout); font-weight: 700; }
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

const MONTHS_AHEAD = 6;
const DEFAULT_FLEX_DAYS = 5;
const MIN_FLEX_DAYS = 1;
const MAX_FLEX_DAYS = 30;

interface MonthChoice {
  key: string;
  label: string;
  year: number;
  month: number; // 0-indexed
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

// PR-BB 2026-04-26：detectCountries() 移除。原本用 keyword regex 猜測 country，
// 不準（沖繩寫成 "Naha" / 巴塞隆納沒列在清單 / 等等都會 default JP）。改成
// destination autocomplete 強制 user 選一筆 POI，直接拿 Nominatim 真實 country code。

export interface NewTripModalProps {
  open: boolean;
  ownerEmail: string;
  onClose: () => void;
  onCreated: (tripId: string) => void;
}

type DateMode = 'select' | 'flexible';

export default function NewTripModal({ open, ownerEmail, onClose, onCreated }: NewTripModalProps) {
  // PR-BB 2026-04-26：destination 從 free-text 改 POI autocomplete。User 必須
  // 從搜尋結果選一筆 (selectedPoi)，submit 才會通過 canSubmit。Country code 用
  // Nominatim 回傳的 ISO alpha-2 取代原本 detectCountries() keyword regex 猜測。
  const [destQuery, setDestQuery] = useState('');
  const [selectedPoi, setSelectedPoi] = useState<PoiSearchResult | null>(null);
  const [poiResults, setPoiResults] = useState<PoiSearchResult[] | null>(null);
  const [poiSearching, setPoiSearching] = useState(false);
  const [poiSearchError, setPoiSearchError] = useState<string | null>(null);
  const poiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poiAbortRef = useRef<AbortController | null>(null);

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
      setDestQuery('');
      setSelectedPoi(null);
      setPoiResults(null);
      setPoiSearching(false);
      setPoiSearchError(null);
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

  // Debounced POI search — 同 InlineAddPoi 250ms pattern，但 lower min len 2。
  // selectedPoi 鎖定後不再 search（user 已選定）。
  useEffect(() => {
    if (!open) return;
    if (selectedPoi) return; // already locked, no re-search
    if (poiDebounceRef.current) clearTimeout(poiDebounceRef.current);
    const trimmed = destQuery.trim();
    if (trimmed.length < POI_SEARCH_MIN_LEN) {
      setPoiResults(null);
      setPoiSearching(false);
      setPoiSearchError(null);
      poiAbortRef.current?.abort();
      return;
    }
    poiDebounceRef.current = setTimeout(async () => {
      poiAbortRef.current?.abort();
      const ctrl = new AbortController();
      poiAbortRef.current = ctrl;
      setPoiSearching(true);
      setPoiSearchError(null);
      try {
        const resp = await fetch(
          `/api/poi-search?q=${encodeURIComponent(trimmed)}&limit=10`,
          { signal: ctrl.signal },
        );
        if (!resp.ok) {
          setPoiSearchError('搜尋失敗，請稍後再試');
          setPoiResults([]);
          return;
        }
        const data = (await resp.json()) as { results: PoiSearchResult[] };
        setPoiResults(data.results ?? []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setPoiSearchError('網路連線失敗');
        setPoiResults([]);
      } finally {
        setPoiSearching(false);
      }
    }, POI_SEARCH_DEBOUNCE_MS);
    return () => {
      if (poiDebounceRef.current) clearTimeout(poiDebounceRef.current);
    };
  }, [destQuery, selectedPoi, open]);

  function selectPoi(poi: PoiSearchResult) {
    setSelectedPoi(poi);
    setDestQuery(poi.name);
    setPoiResults(null);
  }

  function clearSelectedPoi() {
    setSelectedPoi(null);
    setDestQuery('');
    setPoiResults(null);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const datesValid = dateMode === 'flexible' ? !!flexMonth && flexDays >= MIN_FLEX_DAYS : !!startDate && !!endDate;
  // PR-BB：必須選一筆 POI，自由文字不通過
  const canSubmit = !!selectedPoi && datesValid && !submitting;

  function adjustFlexDays(delta: number) {
    setFlexDays((d) => Math.min(MAX_FLEX_DAYS, Math.max(MIN_FLEX_DAYS, d + delta)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selectedPoi) return;
    setSubmitting(true);
    setError(null);
    const tripName = selectedPoi.name;
    const tripId = genTripId(tripName);
    const dates = dateMode === 'flexible'
      ? flexDatesFromMonth(flexMonth, flexDays)
      : { start: startDate, end: endDate };
    // PR-BB：country 用 Nominatim ISO alpha-2，fallback 'JP' 給找不到 country
    // 的特例（多半 OSM 邊界 POI / 海上 POI）。
    const countries = selectedPoi.country || 'JP';
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
          countries,
          description: preferences.trim() || undefined,
          published: 1,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        // PR-Y 2026-04-26：API 用巢狀 { error: { code, message } } 格式
        // (functions/api/_errors.ts errorResponse)，原本只讀 data.message 永遠
        // 拿不到任何 message → user 永遠看到 generic「建立行程失敗，請稍後
        // 再試」掩蓋真實 reason（401 沒登入 / 400 驗證失敗 / 503 DB 錯等）。
        // 改讀 data.error.message → 用 ERROR_MESSAGES dictionary 已 friendly 的文字。
        let message = '建立行程失敗，請稍後再試。';
        try {
          const data = JSON.parse(text) as { error?: { code?: string; message?: string } };
          const errMsg = data?.error?.message;
          if (errMsg) message = errMsg;
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

  // PR-BB 2026-04-26：destShown 從 `destination.trim()` 改 `selectedPoi?.name`，
  // 強制 user 選一筆 POI 才有 summary 文字。沒選顯示「請先選擇目的地」。
  const destShown = selectedPoi?.name ?? '';
  const summaryText = dateMode === 'flexible'
    ? destShown
      ? `${destShown} · ${flexDays} 天 · ${flexMonth ? monthChoices.find((m) => m.key === flexMonth)?.label : ''}`
      : '請先選擇目的地'
    : destShown
      ? `${destShown}${startDate && endDate ? ` · ${startDate} – ${endDate}` : ''}`
      : '請先選擇目的地';

  // PR-P 2026-04-26：portal 到 document.body，escape 任何 ancestor stacking
  // context（AppShell scroll container / TripsListPage sheet 等），讓 backdrop
  // z-index 60 真正高過 sticky bottom nav (z-index 10)。修 mobile 下方控制鍵
  // 被 nav 蓋住無法 tap 的 bug。
  return createPortal((
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
        style={{ position: 'relative' }}
      >
        {/* PR-W：close 直接 absolute 定位在 modal 右上角，獨立於 hero/form 兩個
            grid child，覆蓋整個 modal 右上 corner。 */}
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
        {/* Hero pane — QA 2026-04-26 PR-M：移除 social proof banner（fake stat
            anti-slop + user 截圖確認 mobile 太擠）。eyebrow + h1 + 副標保留。 */}
        <aside className="tp-new-hero" data-testid="new-trip-hero" aria-hidden="true">
          {HERO_SVG}
          <span className="tp-new-hero-eyebrow">新行程</span>
          <div className="tp-new-hero-content">
            <h1>規劃下一<br />趟旅行</h1>
            <p>告訴我們去哪、待幾天，<br />剩下的我們陪你想。</p>
          </div>
        </aside>

        {/* Form pane */}
        <div className="tp-new-form">
          <h2 id="new-trip-title">想去哪裡？</h2>
          <p className="tp-new-modal-sub">先說目的地跟想做什麼，AI 會幫你排日程、餐廳、住宿。</p>

          <div className="tp-new-form-row">
            <label htmlFor="new-trip-destination">目的地</label>
            <div className="tp-new-dest-wrap">
              {selectedPoi ? (
                /* PR-BB：locked POI chip。點 ✕ 重新搜尋。 */
                <div className="tp-new-dest-locked" data-testid="new-trip-dest-locked">
                  <div className="tp-new-dest-locked-text">
                    <strong>{selectedPoi.name}</strong>
                    {selectedPoi.country_name && (
                      <span className="tp-new-dest-locked-country">
                        {selectedPoi.country_name}
                        {selectedPoi.country && ` · ${selectedPoi.country}`}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="tp-new-dest-clear"
                    onClick={clearSelectedPoi}
                    aria-label="重新選擇目的地"
                    data-testid="new-trip-dest-clear"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <input
                    id="new-trip-destination"
                    type="text"
                    value={destQuery}
                    onChange={(e) => setDestQuery(e.target.value)}
                    placeholder="搜尋景點、城市、地址…"
                    required
                    autoFocus
                    autoComplete="off"
                    data-testid="new-trip-destination-input"
                  />
                  {/* PR-BB：dropdown 顯示搜尋結果。debounce 300ms。User 必須選
                      一筆才能 submit（強制收斂到 OSM 真實 POI / 拿 country code）。 */}
                  {(poiSearching || poiResults || poiSearchError) && destQuery.trim().length >= POI_SEARCH_MIN_LEN && (
                    <div className="tp-new-dest-dropdown" role="listbox" data-testid="new-trip-dest-dropdown">
                      {poiSearching && <div className="tp-new-dest-status">搜尋中…</div>}
                      {!poiSearching && poiSearchError && <div className="tp-new-dest-status">{poiSearchError}</div>}
                      {!poiSearching && !poiSearchError && poiResults && poiResults.length === 0 && (
                        <div className="tp-new-dest-status">沒找到結果，試試別的關鍵字</div>
                      )}
                      {!poiSearching && poiResults && poiResults.length > 0 && poiResults.map((p) => (
                        <button
                          key={p.osm_id}
                          type="button"
                          role="option"
                          className="tp-new-dest-result"
                          onClick={() => selectPoi(p)}
                          data-testid={`new-trip-dest-result-${p.osm_id}`}
                        >
                          <span className="name">{p.name}</span>
                          <span className="addr">{p.address}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
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

          {error && <InlineError message={error} testId="new-trip-error" />}

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
  ), document.body);
}
