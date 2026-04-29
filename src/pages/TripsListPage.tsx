/**
 * TripsListPage — V2 trip landing page (mockup-trip-v2.html parity)
 *
 * Route: /trips
 *
 * Layout:
 *   - Desktop ≥1024px: 3-pane via AppShell (sidebar | trip card grid | preview sheet)
 *   - Mobile <1024px: 2-pane (sidebar hidden, card grid stacked, no preview sheet)
 *
 * Interaction:
 *   - Card click (both viewports): setSearchParams('selected', tripId).
 *     Mobile renders embedded TripPage as full-screen main; desktop swaps the
 *     right sheet to that trip. No /trip/:id navigation.
 *   - Trailing card "+ 新增行程" / empty hero CTA / sidebar new-trip button:
 *     all open NewTripModal, which POSTs /api/trips and selects the new trip.
 *
 * Data:
 *   - GET /api/my-trips → tripIds the user has permission for
 *   - GET /api/trips?all=1 → trip metadata (name, countries, day_count,
 *     start_date, end_date, member_count)
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useNewTrip } from '../contexts/NewTripContext';
import { apiFetchRaw } from '../lib/apiClient';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import TripCardMenu from '../components/trip/TripCardMenu';
import InfoSheet from '../components/trip/InfoSheet';
import CollabSheet from '../components/trip/CollabSheet';
import Icon from '../components/shared/Icon';
import ToastContainer, { showToast } from '../components/shared/Toast';
import ErrorBanner from '../components/shared/ErrorBanner';
import TripPage, { type TripPageHandle } from './TripPage';
import { useActiveTrip } from '../contexts/ActiveTripContext';

const SCOPED_STYLES = `
/* Terracotta preview v2 Section 16 parity: desktop 240px auto-fill cards,
 * compact 2-column cards, and embedded trip detail remains full-page. */
.tp-trips-shell {
  min-height: 100%;
  padding: 32px 16px 64px;
  background: var(--color-secondary);
  height: 100%;
  overflow-y: auto;
}
.tp-trips-inner { max-width: 1100px; margin: 0 auto; }

/* heading 改用統一 <PageHeader>。.tp-trips-heading 已退役。 */

.tp-trips-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 24px;
}

/* PR-NN 2026-04-26：mobile embedded mode 改成完整 mobile-topbar 模式
 * （對齊 docs/design-sessions/mockup-trip-v2.html line 438 .mobile-topbar）。
 * 取代 PR-AA 的 floating sticky back btn — 那個獨佔一行、跟 mockup 不符。
 *
 * 結構：[← back btn] [trip name] — 56px 全寬、sticky top、glass blur。 */
.tp-embedded-trip {
  position: relative;
  display: flex; flex-direction: column;
  height: 100%;
  min-height: 100%;
}
/* PR-QQ 2026-04-27：對齊 mockup-trip-selected-v1.html Variant A
 * （+ B 的單行 title）— 對齊 mockup-trip-v2.html line 438 .mobile-topbar
 * canonical 規格：56px 高、16px padding、glass blur、border-bottom hairline。
 * Back btn 36×36 帶 border + bg-background = mockup .icon-btn pattern，比原
 * 40×40 transparent 更貼齊 mockup affordance。Title 17px bold 單行，
 * 不加 day eyebrow（保持簡潔）。 */
/* embedded topbar 改用統一 <PageHeader variant="sticky">。
 * 舊 .tp-embedded-topbar / -back / -trip-name / -actions CSS 已退役。
 * .tp-embedded-trip 仍是 wrapper（含 height: 100%），保留。
 * .tp-embedded-menu* 給 EmbeddedActionMenu sub-component 用，保留。 */
.tp-embedded-menu-trigger {
  width: 36px; height: 36px;
  border-radius: var(--radius-md);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  color: var(--color-foreground);
  display: grid; place-items: center;
  cursor: pointer;
  font: inherit;
  flex-shrink: 0;
  transition: border-color 120ms, color 120ms, background 120ms;
}
.tp-embedded-menu-trigger:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-subtle);
}
.tp-embedded-menu-trigger:focus-visible {
  outline: 2px solid var(--color-accent); outline-offset: 2px;
}
.tp-embedded-menu-trigger .svg-icon { width: 18px; height: 18px; }

.tp-embedded-menu {
  position: fixed;
  min-width: 200px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  z-index: var(--z-modal, 9000);
  display: flex; flex-direction: column;
  gap: 1px;
}
.tp-embedded-menu-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  border: none; background: transparent;
  font: inherit; font-size: var(--font-size-callout);
  color: var(--color-foreground);
  text-align: left;
  cursor: pointer;
  border-radius: var(--radius-sm);
  min-height: 40px;
}
.tp-embedded-menu-item:hover { background: var(--color-hover); }
.tp-embedded-menu-item:focus-visible {
  outline: 2px solid var(--color-accent); outline-offset: -2px;
}
.tp-embedded-menu-item .svg-icon { width: 16px; height: 16px; flex-shrink: 0; color: var(--color-muted); }
.tp-embedded-menu-divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}
.tp-embedded-menu-section-label {
  font-size: var(--font-size-caption2);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-muted);
  padding: 8px 12px 4px;
}
@media (min-width: 1024px) {
  .tp-trips-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }
}
/* PR-Q 2026-04-26：每張 trip card 加 ... menu。card 改 wrapper（position:
 * relative）裝 button + menu trigger 兩個 children，避免 button-in-button。 */
.tp-trip-card-wrap {
  position: relative;
}
.tp-trip-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 0;
  text-decoration: none;
  color: inherit;
  transition: border-color 120ms, box-shadow 120ms, transform 120ms;
  display: flex; flex-direction: column;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  width: 100%;
  height: 100%;
  min-height: 180px;
  overflow: hidden;
}
.tp-trip-card:hover {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
.tp-trip-card.is-active {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
}
.tp-trip-card.is-active::before {
  content: "";
  position: absolute;
  top: 12px;
  left: 12px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--color-accent);
  z-index: 2;
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-trip-card-cover {
  height: 88px;
  background: var(--color-tertiary);
  flex-shrink: 0;
}
.tp-trip-card-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 14px 16px 16px;
  gap: 6px;
}
.tp-trip-cover-jp { background-image: linear-gradient(135deg, var(--color-cover-jp-from) 0%, var(--color-cover-jp-to) 100%); }
.tp-trip-cover-kr { background-image: linear-gradient(135deg, var(--color-cover-kr-from) 0%, var(--color-cover-kr-to) 100%); }
.tp-trip-cover-tw { background-image: linear-gradient(135deg, var(--color-cover-tw-from) 0%, var(--color-cover-tw-to) 100%); }
.tp-trip-cover-other { background-image: linear-gradient(135deg, var(--color-cover-other-from) 0%, var(--color-cover-other-to) 100%); }

.tp-trip-card-eyebrow {
  font-size: var(--font-size-eyebrow);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}
.tp-trip-card-title {
  font-size: var(--font-size-body);
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.35;
  color: var(--color-foreground);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tp-trip-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
  margin-top: auto;
  padding-top: 8px;
}
.tp-trip-card-meta:empty { display: none; }
.tp-trip-card-meta-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Section 4.7：trips toolbar — filter subtabs + sort + search expanding */
.tp-trips-toolbar {
  display: flex; align-items: center; gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.tp-trips-tabs {
  display: inline-flex; align-items: center;
  background: var(--color-secondary);
  border-radius: var(--radius-full);
  padding: 4px;
}
.tp-trips-tab {
  border: 0; background: transparent; cursor: pointer;
  padding: 6px 14px; border-radius: var(--radius-full);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-muted);
  display: inline-flex; align-items: center; gap: 6px;
  min-height: 32px;
}
.tp-trips-tab:hover { color: var(--color-foreground); }
.tp-trips-tab.is-active {
  background: var(--color-background);
  color: var(--color-accent);
  box-shadow: var(--shadow-sm);
}
.tp-trips-tab-count {
  font-size: var(--font-size-caption2);
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--color-secondary);
  color: var(--color-muted);
}
.tp-trips-tab.is-active .tp-trips-tab-count {
  background: var(--color-accent-subtle);
  color: var(--color-accent);
}
.tp-trips-sort {
  border: 1px solid var(--color-border);
  background: var(--color-background);
  border-radius: var(--radius-full);
  padding: 6px 12px;
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-foreground); cursor: pointer;
  min-height: 32px;
}
.tp-trips-search {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 4px 8px 4px 10px;
  min-height: 32px;
  transition: width 160ms ease;
  width: 36px; overflow: hidden;
}
.tp-trips-search.is-open { width: 220px; }
.tp-trips-search input {
  flex: 1; min-width: 0;
  border: 0; background: transparent;
  font: inherit; font-size: var(--font-size-footnote); outline: none;
  color: var(--color-foreground);
}
.tp-trips-search-toggle {
  border: 0; background: transparent; cursor: pointer;
  display: grid; place-items: center;
  width: 24px; height: 24px;
  color: var(--color-muted); flex-shrink: 0;
}
.tp-trips-search-toggle:hover { color: var(--color-foreground); }
.tp-trips-search-toggle .svg-icon { width: 16px; height: 16px; }
.tp-trips-search-count {
  font-size: var(--font-size-caption2); color: var(--color-muted);
}

/* Section 4.7：owner avatar — 32x32 circle with first letter fallback。 */
.tp-trip-card-avatar {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  display: grid; place-items: center;
  font: inherit; font-weight: 700; font-size: var(--font-size-caption2);
  flex-shrink: 0;
}

/* Trailing "新增行程" card — dashed outline, accent color */
.tp-trip-card-new {
  background: transparent;
  border: 2px dashed var(--color-border);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px;
  min-height: 200px;
  color: var(--color-muted);
  font-weight: 600;
  font-size: var(--font-size-callout);
  transition: border-color 120ms, color 120ms, background 120ms;
}
.tp-trip-card-new:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-subtle);
  transform: none;
  box-shadow: none;
}
.tp-trip-card-new .tp-new-icon {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  display: grid; place-items: center;
  font-size: 20px;
  font-weight: 700;
  transition: background 120ms;
}
.tp-trip-card-new:hover .tp-new-icon {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
}
@media (max-width: 760px) {
  .tp-trip-card {
    min-height: 160px;
  }
  .tp-trip-card-cover {
    height: 64px;
  }
  .tp-trip-card-body {
    padding: 10px 12px 12px;
    gap: 4px;
  }
  .tp-trip-card-eyebrow {
    font-size: 9px;
  }
  .tp-trip-card-title {
    font-size: 13px;
    line-height: 1.3;
  }
  .tp-trip-card-meta {
    font-size: var(--font-size-eyebrow);
    gap: 6px;
    padding-top: 6px;
  }
  .tp-trip-card-avatar {
    width: 18px;
    height: 18px;
    font-size: var(--font-size-eyebrow);
  }
  .tp-trip-card-new {
    min-height: 160px;
    padding: 16px 8px;
  }
  .tp-trip-card-new .tp-new-icon {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }
}

/* Empty state hero — when user has 0 trips */
.tp-trips-empty-hero {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 64px 32px;
  text-align: center;
  margin-top: 24px;
}
.tp-trips-empty-hero .tp-hero-icon {
  width: 72px; height: 72px;
  margin: 0 auto 20px;
  border-radius: 50%;
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  display: grid; place-items: center;
}
.tp-trips-empty-hero h2 {
  font-size: var(--font-size-title2);
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--color-foreground);
  margin: 0 0 8px;
}
.tp-trips-empty-hero p {
  color: var(--color-muted);
  font-size: var(--font-size-callout);
  max-width: 420px;
  margin: 0 auto 24px;
  line-height: 1.5;
}
.tp-trips-empty-hero .tp-hero-cta {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 14px 28px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  font-weight: 700;
  font-size: var(--font-size-callout);
  text-decoration: none;
  cursor: pointer;
}
.tp-trips-empty-hero .tp-hero-cta:hover { filter: brightness(0.92); }

.tp-trips-loading, .tp-trips-error {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 48px 24px;
  text-align: center;
  color: var(--color-muted);
  margin-top: 24px;
}
.tp-trips-error { color: var(--color-destructive); }
`;

interface MyTripRow {
  tripId: string;
}

interface TripInfo {
  tripId: string;
  name: string;
  owner?: string;
  title?: string | null;
  countries?: string | null;
  published?: number | boolean;
  /* mockup-parity-qa-fixes: API 透過 functions/api/_utils.ts deepCamel() 把 SQL snake_case 轉
   * camelCase。既有 day_count/start_date/member_count interface 是 stale bug — runtime 永遠
   * undefined，導致 eyebrow 不顯示「· N 天」、card meta 缺日期。改 camelCase 對齊實際 response。 */
  dayCount?: number;
  startDate?: string | null;
  endDate?: string | null;
  memberCount?: number;
  archivedAt?: string | null;
}

function coverClass(countries: string | null | undefined): string {
  const c = (countries ?? '').toUpperCase().trim();
  if (c.includes('JP')) return 'tp-trip-cover-jp';
  if (c.includes('KR')) return 'tp-trip-cover-kr';
  if (c.includes('TW')) return 'tp-trip-cover-tw';
  return 'tp-trip-cover-other';
}

function eyebrow(countries: string | null | undefined, dayCount: number | undefined): string {
  // Section 4.7 (terracotta-ui-parity-polish): mockup eyebrow 用中文 (line 6904)
  // 取代既有 「JAPAN · 12 DAYS」全英文。
  const c = (countries ?? '').toUpperCase().trim();
  const country =
    c.includes('JP') ? '日本' :
    c.includes('KR') ? '韓國' :
    c.includes('TW') ? '台灣' :
    c || '行程';
  if (typeof dayCount === 'number' && dayCount > 0) {
    return `${country} · ${dayCount} 天`;
  }
  return country;
}

function dateRange(start: string | null | undefined, end: string | null | undefined): string | null {
  function fmt(iso: string): string {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(iso);
    if (!m) return iso;
    return `${parseInt(m[2]!, 10)}/${parseInt(m[3]!, 10)}`;
  }
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return fmt(start);
  if (end) return fmt(end);
  return null;
}

function startDateMD(start: string | null | undefined): string | null {
  // mockup-parity-qa-fixes: 出發日「7/2 出發」格式 (mockup section 16:6908)
  if (!start) return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(start);
  if (!m) return null;
  return `${parseInt(m[2]!, 10)}/${parseInt(m[3]!, 10)} 出發`;
}

function cardMeta(trip: TripInfo): string {
  // mockup section 16:6906-6909 範例「張三李四 · 7/29 出發」 — meta 顯示「{owner} · M/D 出發」
  const startMD = startDateMD(trip.startDate);
  const range = dateRange(trip.startDate, trip.endDate);
  const members = typeof trip.memberCount === 'number' && trip.memberCount > 0
    ? `${trip.memberCount} 旅伴`
    : null;
  if (startMD && range) return `${startMD} · ${range}`;
  if (startMD) return startMD;
  if (range && members) return `${range} · ${members}`;
  if (range) return range;
  if (members) return members;
  return '';
}

/* PR-UU 2026-04-27：embedded topbar 漢堡選單 — 共編 / 列印 / 下載 (4 formats)。
 * 共編 走 host 的 setCollabTripId（既有 InfoSheet path）。
 * 列印 + 下載 走 TripPage forwardRef handle。 */
const MENU_WIDTH = 200;
const VIEWPORT_MARGIN = 8;

interface EmbeddedActionMenuProps {
  tripId: string;
  tripPageRef: React.RefObject<TripPageHandle | null>;
  onCollab: () => void;
}

function EmbeddedActionMenu({ tripId, tripPageRef, onCollab }: EmbeddedActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open) return;
    function recompute() {
      const btn = triggerRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const vw = window.innerWidth;
      let left = r.right - MENU_WIDTH;
      if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
      if (left + MENU_WIDTH > vw - VIEWPORT_MARGIN) left = vw - MENU_WIDTH - VIEWPORT_MARGIN;
      setPos({ top: r.bottom + 6, left });
    }
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    }
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target) && !triggerRef.current?.contains(target)) {
        close();
      }
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open, close]);

  function runAndClose(fn: () => void) {
    return () => { fn(); close(); };
  }

  const dropdown = open && pos ? createPortal((
    <div
      ref={menuRef}
      role="menu"
      className="tp-embedded-menu"
      style={{ top: pos.top, left: pos.left }}
      data-testid={`trip-embedded-menu-${tripId}`}
    >
      <button
        type="button"
        role="menuitem"
        className="tp-embedded-menu-item"
        onClick={runAndClose(onCollab)}
      >
        <Icon name="group" />
        <span>共編設定</span>
      </button>
      <div className="tp-embedded-menu-divider" />
      <button
        type="button"
        role="menuitem"
        className="tp-embedded-menu-item"
        onClick={runAndClose(() => tripPageRef.current?.togglePrint())}
      >
        <Icon name="printer" />
        <span>列印</span>
      </button>
      <div className="tp-embedded-menu-divider" />
      <span className="tp-embedded-menu-section-label">下載格式</span>
      <button
        type="button"
        role="menuitem"
        className="tp-embedded-menu-item"
        onClick={runAndClose(() => tripPageRef.current?.triggerDownload('pdf'))}
      >
        <Icon name="download" />
        <span>PDF</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="tp-embedded-menu-item"
        onClick={runAndClose(() => tripPageRef.current?.triggerDownload('md'))}
      >
        <Icon name="doc" />
        <span>Markdown</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="tp-embedded-menu-item"
        onClick={runAndClose(() => tripPageRef.current?.triggerDownload('json'))}
      >
        <Icon name="code" />
        <span>JSON</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="tp-embedded-menu-item"
        onClick={runAndClose(() => tripPageRef.current?.triggerDownload('csv'))}
      >
        <Icon name="table" />
        <span>CSV</span>
      </button>
    </div>
  ), document.body) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="tp-embedded-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="行程動作"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="trips-embedded-menu-trigger"
      >
        <Icon name="more-vert" />
      </button>
      {dropdown}
    </>
  );
}

export default function TripsListPage() {
  useRequireAuth();
  const { user } = useCurrentUser();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFromUrl = searchParams.get('selected');
  const { openModal: openNewTrip } = useNewTrip();

  const [myIds, setMyIds] = useState<string[] | null>(null);
  const [allTrips, setAllTrips] = useState<TripInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // PR-DD 2026-04-26：抽出 loadTrips 讓 mount + tp-trip-created event 都能觸發
  // refetch。User onion523 反應「行程後要切換功能才看的到新行程」 — TripsListPage
  // 原本只 mount 跑一次，新增完 navigate 過去 trip 詳情，回 list 看不到新 trip。
  const loadTrips = useCallback(async () => {
    try {
      const [myRes, allRes] = await Promise.all([
        fetch('/api/my-trips', { credentials: 'same-origin' }),
        fetch('/api/trips?all=1', { credentials: 'same-origin' }),
      ]);
      if (!myRes.ok) {
        if (myRes.status === 401 || myRes.status === 403) return;
        setError('無法載入你的行程清單。');
        return;
      }
      const myJson = (await myRes.json()) as MyTripRow[];
      setMyIds(myJson.map((r) => r.tripId));
      if (allRes.ok) {
        const allJson = (await allRes.json()) as TripInfo[];
        setAllTrips(allJson);
      } else {
        setAllTrips([]);
      }
    } catch {
      setError('網路連線失敗，請稍後再試。');
    }
  }, []);

  useEffect(() => { void loadTrips(); }, [loadTrips]);

  // PR-DD：聽 NewTripContext 在 POST trips 成功後 dispatch 的 event，re-fetch
  // list 拿新 trip。同 tab navigate 不會 remount TripsListPage，必須 explicit
  // refetch 才會更新。
  useEffect(() => {
    function onTripCreated() { void loadTrips(); }
    window.addEventListener('tp-trip-created', onTripCreated);
    return () => window.removeEventListener('tp-trip-created', onTripCreated);
  }, [loadTrips]);

  const myTrips = useMemo<TripInfo[]>(() => {
    if (myIds === null || allTrips === null) return [];
    const map = new Map<string, TripInfo>();
    for (const t of allTrips) map.set(t.tripId, t);
    return myIds.map((id) => map.get(id) ?? { tripId: id, name: id });
  }, [myIds, allTrips]);

  // Section 4.7：filter subtab + sort + search expanding bar — pure client-side
  // 操作 myTrips 已知子集合，避免重新打 /api。
  // mockup-parity-qa-fixes: 加「已歸檔」第 4 顆 filter tab
  const [filterTab, setFilterTab] = useState<'all' | 'mine' | 'collab' | 'archived'>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'start' | 'name'>('updated');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const userEmail = (user?.email ?? '').toLowerCase();

  const visibleTrips = useMemo<TripInfo[]>(() => {
    let list = [...myTrips];
    // 'archived' filter 取 archivedAt !== null；其他 filter 預設排除 archived（避免雜訊）
    if (filterTab === 'archived') {
      list = list.filter((t) => t.archivedAt != null);
    } else {
      list = list.filter((t) => t.archivedAt == null);
      if (filterTab === 'mine') {
        list = list.filter((t) => (t.owner ?? '').toLowerCase() === userEmail);
      } else if (filterTab === 'collab') {
        list = list.filter((t) => (t.owner ?? '').toLowerCase() !== userEmail);
      }
    }
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter((t) => {
        const haystack = `${t.title ?? ''} ${t.name ?? ''} ${t.countries ?? ''}`.toLowerCase();
        return haystack.includes(term);
      });
    }
    if (sortBy === 'name') {
      list.sort((a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || ''));
    } else if (sortBy === 'start') {
      list.sort((a, b) => {
        const av = a.startDate ?? '9999';
        const bv = b.startDate ?? '9999';
        return av < bv ? -1 : av > bv ? 1 : 0;
      });
    }
    // 'updated' 預設保留 myIds 順序（API 已 most-recent-first）
    return list;
  }, [myTrips, filterTab, sortBy, searchTerm, userEmail]);

  // For badge counts shown on filter subtabs — counts on the unfiltered set.
  const tabCounts = useMemo(() => {
    const active = myTrips.filter((t) => t.archivedAt == null);
    const archived = myTrips.length - active.length;
    const mine = active.filter((t) => (t.owner ?? '').toLowerCase() === userEmail).length;
    return { all: active.length, mine, collab: active.length - mine, archived };
  }, [myTrips, userEmail]);

  // Effective selected: URL param > first visible trip > null
  const effectiveSelectedId = useMemo<string | null>(() => {
    if (selectedFromUrl && visibleTrips.some((t) => t.tripId === selectedFromUrl)) {
      return selectedFromUrl;
    }
    return visibleTrips[0]?.tripId ?? null;
  }, [selectedFromUrl, visibleTrips]);

  // Both viewports: clicking a card sets ?selected=tripId. Mobile then
  // renders the embedded TripPage as full-screen main; desktop swaps the
  // right sheet to that trip. Per user direction the unified URL pattern is
  // /trips?selected=X (no /trip/:id route navigation).
  //
  // 2026-04-29 race fix: 同步寫 ActiveTripContext。原本 active trip 設定靠
  // embedded TripPage mount 後 useEffect 觸發 setActiveTrip，但如果 user
  // 點完 card 立刻走 bottom-nav 切到 /chat，TripPage 還沒 mount → ChatPage
  // 拿到舊 activeTripId，訊息會送錯 trip（lean.lean@gmail trip_requests:162
  // 的 sympton：台南內容送進沖繩 trip）。Card click 同步寫 context 解決。
  const { setActiveTrip } = useActiveTrip();
  function handleCardClick(tripId: string, e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault();
    setActiveTrip(tripId);
    const next = new URLSearchParams(searchParams);
    next.set('selected', tripId);
    setSearchParams(next, { replace: false });
  }

  // PR-OO 2026-04-26：⋯ 共編改 InfoSheet（跟 TripPage 共編 chip 同 sheet
  // 容器，桌機/手機 視覺一致）。原 PR-AA 走 CollabModal centered modal，跟
  // TripPage 的 InfoSheet slide-up 視覺不符 — 同一動作兩種容器。改 InfoSheet
  // 統一，CollabModal 已刪。trip 列表保持 visible 在背景。
  const [collabTripId, setCollabTripId] = useState<string | null>(null);
  /* PR-UU 2026-04-27：embedded TripPage forwardRef handle，給漢堡選單呼叫
   * 列印 / 下載 (TripPage 內部 state-bound handlers)。共編走 setCollabTripId。 */
  const tripPageRef = useRef<TripPageHandle>(null);
  const handleMenuCollab = useCallback(
    (tripId: string) => { setCollabTripId(tripId); },
    [],
  );

  // PR-Q：card kebab 「刪除行程」 → confirm + DELETE /api/trips/:id +
  // optimistic remove from local list（避免 user 等待 reload）。
  const handleMenuDelete = useCallback(
    async (tripId: string) => {
      const trip = visibleTrips.find((t) => t.tripId === tripId);
      const label = trip?.title || trip?.name || tripId;
      if (!window.confirm(`確定刪除「${label}」？此操作無法復原。`)) return;
      try {
        const r = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}`, { method: 'DELETE' });
        if (r.status === 403) throw new Error('僅行程擁有者或管理者可刪除');
        if (r.status === 404) throw new Error('行程不存在');
        if (!r.ok) throw new Error('刪除失敗，請稍後再試');
        showToast(`已刪除「${label}」`, 'success');
        // Optimistic local removal
        setMyIds((prev) => prev?.filter((id) => id !== tripId) ?? null);
        setAllTrips((prev) => prev?.filter((t) => t.tripId !== tripId) ?? null);
        // Clear ?selected= if user just deleted the open trip
        if (selectedFromUrl === tripId) {
          const next = new URLSearchParams(searchParams);
          next.delete('selected');
          setSearchParams(next, { replace: true });
        }
      } catch (err) {
        showToast((err as Error).message, 'error');
      }
    },
    [visibleTrips, selectedFromUrl, searchParams, setSearchParams],
  );

  const loading = myIds === null && !error;

  // Heading meta 已棄用 — mockup 規定 TitleBar 單行 chrome 不放 meta。
  // 行程數隱性，user 看 cards 自然知道；toolbar 子 tabs / search / 排序 留 future PR。

  // Mobile + ?selected → embedded TripPage IS the main content (full-screen
  // trip detail). Cards hide. Per user spec, /trips?selected=X is the unified
  // entry, no /trip/:id route navigation.
  /* PR-PP：去 sheet 後，embedded mode 不分 mobile/desktop — 兩邊都把 main
   * 換成滿版 TripPage（topbar [← back] [trip name] + timeline）。 */
  const showEmbeddedTrip = !!effectiveSelectedId && !!selectedFromUrl;

  const cardGridMain = (
    <>
      <ToastContainer />
      <div className="tp-trips-shell" data-testid="trips-list-page">
        <div className="tp-trips-inner">
          <TitleBar
            title="我的行程"
            actions={
              <button
                type="button"
                className="tp-titlebar-back"
                onClick={openNewTrip}
                aria-label="新增行程"
                data-testid="trips-list-new-trip-titlebar"
              >
                <Icon name="plus" />
              </button>
            }
          />

          {loading && (
            <div className="tp-trips-loading" data-testid="trips-list-loading">載入中…</div>
          )}

          {error && <ErrorBanner message={error} testId="trips-list-error" />}

          {!loading && !error && myTrips.length > 0 && (
            <div className="tp-trips-toolbar" data-testid="trips-list-toolbar">
              <div className="tp-trips-tabs" role="tablist" aria-label="行程分類">
                {([
                  { key: 'all', label: '全部', count: tabCounts.all },
                  { key: 'mine', label: '我的', count: tabCounts.mine },
                  { key: 'collab', label: '共編', count: tabCounts.collab },
                  { key: 'archived', label: '已歸檔', count: tabCounts.archived },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={filterTab === tab.key}
                    className={`tp-trips-tab ${filterTab === tab.key ? 'is-active' : ''}`}
                    onClick={() => setFilterTab(tab.key)}
                    data-testid={`trips-list-tab-${tab.key}`}
                  >
                    {tab.label}
                    <span className="tp-trips-tab-count">{tab.count}</span>
                  </button>
                ))}
              </div>
              <select
                className="tp-trips-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'updated' | 'start' | 'name')}
                data-testid="trips-list-sort"
                aria-label="排序方式"
              >
                <option value="updated">最新編輯</option>
                <option value="start">出發日近</option>
                <option value="name">名稱 A→Z</option>
              </select>
              <div className={`tp-trips-search ${searchOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="tp-trips-search-toggle"
                  onClick={() => {
                    setSearchOpen((o) => {
                      if (o) setSearchTerm('');
                      return !o;
                    });
                  }}
                  aria-label={searchOpen ? '關閉搜尋' : '開啟搜尋'}
                  data-testid="trips-list-search-toggle"
                >
                  <Icon name={searchOpen ? 'x-mark' : 'search'} />
                </button>
                {searchOpen && (
                  <>
                    <input
                      type="text"
                      placeholder="搜尋行程名稱或地區"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      autoFocus
                      data-testid="trips-list-search-input"
                      aria-label="搜尋行程"
                    />
                    {searchTerm && (
                      <span className="tp-trips-search-count" data-testid="trips-list-search-count">
                        {visibleTrips.length} 筆
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {!loading && !error && myTrips.length === 0 && (
            <div className="tp-trips-empty-hero" data-testid="trips-list-empty">
              <div className="tp-hero-icon" aria-hidden="true">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="6" width="18" height="14" rx="2" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <line x1="8" y1="3" x2="8" y2="7" />
                  <line x1="16" y1="3" x2="16" y2="7" />
                </svg>
              </div>
              {/* Section 4.7 (terracotta-ui-parity-polish): mockup line 7101-7102 文案 */}
              <h2>還沒有行程</h2>
              <p>建立第一個行程，開始規劃你的下一趟旅程。也可以從探索頁尋找靈感。</p>
              <button
                type="button"
                onClick={openNewTrip}
                className="tp-hero-cta"
                data-testid="trips-list-new-trip-hero"
              >
                <span style={{ fontSize: 18 }}>+</span>
                <span>新增行程</span>
              </button>
            </div>
          )}

          {!loading && !error && myTrips.length > 0 && visibleTrips.length === 0 && (
            <div className="tp-trips-loading" data-testid="trips-list-empty-filtered">
              {filterTab === 'archived'
                ? '目前沒有已歸檔行程。歸檔行程會在這裡顯示。'
                : '沒有符合條件的行程。試著切換分類或調整搜尋字。'}
              {filterTab === 'archived' && (
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  data-testid="trips-list-archived-reset"
                  style={{
                    marginLeft: 8,
                    background: 'transparent',
                    border: 0,
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  回到全部
                </button>
              )}
            </div>
          )}

          {visibleTrips.length > 0 && (
            <div className="tp-trips-grid">
              {visibleTrips.map((t) => {
                const isActive = isDesktop && t.tripId === effectiveSelectedId;
                const ownerEmail = (t.owner ?? '').trim();
                const ownerInitial = ownerEmail ? ownerEmail.charAt(0).toUpperCase() : '·';
                const ownerLabel = ownerEmail
                  ? (ownerEmail.toLowerCase() === userEmail ? '由你建立' : ownerEmail.split('@')[0])
                  : '';
                return (
                  <div key={t.tripId} className="tp-trip-card-wrap">
                    <button
                      type="button"
                      onClick={(e) => handleCardClick(t.tripId, e)}
                      className={`tp-trip-card ${isActive ? 'is-active' : ''}`}
                      data-testid={`trips-list-card-${t.tripId}`}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <div className={`tp-trip-card-cover ${coverClass(t.countries)}`} aria-hidden="true" />
                      <div className="tp-trip-card-body">
                        <div className="tp-trip-card-eyebrow">{eyebrow(t.countries, t.dayCount)}</div>
                        <h2 className="tp-trip-card-title">{t.title || t.name}</h2>
                        <div className="tp-trip-card-meta">
                          {ownerLabel && <span className="tp-trip-card-avatar" aria-hidden="true">{ownerInitial}</span>}
                          <span
                            className="tp-trip-card-meta-text"
                            data-testid={ownerLabel ? `trips-list-card-owner-${t.tripId}` : undefined}
                          >
                            {[ownerLabel, cardMeta(t)].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                      </div>
                    </button>
                    <TripCardMenu
                      tripId={t.tripId}
                      onCollab={handleMenuCollab}
                      onDelete={handleMenuDelete}
                    />
                  </div>
                );
              })}
              <button
                type="button"
                onClick={openNewTrip}
                className="tp-trip-card tp-trip-card-new"
                data-testid="trips-list-new-trip-card"
              >
                <span className="tp-new-icon" aria-hidden="true">+</span>
                <span>新增行程</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  // PR-PP 2026-04-26：架構改 2-pane，sheet 不再用，永遠 undefined。

  // PR-NN 2026-04-26：mobile embedded mode 改 .tp-embedded-topbar pattern
  // （[← back] [trip name]）。原 PR-AA floating back btn 自己一行 + 跟 mockup
  // mobile-topbar 不符，已棄用。
  function clearSelected() {
    /* Capture the trip id user was viewing BEFORE we drop ?selected — used
     * to restore keyboard focus to the originating card after re-render
     * (back-btn unmounts → focus would otherwise fall to <body>). */
    const targetId = effectiveSelectedId;
    const next = new URLSearchParams(searchParams);
    next.delete('selected');
    setSearchParams(next, { replace: false });
    if (targetId && typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        const card = document.querySelector(`[data-testid="trips-list-card-${targetId}"]`);
        if (card instanceof HTMLElement) card.focus();
      });
    }
  }

  const embeddedTrip = showEmbeddedTrip
    ? (allTrips ?? []).find((t) => t.tripId === effectiveSelectedId)
    : null;

  // Mobile route: when ?selected, render TripPage as main (replaces cards).
  // When no ?selected, render the card grid.
  const main = showEmbeddedTrip ? (
    <div className="tp-embedded-trip">
      <TitleBar
        title={embeddedTrip?.title || embeddedTrip?.name || '載入中…'}
        back={clearSelected}
        backLabel="返回行程列表"
        actions={effectiveSelectedId && (
          <>
            {/* Section 3 (terracotta-add-stop-modal)：embedded mode 也提供
              * 「加景點」 trigger，呼叫 TripPage exposed handle openAddStop。
              * 否則 user 在 /trips?selected= flow（主要 entry）找不到加景點。 */}
            <button
              type="button"
              className="tp-embedded-menu-trigger"
              onClick={() => tripPageRef.current?.openAddStop()}
              aria-label="加景點"
              title="加景點"
              data-testid="trip-add-stop-trigger"
            >
              <Icon name="plus" />
            </button>
            <EmbeddedActionMenu
              tripId={effectiveSelectedId}
              tripPageRef={tripPageRef}
              onCollab={() => setCollabTripId(effectiveSelectedId)}
            />
          </>
        )}
      />
      <TripPage ref={tripPageRef} tripId={effectiveSelectedId!} noShell />
    </div>
  ) : cardGridMain;

  return (
    <>
      {/* PR-TT 2026-04-27：SCOPED_STYLES hoist 到頂層，永遠注入。
       * 原本在 cardGridMain 內 → embedded mode 不渲染 cardGridMain → CSS
       * 沒注入 → .tp-embedded-topbar 用 <header> UA 預設 display: block，
       * 子元素 stack vertically (back btn + 共編 chip 變兩行)。 */}
      <style>{SCOPED_STYLES}</style>
      <AppShell
        sidebar={<DesktopSidebarConnected />}
        main={main}
        bottomNav={<GlobalBottomNav authed={!!user} />}
      />
      {/* PR-OO 2026-04-26：CollabModal → InfoSheet — 跟 TripPage 共編 chip
       * 同一 sheet 容器，桌機/手機 視覺一致 (slide-up sheet pattern)。 */}
      <InfoSheet
        open={!!collabTripId}
        title="共編設定"
        onClose={() => setCollabTripId(null)}
      >
        {collabTripId ? <CollabSheet tripId={collabTripId} /> : null}
      </InfoSheet>
    </>
  );
}
