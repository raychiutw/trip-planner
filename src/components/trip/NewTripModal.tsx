/**
 * NewTripModal — form-first single-column trip creation modal.
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
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { apiFetchRaw } from '../../lib/apiClient';
import { lsGet, lsSet } from '../../lib/localStorage';
import InlineError from '../shared/InlineError';
import Icon from '../shared/Icon';
import { TP_DRAG_ACCESSIBILITY } from '../../lib/drag-announcements';

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

// Section 4.2.8 (terracotta-mockup-parity-v2)：「熱門目的地」靜態 list
// （無 backend trending endpoint，依使用者 trip-planner 主要市場手動 curate）。
// 點擊 chip → 直接觸發 search input 走既有 debounce 流程（避免 fake POI inject
// 造成 country code 不準）。
const POPULAR_DESTINATIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'okinawa', label: '沖繩' },
  { key: 'tokyo', label: '東京' },
  { key: 'kyoto', label: '京都' },
  { key: 'seoul', label: '首爾' },
  { key: 'bangkok', label: '曼谷' },
  { key: 'taipei', label: '台北' },
];

// Section 4.2.8：localStorage key for「最近搜尋」 (recent dest names) — 取 5
// 個 most-recent，selectPoi 時 push 到 head。儲 string array，max 5。
const LS_KEY_RECENT_DESTS = 'tripline:newtrip:recent-dests';
const RECENT_DESTS_MAX = 5;

function loadRecentDests(): string[] {
  const raw = lsGet<string[]>(LS_KEY_RECENT_DESTS);
  if (!Array.isArray(raw)) return [];
  return raw.filter((s) => typeof s === 'string').slice(0, RECENT_DESTS_MAX);
}

function pushRecentDest(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const cur = loadRecentDests();
  const next = [trimmed, ...cur.filter((d) => d !== trimmed)].slice(0, RECENT_DESTS_MAX);
  lsSet(LS_KEY_RECENT_DESTS, next);
}

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
  max-width: 720px;
  font: inherit;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* QA 2026-04-26 PR-M：限制 modal 高度 + 讓 form pane 內捲，避免 mobile 內容
   * 被 viewport / iOS home indicator / chrome bottom-nav 切到。32px = 上下
   * backdrop padding 各 16。dvh 走 dynamic viewport 對應 Safari URL bar。 */
  max-height: calc(100dvh - 32px);
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
  padding-bottom: 0;
}
@media (min-width: 768px) {
  .tp-new-form {
    padding: 28px 32px;
    padding-bottom: 0;
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
  /* mockup-parity-qa-fixes: mockup spec 700（曾為 800） */
  font-size: var(--font-size-title, 1.75rem);
  font-weight: 700;
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

/* Destination autocomplete dropdown + selected POI chips
 * Section 4.2 (terracotta-ui-parity-polish): chips → 縱向 sortable rows
 * with grip handle + 編號 + remove。對齊 mockup section 03 (line 5996+)。 */
.tp-new-dest-rows {
  display: flex; flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}
.tp-new-dest-row {
  display: grid;
  grid-template-columns: 24px 28px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  min-height: 44px;
  font-size: var(--font-size-footnote);
}
.tp-new-dest-row.is-dragging {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
}
.tp-new-dest-grip {
  cursor: grab;
  color: var(--color-muted);
  display: grid; place-items: center;
  width: 24px; height: 24px;
}
.tp-new-dest-grip:active { cursor: grabbing; }
.tp-new-dest-grip .svg-icon { width: 14px; height: 14px; }
.tp-new-dest-num {
  width: 28px; height: 28px;
  border-radius: 50%;
  display: grid; place-items: center;
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  font-weight: 700;
  font-size: var(--font-size-caption);
}
.tp-new-dest-name {
  min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-weight: 600;
  color: var(--color-foreground);
}
.tp-new-dest-name .tp-new-dest-region {
  margin-left: 6px;
  color: var(--color-muted);
  font-weight: 500;
}
.tp-new-dest-remove {
  width: 28px; height: 28px;
  border: 0; background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  border-radius: 50%;
  display: grid; place-items: center;
}
.tp-new-dest-remove:hover { background: var(--color-hover); color: var(--color-destructive); }
.tp-new-dest-remove .svg-icon { width: 14px; height: 14px; }
.tp-new-dest-helper {
  margin: 0 0 10px;
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
}

/* Section 4.2.10：day quota stepper — multi-dest 分配天數 */
.tp-new-quota {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-secondary);
  display: flex; flex-direction: column; gap: 10px;
}
.tp-new-quota-header {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: var(--font-size-footnote);
}
.tp-new-quota-title { font-weight: 700; color: var(--color-foreground); }
.tp-new-quota-sum { color: var(--color-muted); font-variant-numeric: tabular-nums; }
.tp-new-quota-sum.is-mismatch { color: var(--color-priority-high-dot, #c0392b); font-weight: 700; }
.tp-new-quota-rows {
  display: flex; flex-direction: column; gap: 6px;
}
.tp-new-quota-row {
  display: grid; grid-template-columns: 24px 1fr auto; align-items: center;
  gap: 10px; padding: 6px 0;
  font-size: var(--font-size-footnote);
}
.tp-new-quota-num {
  width: 24px; height: 24px; border-radius: 50%;
  background: var(--color-accent); color: var(--color-accent-foreground);
  display: grid; place-items: center;
  font-weight: 700; font-size: var(--font-size-caption2);
}
.tp-new-quota-name { font-weight: 600; color: var(--color-foreground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-new-quota-stepper { display: inline-flex; align-items: center; gap: 6px; }
.tp-new-quota-step-btn {
  width: 28px; height: 28px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-foreground);
  border-radius: var(--radius-md);
  font: inherit; font-weight: 700;
  cursor: pointer;
}
.tp-new-quota-step-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
.tp-new-quota-step-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.tp-new-quota-value {
  min-width: 32px; text-align: center;
  font-weight: 700; font-variant-numeric: tabular-nums;
}

/* Section 4.2.8：「熱門 / 最近」 chip groups — 顯示在 destination input 下方 */
.tp-new-dest-chip-group {
  display: flex; flex-direction: column; gap: 6px;
  margin-bottom: 12px;
}
.tp-new-dest-chip-group-label {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
  font-weight: 600;
  letter-spacing: 0.04em;
}
.tp-new-dest-chip-group-list {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.tp-new-dest-chip-quick {
  border: 1px solid var(--color-border);
  background: var(--color-background);
  padding: 6px 12px;
  border-radius: var(--radius-full);
  font: inherit; font-size: var(--font-size-footnote);
  color: var(--color-foreground); cursor: pointer;
  min-height: 32px;
}
.tp-new-dest-chip-quick:hover {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  border-color: var(--color-accent);
}

/* Legacy chips fallback (other usages) */
.tp-new-dest-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.tp-new-dest-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  min-height: 36px;
  padding: 8px 10px 8px 12px;
  border-radius: var(--radius-full);
  background: var(--color-accent-subtle);
  border: 1px solid var(--color-accent);
  color: var(--color-accent-deep);
  font-size: var(--font-size-footnote);
  font-weight: 700;
}
.tp-new-dest-chip span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tp-new-dest-chip button {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  border: 0;
  background: var(--color-background);
  color: var(--color-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
}
.tp-new-dest-chip button:hover {
  color: var(--color-accent-deep);
}
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
  position: sticky;
  bottom: 0;
  display: flex; gap: 8px; justify-content: flex-end; align-items: center;
  margin: 20px -24px 0;
  padding: 16px 24px max(16px, env(safe-area-inset-bottom, 16px));
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-background) 94%, transparent);
  backdrop-filter: blur(var(--blur-glass, 14px));
  -webkit-backdrop-filter: blur(var(--blur-glass, 14px));
}
@media (min-width: 768px) {
  .tp-new-modal-actions {
    margin-left: -32px;
    margin-right: -32px;
    padding-left: 32px;
    padding-right: 32px;
  }
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

/* Section 4.2：sortable destination list — 內部 SortableContext + 每 row 用
 * useSortable hook 產 transform，drop 透過 parent onReorder callback 改 array。
 * Single 1 dest 也 render row 但 grip disabled visually (cursor default)。 */
interface SortableDestinationRowProps {
  poi: PoiSearchResult;
  index: number;
  onRemove: (osmId: number) => void;
}

function SortableDestinationRow({ poi, index, onRemove }: SortableDestinationRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: poi.osm_id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`tp-new-dest-row ${isDragging ? 'is-dragging' : ''}`}
      data-testid={`new-trip-destination-row-${poi.osm_id}`}
    >
      <button
        type="button"
        className="tp-new-dest-grip"
        aria-label={`拖移目的地：${poi.name}`}
        {...attributes}
        {...listeners}
      >
        <Icon name="arrows-vertical" />
      </button>
      <span className="tp-new-dest-num" aria-hidden="true">{index + 1}</span>
      <span className="tp-new-dest-name">
        {poi.name}
        {poi.country && <span className="tp-new-dest-region">{poi.country}</span>}
      </span>
      <button
        type="button"
        className="tp-new-dest-remove"
        onClick={() => onRemove(poi.osm_id)}
        aria-label={`移除目的地：${poi.name}`}
      >
        <Icon name="x-mark" />
      </button>
    </div>
  );
}

interface SortableDestinationListProps {
  pois: PoiSearchResult[];
  onReorder: (fromIdx: number, toIdx: number) => void;
  onRemove: (osmId: number) => void;
}

function SortableDestinationList({ pois, onReorder, onRemove }: SortableDestinationListProps) {
  function handleDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const fromIdx = pois.findIndex((p) => p.osm_id === e.active.id);
    const toIdx = pois.findIndex((p) => p.osm_id === e.over!.id);
    if (fromIdx < 0 || toIdx < 0) return;
    onReorder(fromIdx, toIdx);
  }
  return (
    <DndContext
      collisionDetection={closestCenter}
      accessibility={TP_DRAG_ACCESSIBILITY}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={pois.map((p) => p.osm_id)} strategy={verticalListSortingStrategy}>
        <div className="tp-new-dest-rows" data-testid="new-trip-destination-rows">
          {pois.map((p, i) => (
            <SortableDestinationRow key={p.osm_id} poi={p} index={i} onRemove={onRemove} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export interface NewTripModalProps {
  open: boolean;
  ownerEmail: string;
  onClose: () => void;
  onCreated: (tripId: string) => void;
}

type DateMode = 'select' | 'flexible';

export default function NewTripModal({ open, ownerEmail, onClose, onCreated }: NewTripModalProps) {
  // Destination uses POI autocomplete. User can select multiple POIs; chips are
  // the submitted destinations and provide reliable country metadata.
  const [destQuery, setDestQuery] = useState('');
  const [selectedPois, setSelectedPois] = useState<PoiSearchResult[]>([]);
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
  // Section 4.2.8：recent dests state — modal open 時 load 一次。selectPoi 後
  // re-load 反映新 push 進 head 的 entry。
  const [recentDests, setRecentDests] = useState<string[]>([]);

  // Section 4.2.10：multi-dest day quota — Record<osm_id, day_count>。
  // 顯示 stepper 給 user 分配每 dest 天數，總和 ↔ trip total days 同步驗證。
  // 預設 evenly split (or +1 落在前段 dest 處理 remainder)。submit 時 append
  // 「目的地天數分配」到 preferences 給 AI consume。
  const [destDays, setDestDays] = useState<Record<number, number>>({});

  const monthChoices = useMemo(() => buildMonthChoices(new Date()), [open]);
  const [flexMonth, setFlexMonth] = useState<string>(() => monthChoices[0]?.key ?? '');

  useEffect(() => {
    if (!open) {
      setDestQuery('');
      setSelectedPois([]);
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
      setRecentDests(loadRecentDests());
      setDestDays({});
    }
  }, [open, monthChoices]);

  // Section 4.2.10：compute total trip days from current date mode。
  const totalTripDays = useMemo(() => {
    if (dateMode === 'flexible') return flexDays;
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const diff = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    return Number.isFinite(diff) && diff > 0 ? diff : 0;
  }, [dateMode, startDate, endDate, flexDays]);

  // Section 4.2.10：分配 trip total days 到 dest，evenly split + remainder
  // 前段累加。每次 dest list / total 變動時 reset 為 even split (但保留 user
  // 手動 override 的值，前提是 sum 不超 total)。
  useEffect(() => {
    if (selectedPois.length < 2 || totalTripDays <= 0) {
      setDestDays({});
      return;
    }
    const perDest = Math.floor(totalTripDays / selectedPois.length);
    const remainder = totalTripDays - perDest * selectedPois.length;
    const next: Record<number, number> = {};
    selectedPois.forEach((p, i) => {
      next[p.osm_id] = perDest + (i < remainder ? 1 : 0);
    });
    setDestDays(next);
  }, [selectedPois, totalTripDays]);

  const destDaysSum = useMemo(
    () => selectedPois.reduce((s, p) => s + (destDays[p.osm_id] ?? 0), 0),
    [selectedPois, destDays],
  );

  function bumpDestDays(osmId: number, delta: number) {
    setDestDays((prev) => {
      const cur = prev[osmId] ?? 0;
      const next = Math.max(0, cur + delta);
      return { ...prev, [osmId]: next };
    });
  }

  // Debounced POI search — 同 InlineAddPoi 250ms pattern，但 lower min len 2。
  useEffect(() => {
    if (!open) return;
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
  }, [destQuery, open]);

  function selectPoi(poi: PoiSearchResult) {
    setSelectedPois((prev) => (
      prev.some((p) => p.osm_id === poi.osm_id) ? prev : [...prev, poi]
    ));
    setDestQuery('');
    setPoiResults(null);
    setPoiSearchError(null);
    // Section 4.2.8：push to localStorage recent list 給下次 modal 預顯示
    pushRecentDest(poi.name);
    setRecentDests(loadRecentDests());
  }

  function reorderSelectedPois(fromIdx: number, toIdx: number) {
    setSelectedPois((prev) => arrayMove(prev, fromIdx, toIdx));
  }
  function removeSelectedPoi(osmId: number) {
    setSelectedPois((prev) => prev.filter((p) => p.osm_id !== osmId));
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
  const canSubmit = selectedPois.length > 0 && datesValid && !submitting;

  function adjustFlexDays(delta: number) {
    setFlexDays((d) => Math.min(MAX_FLEX_DAYS, Math.max(MIN_FLEX_DAYS, d + delta)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || selectedPois.length === 0) return;
    setSubmitting(true);
    setError(null);
    const tripName = selectedPois.map((poi) => poi.name).join('、');
    const tripId = genTripId(tripName);
    const dates = dateMode === 'flexible'
      ? flexDatesFromMonth(flexMonth, flexDays)
      : { start: startDate, end: endDate };
    const countries = Array.from(new Set(selectedPois.map((poi) => poi.country || 'JP'))).join(',');
    // Section 4.2.10：multi-dest day quota append 到 preferences 給 AI consume，
    // schema 用「目的地天數分配：沖繩 3 天 / 京都 2 天」 自然語言
    let combinedDescription = preferences.trim();
    if (selectedPois.length >= 2 && totalTripDays > 0 && destDaysSum === totalTripDays) {
      const allocation = selectedPois
        .map((p) => `${p.name} ${destDays[p.osm_id] ?? 0} 天`)
        .join(' / ');
      const note = `目的地天數分配：${allocation}`;
      combinedDescription = combinedDescription ? `${combinedDescription}\n\n${note}` : note;
    }
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
          description: combinedDescription || undefined,
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

  const destShown = selectedPois.map((poi) => poi.name).join('、');
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
          <Icon name="x-mark" />
        </button>
        {/* Form pane */}
        <div className="tp-new-form">
          <h2 id="new-trip-title">新增行程</h2>

          <div className="tp-new-form-row">
            <label htmlFor="new-trip-destination">目的地（可加多筆，拖拉排序）</label>
            <div className="tp-new-dest-wrap">
              {selectedPois.length > 0 && (
                <SortableDestinationList
                  pois={selectedPois}
                  onReorder={reorderSelectedPois}
                  onRemove={removeSelectedPoi}
                />
              )}
              {selectedPois.length >= 2 && (
                <p className="tp-new-dest-helper" data-testid="new-trip-destination-helper">
                  行程跨 {selectedPois.length} 個目的地 · 順序決定地圖 polyline 串接方向
                </p>
              )}
              {selectedPois.length >= 2 && totalTripDays > 0 && (
                <div className="tp-new-quota" data-testid="new-trip-quota">
                  <div className="tp-new-quota-header">
                    <span className="tp-new-quota-title">分配天數</span>
                    <span
                      className={`tp-new-quota-sum ${destDaysSum !== totalTripDays ? 'is-mismatch' : ''}`}
                      data-testid="new-trip-quota-sum"
                    >
                      已分配 {destDaysSum} / {totalTripDays} 天
                    </span>
                  </div>
                  <div className="tp-new-quota-rows">
                    {selectedPois.map((p, i) => (
                      <div key={p.osm_id} className="tp-new-quota-row" data-testid={`new-trip-quota-row-${p.osm_id}`}>
                        <span className="tp-new-quota-num" aria-hidden="true">{i + 1}</span>
                        <span className="tp-new-quota-name">{p.name}</span>
                        <div className="tp-new-quota-stepper">
                          <button
                            type="button"
                            className="tp-new-quota-step-btn"
                            onClick={() => bumpDestDays(p.osm_id, -1)}
                            disabled={(destDays[p.osm_id] ?? 0) <= 0}
                            aria-label={`${p.name} 減 1 天`}
                            data-testid={`new-trip-quota-minus-${p.osm_id}`}
                          >
                            −
                          </button>
                          <span className="tp-new-quota-value" data-testid={`new-trip-quota-value-${p.osm_id}`}>
                            {destDays[p.osm_id] ?? 0}
                          </span>
                          <button
                            type="button"
                            className="tp-new-quota-step-btn"
                            onClick={() => bumpDestDays(p.osm_id, +1)}
                            aria-label={`${p.name} 加 1 天`}
                            data-testid={`new-trip-quota-plus-${p.osm_id}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <input
                id="new-trip-destination"
                type="text"
                value={destQuery}
                onChange={(e) => setDestQuery(e.target.value)}
                placeholder={selectedPois.length > 0 ? '繼續搜尋下一個目的地…' : '搜尋景點、城市、地址…'}
                required={selectedPois.length === 0}
                autoFocus
                autoComplete="off"
                data-testid="new-trip-destination-input"
              />
              {/* POI dropdown. User must select at least one real POI before submit. */}
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
            </div>

            {/* Section 4.2.8：「熱門 / 最近」 chip groups — 只在 dropdown 沒打開
              * 且 user 還沒輸入 query 時顯示，避免與 search results 視覺競爭 */}
            {destQuery.trim().length === 0 && (
              <>
                <div className="tp-new-dest-chip-group" data-testid="new-trip-popular-dests">
                  <div className="tp-new-dest-chip-group-label">熱門目的地</div>
                  <div className="tp-new-dest-chip-group-list">
                    {POPULAR_DESTINATIONS.map((d) => (
                      <button
                        key={d.key}
                        type="button"
                        className="tp-new-dest-chip-quick"
                        onClick={() => setDestQuery(d.label)}
                        data-testid={`new-trip-popular-dest-${d.key}`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                {recentDests.length > 0 && (
                  <div className="tp-new-dest-chip-group" data-testid="new-trip-recent-dests">
                    <div className="tp-new-dest-chip-group-label">最近搜尋</div>
                    <div className="tp-new-dest-chip-group-list">
                      {recentDests.map((name) => (
                        <button
                          key={name}
                          type="button"
                          className="tp-new-dest-chip-quick"
                          onClick={() => setDestQuery(name)}
                          data-testid={`new-trip-recent-dest-${name}`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
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
                固定日期
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={dateMode === 'flexible'}
                className={dateMode === 'flexible' ? 'is-active' : ''}
                onClick={() => setDateMode('flexible')}
                data-testid="new-trip-date-mode-flexible"
              >
                大概時間
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
