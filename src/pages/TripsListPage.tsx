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
 *   - GET /api/my-trips → 使用者有權限的行程（含 name / countries / totalDays /
 *     startDate / endDate / memberCount）。2026-07-21 前另外抓 /trips?all=1 拿
 *     metadata，但那支對一般使用者降級成 published-only，行程改為不公開後
 *     名稱全空 → 卡片顯示 tripId。單一來源即可。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { readTripView } from '../lib/tripViewState';
import { useNewTrip } from '../contexts/NewTripContext';
import ImportTripButton from '../components/trips/ImportTripButton';
import { apiFetch, apiFetchRaw } from '../lib/apiClient';
import { ApiError } from '../lib/errors';
import { EVENT } from '../lib/events';
import AppShell from '../components/shell/AppShell';
import TripTitleSwitcher from '../components/shell/TripTitleSwitcher';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import AccountCircle from '../components/shell/AccountCircle';
import TripCardMenu from '../components/trip/TripCardMenu';
import ShareLinkModal from '../components/share/ShareLinkModal';
import TripActionsMenu from '../components/trip/TripActionsMenu';
// v2.18.0:CollabSheet → CollabPage(獨立路由),InfoSheet wrapper 移除
import Icon from '../components/shared/Icon';
import ToastContainer, { showToast } from '../components/shared/Toast';
import ConfirmModal from '../components/shared/ConfirmModal';
import ErrorBanner from '../components/shared/ErrorBanner';
import { TripSelect } from '../components/TripSelect';
import TripPage, { type TripPageHandle } from './TripPage';
import { useTripPageHandle } from '../contexts/TripPageHandleContext';
import { useTripMainPortal } from '../contexts/TripMainPortalContext';
import { TRIP_MAIN_PORTAL_ID } from '../lib/tripStackRoutes';
import { useActiveTrip } from '../contexts/ActiveTripContext';

const SCOPED_STYLES = `
/* Terracotta preview v2 Section 16 parity: desktop 240px auto-fill cards,
 * compact 2-column cards, and embedded trip detail remains full-page. */
.tp-trips-shell {
  min-height: 100%;
  background: var(--color-secondary);
  height: 100%;
  overflow-y: auto;
  /* TitleBar sticky 從 viewport edge 開始;inner 自己 handle 水平 padding。 */
}
.tp-trips-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 16px 64px;
}

/* heading 改用統一 <TitleBar>。.tp-trips-heading 已退役。 */

.tp-trips-grid {
  /* minmax(0, 1fr) 不是 1fr：1fr 的 min 是 auto，會被 card title 撐大讓第二
   * column 溢出 grid right edge。0 強制 min: 0 → column 等寬。 */
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 24px;
}

/* Block stacking — TitleBar (sticky) + TripPage 自然 stack。
 * 不能用 grid + height: 100% — 那會把 TitleBar 的 sticky containing block
 * 限制在 row 1 (64px) 內，捲動超過 viewport 高度 TitleBar 就被擠出。
 * 需要 containing block 跟 .tp-shell 一樣長,sticky 才能整段 viewport 黏住。 */
.tp-embedded-trip {
  position: relative;
  display: block;
  min-height: 100%;
}
/* .tp-embedded-menu* 樣式已抽到 TripActionsMenu.tsx（TRIP_ACTIONS_MENU_STYLES），
 * 該元件自己 render <style>，這裡不再重複定義。 */
@media (min-width: 1024px) {
  .tp-trips-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }
}
/* card wrapper 必須 position: relative — kebab menu trigger absolute positioned。
 * 兩個 sibling button 取代 button-in-button (a11y + nested click target 衝突)。 */
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
  border-radius: var(--radius-full);
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
/* v2.54.8「依目的地三色切換」：行程卡依 destinationTone(countries) 整卡同色（mockup V3）。
   日本=accent 柔褐／台灣=sage／韓國=pink／其餘 hash 輪替。cover 用 tone 漸層、卡身 tone 淡底、
   hover/選取框與選取點都跟 tone。字一律 --color-foreground / --color-muted（不用 --t-deep
   當字 —— light mode sage/粉 -deep 對 -subtle 對比 <4.5:1；色由 cover 漸層 + 卡底承載）。 */
/* v2.55.89 V3 Phase 3：行程卡去封面 + neutral surface（design.md「行程頁不用封面」+ §2.3
   「所有卡同一 system surface」）。destination 三色退場 → 卡身中性 secondary；--t 保留柔褐
   供 hover/選取框/avatar 承載 accent。 */
.tp-trip-card[data-tone="accent"],
.tp-trip-card[data-tone="sage"],
.tp-trip-card[data-tone="pink"] { --t: var(--color-accent); --t-deep: var(--color-accent-deep); --t-subtle: var(--color-secondary); --t-bg: var(--color-tertiary); }
.tp-trip-card[data-tone] { background: var(--t-subtle); border-color: var(--color-border); }
.tp-trip-card[data-tone]:hover { border-color: var(--t); }
.tp-trip-card[data-tone].is-active { border-color: var(--t); }
.tp-trip-card[data-tone].is-active::before { background: var(--t); box-shadow: 0 0 0 3px var(--t-subtle); }
.tp-trip-card[data-tone] .tp-trip-card-avatar { background: var(--t-bg); color: var(--color-foreground); }

.tp-trip-card-eyebrow {
  font-size: var(--font-size-eyebrow);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
  /* owner 2026-07-19：卡頂右上 ⋯（absolute right:6 + 32px）會蓋到 eyebrow/標題文字（手機長
   * 標題尤明顯）。eyebrow + 標題加 padding-right 讓文字讓開 ⋯ 佔位。 */
  padding-right: 26px;
}
.tp-trip-card-title {
  font-size: var(--font-size-body);
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.35;
  color: var(--color-foreground);
  margin: 0;
  padding-right: 26px;
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
/* v2.18.0:tabs 在窄螢幕(375px)會把「全部 N」 文字壓到換行(每 tab ~85px)。
 * 改 horizontal scroll 對齊 mockup .tp-add-subtab pattern — tab 不換行,
 * user 滑動切換。Inner-flex 不必 flex:1 等寬,讓內容自然寬度。 */
.tp-trips-tabs {
  display: inline-flex; align-items: center;
  /* §2（owner「功能 tab 一片白色」）：原 --color-secondary 容器與 --color-background
   * active thumb 幾乎同色（#FAF4EA vs #FFFBF5），只靠弱 shadow-sm 分隔 → thumb 讀不出、
   * 整條像一片白色塊。改用略深暖底 track + inset 邊界界定，讓白 thumb 明確浮起。 */
  background: var(--color-hover);
  box-shadow: inset 0 0 0 1px var(--color-border);
  border-radius: var(--radius-full);
  padding: 4px;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none; /* Firefox */
}
.tp-trips-tabs::-webkit-scrollbar { display: none; }
.tp-trips-tab {
  border: 0; background: transparent; cursor: pointer;
  padding: 6px 14px; border-radius: var(--radius-full);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-muted);
  display: inline-flex; align-items: center; gap: 6px;
  min-height: var(--spacing-tap-min);
  white-space: nowrap;
  flex-shrink: 0;
}
.tp-trips-tab:hover { color: var(--color-foreground); }
.tp-trips-tab.is-active {
  background: var(--color-background);
  color: var(--color-accent);
  /* 明顯浮起的 thumb 陰影（取代弱 shadow-sm）— 在暖 track 上清楚可辨。 */
  box-shadow: 0 1px 3px rgba(42, 31, 24, 0.16), 0 1px 1px rgba(42, 31, 24, 0.06);
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
  min-height: var(--spacing-tap-min);
  /* v2.31.81 #3：pill 風格 select — 拔 native chrome + 自訂 chevron right-padding */
  appearance: none; -webkit-appearance: none; -moz-appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23B85F2A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 14px 14px;
  padding-right: 28px;
}
body.dark .tp-trips-sort {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23FFFBF5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
}
.tp-trips-search {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  min-height: var(--spacing-tap-min);
  transition: width 160ms ease;
  overflow: hidden;
  /* rev2 D-review #2：collapsed = 44×44 圓、icon 置中。原 36px 寬 + padding 10+8=18px
     內容區塞不下 24px toggle → overflow:hidden 把 icon 裁掉、偏左上（破版）。 */
  width: var(--spacing-tap-min);
  justify-content: center;
  padding: 0;
}
.tp-trips-search.is-open {
  width: 220px;
  justify-content: flex-start;
  padding: 4px 8px 4px 10px;
}
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
  font-size: var(--font-size-title3);
  font-weight: 700;
  transition: background 120ms;
}
.tp-trip-card-new:hover .tp-new-icon {
  background: var(--color-accent-fill);
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
    font-size: var(--font-size-eyebrow);
  }
  .tp-trip-card-title {
    font-size: var(--font-size-footnote);
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
    font-size: var(--font-size-body);
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
  background: var(--color-accent-fill);
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

interface TripInfo {
  tripId: string;
  name: string;
  owner?: string;
  /** 2026-05-07：owner.users.display_name（API LEFT JOIN）給 trip card avatar
   *  initial 顯示「帳號名稱」第一字母，不是 email[0]。null/undefined →
   *  fallback email local part 或 email[0]。 */
  ownerDisplayName?: string | null;
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

/**
 * destinationTone — 行程卡「依目的地三色切換」(v2.54.8)。
 *
 * 三色當分類/wayfinding 用：每個目的地穩定對應一個 tone，行程一覽照去的地方分色。
 * 常見國家**錨定**（日本=accent 柔褐、台灣=sage、韓國=pink，沿用 coverClass 的
 * .includes + JP>KR>TW 優先序，讓最常見的目的地穩定好看）；其餘國家用 deterministic
 * hash **輪替**這三色（不固定哪國哪色，但每國穩定一色、可擴到任何國家、不退化成全 neutral）。
 * 空/未知 → accent（柔褐，主色預設）。
 *
 * 注意這是「分類用色」（粉在此 = 某目的地，非 POI 語意的吃/收藏）—— DESIGN.md 已記此例外。
 */
export type DestinationTone = 'accent' | 'sage' | 'pink';
const DEST_TONE_CYCLE: readonly DestinationTone[] = ['accent', 'sage', 'pink'];
export function destinationTone(countries: string | null | undefined): DestinationTone {
  const c = (countries ?? '').toUpperCase().trim();
  if (c.includes('JP')) return 'accent';
  if (c.includes('KR')) return 'pink';
  if (c.includes('TW')) return 'sage';
  if (!c) return 'accent';
  // 未錨定國家：FNV-ish 32-bit hash → 三色之一，穩定且分布均勻。
  let h = 0;
  for (let i = 0; i < c.length; i++) h = (Math.imul(h, 31) + c.charCodeAt(i)) >>> 0;
  // h % 3 ∈ {0,1,2} 永遠命中；?? 只為滿足 noUncheckedIndexedAccess，不會觸發。
  return DEST_TONE_CYCLE[h % DEST_TONE_CYCLE.length] ?? 'accent';
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
  // v2.31.31: 對齊 mockup「{owner} · 7/29 出發」spec（line 5920/6213）— 拔掉
  // memberCount，desktop / mobile 都 fit。v2.31.30 加 memberCount 導致 mobile
  // 2-col grid（117px card）overflow 19px。range 已含起始日，無 endDate fallback
  // 到 startDateMD「7/29 出發」。
  const range = dateRange(trip.startDate, trip.endDate);
  const startMD = startDateMD(trip.startDate);
  if (range) return range;
  if (startMD) return startMD;
  return '';
}

// EmbeddedActionMenu（行程動作「⋯」選單）v2.57.x 抽到 ../components/trip/TripActionsMenu
// 供 TripStackLayout 共用（owner「第三欄開啟後第二欄 header actions 消失」）。

export default function TripsListPage() {
  useRequireAuth();
  const { user } = useCurrentUser();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [searchParams, setSearchParams] = useSearchParams();
  // v2.39.0: 分享連結 modal — 由 card ⋯ / 行程頁 ⋯ 的「分享連結」開啟。
  const [shareTripId, setShareTripId] = useState<string | null>(null);
  const navigate = useNavigate();
  const selectedFromUrl = searchParams.get('selected');
  const { openModal: openNewTrip } = useNewTrip();

  const [myIds, setMyIds] = useState<string[] | null>(null);
  const [allTrips, setAllTrips] = useState<TripInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // v2.31.89：embedded TitleBar「切換行程」改 dropdown picker（對齊 ChatPage UX）。
  const [tripPickerOpen, setTripPickerOpen] = useState(false);
  const tripPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!tripPickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (tripPickerRef.current && !tripPickerRef.current.contains(e.target as Node)) {
        setTripPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [tripPickerOpen]);

  // 同 tab navigate 不會 remount TripsListPage — 必須由 tp-trip-created /
  // tp-trip-updated event 觸發 refetch，否則新增/編輯後回 list 看不到變更。
  const loadTrips = useCallback(async () => {
    try {
      // 2026-07-21：改為單抓 /my-trips。原本是雙抓 —— /my-trips 只拿 id 順序，
      // name/countries/dayCount 這些**要顯示的資料**來自 /trips?all=1。而 all=1
      // 需要 ops:trips:read service-token scope，一般使用者拿不到，會靜默降級成
      // 只回 published 行程；既有行程改為不公開後 metadata 全空，下方
      // `map.get(id) ?? { tripId: id, name: id }` 就把 tripId 當成名稱顯示
      // （owner 2026-07-21 回報「行程名稱都不見」）。
      let myTrips: (TripInfo & { totalDays?: number })[];
      try {
        myTrips = await apiFetch<(TripInfo & { totalDays?: number })[]>('/my-trips');
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return;
        setError('無法載入你的行程清單。');
        return;
      }
      setMyIds(myTrips.map((r) => r.tripId));
      // /my-trips 的天數欄位叫 totalDays，卡片渲染讀的是 dayCount —— 對映一次，
      // 否則 eyebrow 的「· N 天」會不見。
      setAllTrips(myTrips.map((r) => ({ ...r, dayCount: r.dayCount ?? r.totalDays })));
    } catch {
      setError('網路連線失敗，請稍後再試。');
    }
  }, []);

  useEffect(() => { void loadTrips(); }, [loadTrips]);

  useEffect(() => {
    function onTripCreated() { void loadTrips(); }
    window.addEventListener(EVENT.tripCreated, onTripCreated);
    window.addEventListener(EVENT.tripUpdated, onTripCreated);
    return () => {
      window.removeEventListener(EVENT.tripCreated, onTripCreated);
      window.removeEventListener(EVENT.tripUpdated, onTripCreated);
    };
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

  // userEmail 空（未登入）時一律不算「我的」。少了 !!userEmail 這道，未登入時
  // '' === '' 會讓每個 trip 都判成自己的 —— /api/trips 對匿名不回 owner
  // （第三方個資），所以兩邊都是空字串。
  // useCallback 讓 identity 只隨 userEmail 變 —— 下面兩個 useMemo 依賴它，
  // 每 render 重造一個新 function 會讓 memo 每 render 都重算。
  const isOwnedByUser = useCallback(
    (t: TripInfo) => !!userEmail && (t.owner ?? '').toLowerCase() === userEmail,
    [userEmail],
  );

  const visibleTrips = useMemo<TripInfo[]>(() => {
    let list = [...myTrips];
    // 'archived' filter 取 archivedAt !== null；其他 filter 預設排除 archived（避免雜訊）
    if (filterTab === 'archived') {
      list = list.filter((t) => t.archivedAt != null);
    } else {
      list = list.filter((t) => t.archivedAt == null);
      if (filterTab === 'mine') {
        list = list.filter(isOwnedByUser);
      } else if (filterTab === 'collab') {
        list = list.filter((t) => !isOwnedByUser(t));
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
  }, [myTrips, filterTab, sortBy, searchTerm, isOwnedByUser]);

  // For badge counts shown on filter subtabs — counts on the unfiltered set.
  const tabCounts = useMemo(() => {
    const active = myTrips.filter((t) => t.archivedAt == null);
    const archived = myTrips.length - active.length;
    const mine = active.filter(isOwnedByUser).length;
    return { all: active.length, mine, collab: active.length - mine, archived };
  }, [myTrips, isOwnedByUser]);

  // Effective selected: URL param > first visible trip > null
  const effectiveSelectedId = useMemo<string | null>(() => {
    if (selectedFromUrl && visibleTrips.some((t) => t.tripId === selectedFromUrl)) {
      return selectedFromUrl;
    }
    return visibleTrips[0]?.tripId ?? null;
  }, [selectedFromUrl, visibleTrips]);

  // v2.55.x：進 /trips 沒帶 ?selected 時，還原「上次檢視」的行程 + 天（Q1「記住上次行程+位置」）。
  // 來源用 tripViewState（TripPage 實際檢視時才寫）而非 activeTripId —— 兩者語意不同：tripView
  // 是「上次看的行程」、activeTripId 是「目前選定行程」(chat 目標，選卡片即設)，可各自不同；還原
  // 要回到上次「看」的地方，且只在真的看過某行程後才自動開（不因曾點過卡片就每次彈進行程）。
  // 等 trips 載入後只跑一次（ref guard）；已帶 ?selected 則不覆蓋；關掉行程後同一 mount 不再彈回。
  // 只在桌機還原：bug 1 是「點選左側行程」語意，桌機 /trips 是清單+右側嵌入行程，還原只是填右側、
  // 左側清單仍在；手機 /trips 是「清單 XOR 全螢幕行程」，還原會把 Trips 分頁整個吞進上次行程 →
  // 清單難以觸及，故手機不自動還原。用 visibleTrips 驗證（非 myTrips）：只還原「當前可見」的行程，
  // 否則 effectiveSelectedId 會 fallback 到 visibleTrips[0]，URL/day-hash 套到錯行程（如已封存被濾掉）。
  const didRestoreViewRef = useRef(false);
  useEffect(() => {
    if (didRestoreViewRef.current) return;
    if (!isDesktop) return; // 手機不自動還原（見上）；resize 到桌機再跑
    if (selectedFromUrl) { didRestoreViewRef.current = true; return; }
    if (myTrips.length === 0) return; // 等 trips 載入才判斷
    didRestoreViewRef.current = true;
    const last = readTripView();
    if (!last || !visibleTrips.some((t) => t.tripId === last.tripId)) return;
    const hash = last.dayNum > 0 ? `#day${last.dayNum}` : '';
    navigate(`/trips?selected=${encodeURIComponent(last.tripId)}${hash}`, { replace: true });
  }, [myTrips, visibleTrips, selectedFromUrl, navigate, isDesktop]);

  // Card click 同步寫 ActiveTripContext — 不能等 embedded TripPage mount 才設，
  // 否則 user 點完立刻切 bottom-nav 到 /chat，ChatPage 拿舊 activeTripId 會把
  // 訊息送錯 trip。
  const { setActiveTrip } = useActiveTrip();
  function handleCardClick(tripId: string, e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault();
    setActiveTrip(tripId);
    const next = new URLSearchParams(searchParams);
    next.set('selected', tripId);
    setSearchParams(next, { replace: false });
  }

  // owner 2026-07-21 回報 #2「開關第三欄面板會刷新第二欄」修復：桌機不再 inline
  // render <TripPage>（見下方 embedded main JSX）—— main.tsx 的 TripPageHost 是
  // 唯一持續存在的實例，其 ref 透過 TripPageHandleContext 往下發，這裡 desktop
  // 用該 ref；手機仍 inline render 自己的 <TripPage>，繼續用 localTripPageRef。
  const localTripPageRef = useRef<TripPageHandle>(null);
  const sharedTripPageRef = useTripPageHandle();
  const tripPageRef = isDesktop ? sharedTripPageRef : localTripPageRef;
  // portal placeholder 的 callback ref —— TripPageHost 持有的 <TripPage> 靠這個
  // 知道「現在該把內容 portal 去哪」（push-based，見 TripMainPortalContext 註解）。
  const { setPortalNode } = useTripMainPortal();
  const handleMenuCollab = useCallback(
    (tripId: string) => { navigate(`/trip/${encodeURIComponent(tripId)}/collab`); },
    [navigate],
  );

  const handleMenuEdit = useCallback(
    (tripId: string) => { navigate(`/trip/${encodeURIComponent(tripId)}/edit`); },
    [navigate],
  );

  const handleMenuHealthCheck = useCallback(
    (tripId: string) => { navigate(`/trip/${encodeURIComponent(tripId)}/health`); },
    [navigate],
  );

  const [deleteTarget, setDeleteTarget] = useState<{ tripId: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleMenuDelete = useCallback(
    (tripId: string) => {
      const trip = visibleTrips.find((t) => t.tripId === tripId);
      const label = trip?.title || trip?.name || tripId;
      setDeleteTarget({ tripId, label });
    },
    [visibleTrips],
  );

  const handleConfirmDelete = useCallback(
    async () => {
      if (!deleteTarget) return;
      const { tripId, label } = deleteTarget;
      setDeleting(true);
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
        setDeleteTarget(null);
      } catch (err) {
        showToast((err as Error).message, 'error');
      } finally {
        setDeleting(false);
      }
    },
    [deleteTarget, selectedFromUrl, searchParams, setSearchParams],
  );

  const loading = myIds === null && !error;

  // Heading meta 已棄用 — mockup 規定 TitleBar 單行 chrome 不放 meta。
  // 行程數隱性，user 看 cards 自然知道；toolbar 子 tabs / search / 排序 留 future PR。

  // Mobile + desktop 共用 entry: ?selected=X 切換 main 為 embedded TripPage
  // (滿版)。Cards 隱藏。/trip/:id 路由不再使用。
  const showEmbeddedTrip = !!effectiveSelectedId && !!selectedFromUrl;

  const cardGridMain = (
    <>
      <ToastContainer />
      <ConfirmModal
        open={deleteTarget !== null}
        title="確定刪除行程？"
        message={deleteTarget ? `即將刪除「${deleteTarget.label}」，此操作無法復原。` : ''}
        confirmLabel="刪除"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <div className="tp-trips-shell" data-testid="trips-list-page">
        <TitleBar
          title="我的行程"
          account={<AccountCircle />}
          actions={
            <>
              <ImportTripButton />
              <button
                type="button"
                className="tp-titlebar-action"
                onClick={openNewTrip}
                aria-label="新增行程"
                title="新增行程"
                data-testid="trips-list-new-trip-titlebar"
              >
                <Icon name="plus" />
                <span className="tp-titlebar-action-label">新增行程</span>
              </button>
            </>
          }
        />
        <div className="tp-trips-inner">

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
              <div data-testid="trips-list-sort">
                <TripSelect<'updated' | 'start' | 'name'>
                  value={sortBy}
                  onChange={setSortBy}
                  variant="pill"
                  ariaLabel="排序方式"
                  options={[
                    { value: 'updated', label: '最新編輯' },
                    { value: 'start', label: '出發日近' },
                    { value: 'name', label: '名稱 A→Z' },
                  ]}
                />
              </div>
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
                const isOwnTrip = isOwnedByUser(t);
                // 2026-05-07：avatar initial 一律用「帳號名稱」第一字母（不是 email）。
                // 自己的 trip 用 current user displayName（API 也帶 ownerDisplayName，
                // 但 client-side 已知 displayName 較即時）；他人 trip 用後端 LEFT JOIN
                // 帶來的 ownerDisplayName，fallback email[0]（users 表查無對應）。
                const ownerName = isOwnTrip
                  ? (user?.displayName ?? t.ownerDisplayName ?? ownerEmail)
                  : (t.ownerDisplayName ?? ownerEmail);
                const ownerInitial = ownerEmail
                  ? (ownerName.charAt(0) || ownerEmail.charAt(0)).toUpperCase()
                  : '·';
                const ownerLabel = ownerEmail
                  ? (isOwnTrip ? '由你建立' : (t.ownerDisplayName ?? ownerEmail.split('@')[0]))
                  : '';
                return (
                  <div key={t.tripId} className="tp-trip-card-wrap">
                    <button
                      type="button"
                      onClick={(e) => handleCardClick(t.tripId, e)}
                      className={`tp-trip-card ${isActive ? 'is-active' : ''}`}
                      data-tone={destinationTone(t.countries)}
                      data-testid={`trips-list-card-${t.tripId}`}
                      aria-current={isActive ? 'true' : undefined}
                    >
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
                      onEdit={handleMenuEdit}
                      onHealthCheck={handleMenuHealthCheck}
                      onNotes={(id) => navigate(`/trip/${encodeURIComponent(id)}/notes`)}
                      onShare={(id) => setShareTripId(id)}
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
        title={
          <TripTitleSwitcher
            label={embeddedTrip?.title || embeddedTrip?.name || '載入中…'}
            trips={visibleTrips}
            activeTripId={effectiveSelectedId ?? null}
            onPick={(id) => {
              setActiveTrip(id);
              const next = new URLSearchParams(searchParams);
              next.set('selected', id);
              setSearchParams(next, { replace: false });
            }}
            testIdPrefix="trips"
          />
        }
        back={clearSelected}
        backLabel="返回行程列表"
        actions={effectiveSelectedId && (
          <>
            {/* v2.32.0：「新增景點」入口改 navigate /add-entry（EditEntryPage 形狀 +
                day 下拉），取代 v2.31.99 直接進 /add-stop。/add-stop 仍是 backward-
                compat 直連 URL（bulk add 用），但新 entry-creation 主流程走 /add-entry。 */}
            {/* §9.5：trip detail 在窄中欄，「新增景點」+ 切換 + ⋯ 三控會擠壓長標題。
                改 icon-only（aria-label/title 保留語意），讓標題有空間可讀。 */}
            <button
              type="button"
              className="tp-titlebar-action tp-titlebar-action--icon-only"
              onClick={() => navigate(`/trip/${encodeURIComponent(effectiveSelectedId)}/add-entry`)}
              aria-label="新增景點"
              title="新增景點"
              data-testid="trip-add-stop-trigger"
            >
              <Icon name="plus" />
            </button>
            <TripActionsMenu
              tripId={effectiveSelectedId}
              tripPageRef={tripPageRef}
              onEdit={() => navigate(`/trip/${encodeURIComponent(effectiveSelectedId)}/edit`)}
              onCollab={() => navigate(`/trip/${encodeURIComponent(effectiveSelectedId)}/collab`)}
              onHealthCheck={() => navigate(`/trip/${encodeURIComponent(effectiveSelectedId)}/health`)}
              onNotes={() => navigate(`/trip/${encodeURIComponent(effectiveSelectedId)}/notes`)}
              onPrint={() => navigate(`/trip/${encodeURIComponent(effectiveSelectedId)}/print`)}
              onShare={() => setShareTripId(effectiveSelectedId)}
            />
          </>
        )}
      />
      {/* owner 2026-07-21 回報 #2：桌機只留 portal placeholder，main.tsx 的
          TripPageHost（唯一持續存在的 <TripPage>）會把內容 portal 進來 ——
          路由切換到 /trip/:id/edit 等操作面板時，這個 placeholder 會跟著
          TripsListPage 一起 unmount，但 TripPage 本身（掛在 TripPageHost，
          <Routes> 之上）不受影響，不會重新抓資料。手機沒有這個機制，維持
          原本 inline render（tripPageRef 此時是 localTripPageRef）。 */}
      {isDesktop ? (
        <div ref={setPortalNode} data-testid={TRIP_MAIN_PORTAL_ID} />
      ) : (
        <TripPage ref={localTripPageRef} tripId={effectiveSelectedId!} noShell />
      )}
    </div>
  ) : cardGridMain;

  return (
    <>
      {/* SCOPED_STYLES 必須 hoist 到頂層 — embedded mode 不渲染 cardGridMain，
        * 注入在 cardGridMain 內就失效。 */}
      <style>{SCOPED_STYLES}</style>
      <AppShell
        sidebar={<DesktopSidebarConnected />}
        main={main}
        sheetPortalId={showEmbeddedTrip ? 'trip-sheet-portal' : undefined}
        bottomNav={<GlobalBottomNav authed={user !== null} />}
      />
      {shareTripId && (
        <ShareLinkModal tripId={shareTripId} open onClose={() => setShareTripId(null)} />
      )}
    </>
  );
}
