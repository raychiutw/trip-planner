/**
 * AddStopPage — 加入景點到指定 day 的全頁 form (取代 AddStopModal)。
 *
 * Route: `/trip/:tripId/add-stop?day=N`
 * 對應 DESIGN.md 2026-05-03「Trip Form Pages」規範：
 *   AppShell + sticky TitleBar + content (3 tabs: 搜尋/收藏/自訂) + bottom sticky
 *   actions row。修改邏輯沿用原 AddStopModal v2.x。
 *
 * Layout:
 *   AppShell
 *     sidebar: DesktopSidebarConnected (行程 active)
 *     main:
 *       TitleBar(加入景點)  ← back / 「完成」 action button
 *       page content:
 *         tabs row (搜尋 / 收藏 / 自訂)
 *         body (search w/ region+filter+POI grid OR saved list OR custom form)
 *       bottom: sticky counter + 取消 + 完成
 *     bottomNav: GlobalBottomNav (行程 active)
 *
 * 進入路徑:
 *   - TripPage TitleBar「+ 加景點」 → navigate(`/trip/:id/add-stop?day=N`)
 *
 * 跟舊 AddStopModal 差別:
 *   - 拿掉 portal / backdrop / close X button / ESC handler
 *   - 從 props (open, tripId, dayNum, dayLabel, defaultRegion) 改 useParams +
 *     useSearchParams + 自己 fetch days 取 dayLabel
 *   - onClose / onAdded 走 useNavigateBack(routes.tripsSelected(id)) explicit URL + dispatch tp-entry-updated
 *   - 完成按鈕同時放 TitleBar action + bottom bar (兩處同步 disabled state)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { routes } from '../lib/routes';
import { apiFetch, apiFetchRaw } from '../lib/apiClient';
import { requestTravelRecompute } from '../lib/travelRecompute';
import { EVENT } from '../lib/events';
import { mapGooglePrimaryTypeToPoiType, type PoiType } from '../lib/poiCategory';
import {
  REGION_OPTIONS,
  CATEGORY_TABS,
  matchCategory,
  normalizeSearchResults,
  poiTone,
  poiMeta,
  type PoiSearchTab as Tab,
  type PoiSearchCategory,
  type RegionOption,
} from '../lib/poiSearchHelpers';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import TitleBarPrimaryAction from '../components/shell/TitleBarPrimaryAction';
import Icon from '../components/shared/Icon';
import ToastContainer, { showToast } from '../components/shared/Toast';
import { TripTimePicker } from '../components/TripTimePicker';
import { usePoiSearch } from '../hooks/usePoiSearch';
import { regionToApiParam } from '../lib/maps/region';
// v2.31.94/98: 自訂 tab 用 shared <CustomPoiForm> component（同 ChangePoiPage）。
import { CustomPoiForm } from '../components/trip/CustomPoiForm';
import { EditableCategoryChip } from '../components/trip/EditableCategoryChip';
import {
  selectDefaultCenter,
  isValidCoord as isValidCustomCoord,
  type Coord as CustomCoord,
} from '../lib/locationPicker';

interface TripDestApiLite {
  destOrder: number;
  name: string;
  lat?: number | null;
  lng?: number | null;
}

interface PoiFavoriteRow {
  id: number;
  poiId: number;
  poiName: string;
  poiAddress: string | null;
  poiType: string;
  poiLat?: number | null;
  poiLng?: number | null;
  // v2.31.17: backend SELECT 補 p.rating，favorites card 顯 ★ N.N。
  poiRating?: number | null;
}

interface DayApiRow {
  id: number;
  dayNum: number;
  date?: string | null;
  dayOfWeek?: string | null;
}

// v2.33.34: PoiCardTone / Tab / REGION_OPTIONS / CATEGORY_TABS / matchCategory /
// normalizeSearchResults / poiTone / poiMeta 全 extract 到
// src/lib/poiSearchHelpers.ts (shared with ChangePoiPage)。
type AddStopCategory = PoiSearchCategory;

function normalizePoiFavorites(data: unknown): PoiFavoriteRow[] {
  // v2.31.80：移除 ?? item.poi_* dead defensive fallback。`/api/poi-favorites`
  // 用 functions/api/_utils.json() 經 deepCamel，response 永遠是 camelCase
  // (poiId / poiName / poiAddress / poiType / poiRating)。snake_case 路徑
  // 從未生效，留著只是製造混淆。
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    const id = Number(item.id);
    const poiId = Number(item.poiId);
    const poiName = item.poiName;
    if (!Number.isFinite(id) || typeof poiName !== 'string' || !poiName.trim()) return [];
    const poiAddress = item.poiAddress;
    const poiType = item.poiType;
    const poiRating = typeof item.poiRating === 'number' ? item.poiRating : undefined;
    return [{
      id,
      poiId: Number.isFinite(poiId) ? poiId : 0,
      poiName,
      poiAddress: typeof poiAddress === 'string' ? poiAddress : null,
      poiType: typeof poiType === 'string' ? poiType : 'poi',
      poiRating,
    }];
  });
}

// v2.33.34: poiTone + poiMeta moved to src/lib/poiSearchHelpers.ts

function deriveDayLabel(day: DayApiRow | null, dayNum: number): string {
  const dayPad = String(dayNum).padStart(2, '0');
  if (!day) return `DAY ${dayPad}`;
  const date = day.date ?? '';
  if (!date) return `DAY ${dayPad}`;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date);
  if (!m) return `DAY ${dayPad} · ${date}`;
  const month = parseInt(m[2]!, 10);
  const dom = parseInt(m[3]!, 10);
  const weekdayChar = day.dayOfWeek ?? '';
  return `DAY ${dayPad} · ${month}/${dom}${weekdayChar ? `（${weekdayChar}）` : ''}`;
}

const SCOPED_STYLES = `
/* v2.31.98: 自訂 tab CSS 全搬到 <CustomPoiForm>。下方 :has() rule 留著，讓
   桌機切到自訂 tab 時放寬 .tp-add-stop-body max-width 720→1024px，
   給 380 + map 兩 pane 排得開（其他 tab 仍 720px 不變）。 */
@media (min-width: 1024px) {
  .tp-add-stop-body:has(.tp-custom-poi-form-twopane) {
    max-width: 1024px;
    padding-left: 0;
    padding-right: 0;
  }
}

.tp-add-stop-page-shell {
  min-height: 100%;
  background: var(--color-background);
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.tp-add-stop-page-day-meta {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  padding: 12px 20px 0;
  margin: 0;
}

/* v2.31.99 day picker chip row — 加景點時讓 user 切換目標 day */
.tp-add-stop-daypicker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 20px 0;
}
.tp-add-stop-daypicker-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 14px;
  min-height: 48px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  font: inherit;
  color: var(--color-foreground);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.tp-add-stop-daypicker-chip:hover {
  background: var(--color-hover);
}
.tp-add-stop-daypicker-chip.is-active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-foreground);
}
.tp-add-stop-daypicker-chip-num {
  font-size: var(--font-size-caption);
  font-weight: 700;
  line-height: 1.2;
}
.tp-add-stop-daypicker-chip-date {
  font-size: var(--font-size-caption2);
  opacity: 0.85;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.tp-add-stop-daypicker-empty {
  margin: 12px 20px 0;
  padding: 14px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
  text-align: center;
}
@media (min-width: 768px) {
  .tp-add-stop-daypicker { padding: 12px 24px 0; }
  .tp-add-stop-daypicker-empty { margin: 12px 24px 0; }
}
.tp-add-stop-tabs {
  display: flex; padding: 0 20px;
  border-bottom: 1px solid var(--color-border);
  margin-top: 8px;
}
.tp-add-stop-tab {
  border: 0; background: transparent;
  padding: 12px 16px;
  font: inherit; font-size: var(--font-size-callout); font-weight: 600;
  color: var(--color-muted); cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tp-add-stop-tab:hover { color: var(--color-foreground); }
.tp-add-stop-tab.is-active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.tp-add-stop-body {
  flex: 1; min-height: 0;
  padding: 16px 20px 96px;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
}
@media (min-width: 768px) {
  .tp-add-stop-body { padding: 16px 24px 96px; }
}

.tp-add-stop-subtabs {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-bottom: 16px;
}
.tp-add-stop-subtab {
  border: 1px solid var(--color-border);
  background: var(--color-background);
  padding: 6px 12px;
  border-radius: var(--radius-full);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-foreground); cursor: pointer;
  min-height: var(--spacing-tap-min);
}
.tp-add-stop-subtab:hover { color: var(--color-foreground); }
.tp-add-stop-subtab.is-active {
  background: var(--color-foreground);
  color: var(--color-accent-foreground);
  border-color: var(--color-foreground);
}

.tp-add-stop-region-row { position: relative; margin-bottom: 14px; }
.tp-add-stop-region-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit; font-size: var(--font-size-headline); font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-foreground); cursor: pointer;
}
.tp-add-stop-region-pill:hover { color: var(--color-accent-deep); }
.tp-add-stop-region-pill .svg-icon { width: 14px; height: 14px; color: var(--color-muted); }
.tp-add-stop-region-menu {
  position: absolute; top: calc(100% + 4px); left: 0;
  z-index: 1; min-width: 160px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  list-style: none; padding: 4px; margin: 0;
}
.tp-add-stop-region-menu li button {
  width: 100%; text-align: left;
  padding: 8px 10px;
  border: 0; background: transparent;
  font: inherit; font-size: var(--font-size-footnote);
  color: var(--color-foreground); cursor: pointer;
  border-radius: var(--radius-sm);
}
.tp-add-stop-region-menu li button:hover { background: var(--color-hover); }
.tp-add-stop-region-menu li[aria-selected="true"] button {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  font-weight: 700;
}

.tp-add-stop-search-row {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.tp-add-stop-filter-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 8px 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-background);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-foreground); cursor: pointer;
  min-height: 40px;
  flex-shrink: 0;
}
.tp-add-stop-filter-btn:hover { border-color: var(--color-accent); color: var(--color-accent-deep); }
.tp-add-stop-filter-btn .svg-icon { width: 14px; height: 14px; color: var(--color-muted); }
.tp-add-stop-filter-sheet {
  margin: 0 0 12px;
  padding: 12px;
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-footnote);
}

.tp-add-stop-search-input-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}
.tp-add-stop-search-input-wrap .svg-icon {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  color: var(--color-muted);
  width: 16px; height: 16px;
  pointer-events: none;
}
.tp-add-stop-search-input {
  width: 100%; min-height: 44px;
  padding: 8px 14px 8px 36px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-secondary);
  font: inherit; font-size: var(--font-size-callout);
  color: var(--color-foreground);
}
.tp-add-stop-search-input:focus {
  outline: none; border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-subtle);
}

.tp-add-stop-grid {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.tp-add-stop-result-title {
  font-size: var(--font-size-callout);
  font-weight: 700;
  margin: 0 0 10px;
  letter-spacing: -0.005em;
}
.tp-add-stop-card {
  position: relative;
  display: block;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 120ms, background 120ms;
  text-align: left;
  font: inherit;
  color: var(--color-foreground);
}
.tp-add-stop-card:hover { border-color: var(--color-accent); background: var(--color-background); }
.tp-add-stop-card.is-selected {
  border-color: var(--color-accent);
  background: var(--color-background);
}
.tp-add-stop-card-checkbox {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}
.tp-add-stop-card-photo {
  height: 96px;
  display: grid;
  place-items: center;
  position: relative;
}
.tp-add-stop-card-photo[data-tone="warm"] {
  background: linear-gradient(135deg, var(--color-accent-bg), var(--color-tertiary));
}
.tp-add-stop-card-photo[data-tone="cool"] {
  background: linear-gradient(135deg, #DCE7E0, #C8DCE0);
}
.tp-add-stop-card-photo[data-tone="blue"] {
  background: linear-gradient(135deg, #C7DBE5, #A6C5D2);
}
.tp-add-stop-card-photo[data-tone="amber"] {
  background: linear-gradient(135deg, #F2DCB0, #E0C089);
}
.tp-add-stop-card-photo .svg-icon {
  width: 32px;
  height: 32px;
  color: rgba(255, 255, 255, 0.78);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.18));
}
.tp-add-stop-card-add {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--color-foreground);
  color: var(--color-accent-foreground);
  font: inherit;
  font-size: var(--font-size-caption2);
  font-weight: 700;
  box-shadow: var(--shadow-md);
  pointer-events: none;
}
.tp-add-stop-card-add .svg-icon {
  width: 12px;
  height: 12px;
}
.tp-add-stop-card.is-selected .tp-add-stop-card-add {
  background: var(--color-success, #2E7D32);
}
.tp-add-stop-card-body { min-width: 0; padding: 10px 12px; }
.tp-add-stop-card-cat { margin-top: 6px; }
.tp-add-stop-card-name {
  font-weight: 700; font-size: var(--font-size-callout);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  letter-spacing: -0.005em;
  margin-bottom: 4px;
}
.tp-add-stop-card-meta {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tp-add-stop-card-meta .svg-icon {
  width: 10px;
  height: 10px;
  color: var(--color-warning);
  vertical-align: -1px;
  margin-right: 4px;
}
.tp-add-stop-card-meta-sep {
  margin: 0 6px;
  opacity: 0.6;
}

.tp-add-stop-empty {
  min-height: 260px;
  padding: 40px 20px; text-align: center;
  color: var(--color-muted);
  font-size: var(--font-size-callout);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}
.tp-add-stop-empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  display: grid;
  place-items: center;
}
.tp-add-stop-empty-icon .svg-icon {
  width: 28px;
  height: 28px;
}
.tp-add-stop-empty-title {
  font-size: var(--font-size-callout);
  font-weight: 700;
  color: var(--color-foreground);
}
.tp-add-stop-empty-desc {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  max-width: 280px;
  line-height: 1.6;
}

.tp-add-stop-favorites-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 14px;
  padding: 0 2px;
}
.tp-add-stop-favorites-title {
  font-size: var(--font-size-callout);
  font-weight: 700;
  margin: 0;
}
.tp-add-stop-favorites-sort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: var(--color-muted);
  font: inherit;
  font-size: var(--font-size-caption);
  cursor: pointer;
}

.tp-add-stop-form { display: flex; flex-direction: column; gap: 14px; }
.tp-add-stop-form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.tp-add-stop-form-row.is-full {
  grid-template-columns: 1fr;
}
.tp-add-stop-form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.tp-add-stop-form-field label {
  font-size: var(--font-size-caption); font-weight: 700;
  color: var(--color-foreground);
}
.tp-add-stop-form-field input,
.tp-add-stop-form-field textarea,
.tp-add-stop-form-select,
.tp-add-stop-form-placeholder {
  padding: 10px 12px; min-height: 44px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  font: inherit; font-size: var(--font-size-callout);
  color: var(--color-foreground);
}
.tp-add-stop-form-field textarea { min-height: 88px; resize: vertical; }
.tp-add-stop-form-field input:focus,
.tp-add-stop-form-field textarea:focus {
  outline: none; border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-subtle);
}
.tp-add-stop-form-select,
.tp-add-stop-form-placeholder {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.tp-add-stop-form-placeholder {
  color: var(--color-muted);
}
.tp-add-stop-form-helper {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
  line-height: 1.45;
}
.tp-add-stop-form-row-error {
  color: var(--color-destructive);
  font-size: var(--font-size-caption2);
  margin-top: 2px;
}
@media (max-width: 760px) {
  .tp-add-stop-form-row {
    grid-template-columns: 1fr;
  }
}

/* sticky bottom bar 已移到 css/tokens.css .tp-page-bottom-bar 共用 */
.tp-add-stop-counter {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tp-add-stop-counter strong {
  color: var(--color-foreground);
  font-weight: 700;
}
.tp-add-stop-actions { display: inline-flex; gap: 8px; }
.tp-add-stop-btn {
  font: inherit; font-weight: 700; font-size: var(--font-size-footnote);
  padding: 10px 18px; min-height: 40px;
  border-radius: var(--radius-full);
  cursor: pointer;
}
.tp-add-stop-btn-cancel {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-foreground);
}
.tp-add-stop-btn-cancel:hover { background: var(--color-hover); }
.tp-add-stop-btn-confirm {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  border: 1px solid var(--color-accent);
}
.tp-add-stop-btn-confirm:hover { filter: brightness(0.95); }
.tp-add-stop-btn-confirm:disabled {
  background: var(--color-secondary);
  color: var(--color-muted);
  border-color: var(--color-border);
  cursor: not-allowed;
}
`;

export default function AddStopPage() {
  const auth = useRequireAuth();
  const { user } = useCurrentUser();
  const { tripId } = useParams<{ tripId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const handleBack = useNavigateBack(tripId ? routes.tripsSelected(tripId) : routes.trips());

  const dayNumParam = searchParams.get('day');
  const dayNum = dayNumParam ? parseInt(dayNumParam, 10) : NaN;

  // v2.32.2 fix: 初值從 URL param 讀，讓 `/add-stop?tab=custom` direct URL 進來
  // 直接 land 在自訂 tab（之前 hardcoded 'search'，URL param 被忽略）。
  const initialTab: Tab = (() => {
    const raw = searchParams.get('tab');
    return raw === 'favorites' ? 'favorites' : raw === 'custom' ? 'custom' : 'search';
  })();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [category, setCategory] = useState<AddStopCategory>('all');
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<RegionOption>('全部地區');
  const [regionMenuOpen, setRegionMenuOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedSearch, setSelectedSearch] = useState<Set<string>>(new Set());

  // Region 不再 auto-fire search — Nominatim 公共 endpoint 1 req/s 限制，
  // 每次開頁面 / 退到 1 字 都會 burn quota。改成 user 主動輸入才查；region
  // 顯示在 empty state 推薦 chip 讓 user 點擊觸發。
  const { results: searchResults, searching } = usePoiSearch({
    enabled: tab === 'search',
    query: query.trim(),
    region: regionToApiParam(region),
    limit: 20,
    normalise: normalizeSearchResults,
  });

  const [poiFavorites, setPoiFavorites] = useState<PoiFavoriteRow[] | null>(null);
  const [savedLoading, setSavedLoading] = useState(false);
  const [selectedSaved, setSelectedSaved] = useState<Set<number>>(new Set());

  const [customTitle, setCustomTitle] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [customDuration, setCustomDuration] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  // v2.31.94: 自訂 tab 新增地址 typeahead + map pin 機制，確保 entry 一定有 lat/lng
  const [customCoord, setCustomCoord] = useState<CustomCoord | null>(null);
  const [customHintConfirmed, setCustomHintConfirmed] = useState(false);
  // 自訂 stop 無 Google 來源 → 預設 'attraction'，使用者用 CategoryPicker 可改。
  const [customCategory, setCustomCategory] = useState<PoiType>('attraction');
  // 搜尋結果 per-result 分類覆寫（place_id → 使用者選的分類）。預設＝Google 自動推導。
  const [searchCatOverride, setSearchCatOverride] = useState<Record<string, PoiType>>({});
  // v2.32.1 fix: 初值改 null 區分「未載入」與「載入後 0 個」
  const [customDestinations, setCustomDestinations] = useState<TripDestApiLite[] | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // v2.31.99: 載入所有 days 給 day picker chip row 用。currentDay 從 allDays
  // 衍生（不另外 setState 避免兩條 state truth）。
  const [allDays, setAllDays] = useState<DayApiRow[] | null>(null);

  useEffect(() => {
    if (!auth.user || !tripId) return;
    let cancelled = false;
    (async () => {
      try {
        const days = await apiFetch<DayApiRow[]>(`/trips/${encodeURIComponent(tripId)}/days`);
        if (cancelled) return;
        setAllDays(days ?? []);
      } catch {
        // silent — label fallback to DAY NN
      }
    })();
    return () => { cancelled = true; };
  }, [auth.user, tripId]);

  const currentDay = useMemo<DayApiRow | null>(() => {
    if (!allDays || !Number.isFinite(dayNum)) return null;
    return allDays.find((d) => d.dayNum === dayNum) ?? null;
  }, [allDays, dayNum]);

  const hasDay = Number.isFinite(dayNum);

  // v2.31.99: switch day via chip row → URL replaceState 不開新 history entry
  const handlePickDay = useCallback((next: number) => {
    if (next === dayNum) return;
    const sp = new URLSearchParams(searchParams);
    sp.set('day', String(next));
    setSearchParams(sp, { replace: true });
  }, [dayNum, searchParams, setSearchParams]);

  // v2.31.94: 自訂 tab 在 mobile (≤1023px) 上 redirect 到 fullpage route，避免 IME
  // occlusion 把 280px map 整個遮蓋。Desktop 仍走 inline tab。
  useEffect(() => {
    if (tab !== 'custom' || !tripId || !Number.isFinite(dayNum)) return;
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    navigate(
      `/trip/${encodeURIComponent(tripId)}/add-custom-stop?day=${dayNum}`,
      { replace: true },
    );
  }, [tab, tripId, dayNum, navigate]);

  // v2.31.94: 自訂 tab 需要 trip destinations 當 map default center fallback chain
  // v2.32.1 fix: 從 tab-gated 改 mount-gated — LocationPickerMap 鎖 mount 時
  // initialCenter，等切到 custom tab 才 fetch 就太晚。
  useEffect(() => {
    if (!auth.user || !tripId) return;
    let cancelled = false;
    (async () => {
      try {
        const tripBody = await apiFetch<{ destinations?: TripDestApiLite[] }>(
          `/trips/${encodeURIComponent(tripId)}`,
        );
        if (cancelled) return;
        setCustomDestinations(tripBody?.destinations ?? []);
      } catch {
        // network fail → 標 [] 讓 fallback chain 走 Tokyo（已是最後一道安全網）
        if (!cancelled) setCustomDestinations([]);
      }
    })();
    return () => { cancelled = true; };
  }, [auth.user, tripId]);

  // POI search 由 usePoiSearch hook 處理 (見上方 hook call) — debounce + abort 內建

  // Saved fetch (lazy 切到 tab 才打)
  // v2.31.78 fix: 切回 search tab 或 unmount 期間若 favorites fetch 還在 inflight,
  // setPoiFavorites + setSavedLoading 會在 unmount 後觸發 → React state update
  // warning + closure leak。加 cancelled flag guard。
  useEffect(() => {
    if (tab !== 'favorites' || poiFavorites !== null) return;
    let cancelled = false;
    setSavedLoading(true);
    (async () => {
      try {
        const json = await apiFetch<unknown>('/poi-favorites');
        if (cancelled) return;
        setPoiFavorites(normalizePoiFavorites(json));
      } catch {
        if (cancelled) return;
        setPoiFavorites([]);
      } finally {
        if (!cancelled) setSavedLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, poiFavorites]);

  function toggleSearch(id: string) {
    setSelectedSearch((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // 取消選取時清掉 per-result 分類覆寫，避免再次選取時殘留舊的手動選擇
        // （重新選取應回到 auto-derived 預設）。
        setSearchCatOverride((m) => {
          if (!(id in m)) return m;
          const cleaned = { ...m };
          delete cleaned[id];
          return cleaned;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSaved(id: number) {
    setSelectedSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalSelected = useMemo(() => {
    if (tab === 'search') return selectedSearch.size;
    if (tab === 'favorites') return selectedSaved.size;
    return customTitle.trim() && customCoord ? 1 : 0;
  }, [tab, selectedSearch, selectedSaved, customTitle, customCoord]);

  // v2.31.99: hasDay 也成 submit gate — chip row 必須選一天才能提交
  const confirmEnabled = hasDay && (
    tab === 'custom'
      ? !submitting && !!customTitle.trim() && !!customCoord
      : totalSelected > 0 && !submitting
  );

  // v2.31.98: 自訂 tab typeahead + map handlers 移進 CustomPoiForm component。
  // 父層只負責 fallback center 計算（依賴 trip destinations）。
  const customInitialCenter = useMemo<CustomCoord>(() => {
    return selectDefaultCenter({
      prevEntry: null,
      tripDestinations: (customDestinations ?? [])
        .filter((d) => typeof d.lat === 'number' && typeof d.lng === 'number')
        .map((d) => ({ lat: d.lat as number, lng: d.lng as number })),
    });
  }, [customDestinations]);

  const handleConfirm = useCallback(async () => {
    if (submitting || !tripId || !Number.isFinite(dayNum)) return;
    setSubmitError(null);

    type Body = {
      title: string;
      time?: string;
      note?: string;
      lat?: number;
      lng?: number;
      source?: string;
      // Auto-category: Google primaryType → whitelist poi_type，後端 entries.ts 只認
      // 這個 snake_case key（缺則 fallback 'attraction'）。
      poi_type?: string;
    };

    let payloads: Body[] = [];

    if (tab === 'search') {
      payloads = searchResults
        .filter((r) => selectedSearch.has(r.place_id))
        .map((r) => ({
          title: r.name,
          note: r.address || undefined,
          lat: r.lat,
          lng: r.lng,
          source: 'google',
          poi_type: searchCatOverride[r.place_id] ?? mapGooglePrimaryTypeToPoiType(r.category),
        }));
    } else if (tab === 'favorites') {
      const list = poiFavorites ?? [];
      payloads = list
        .filter((r) => selectedSaved.has(r.id))
        .map((r) => ({
          title: r.poiName,
          note: r.poiAddress ?? undefined,
          lat: r.poiLat ?? undefined,
          lng: r.poiLng ?? undefined,
          source: 'favorite',
          poi_type: mapGooglePrimaryTypeToPoiType(r.poiType),
        }));
    } else {
      const title = customTitle.trim();
      if (!title) {
        setCustomError('請輸入標題');
        return;
      }
      // v2.31.94: 自訂 stop 必須有 map pin 座標，否則 entry 會 silent drop from map
      if (!customCoord || !isValidCustomCoord(customCoord)) {
        setCustomError('請先在地圖上選擇位置');
        return;
      }
      const note = [customDuration && `${customDuration} 分`, customNote].filter(Boolean).join(' · ') || undefined;
      payloads = [{
        title,
        time: customTime || undefined,
        note,
        lat: customCoord.lat,
        lng: customCoord.lng,
        source: 'custom',
        poi_type: customCategory,
      }];
    }

    if (payloads.length === 0) return;

    setSubmitting(true);
    try {
      const results = await Promise.allSettled(
        payloads.map((body) =>
          apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/days/${dayNum}/entries`, {
            method: 'POST',
            credentials: 'same-origin',
            body: JSON.stringify(body),
          }).then((r) => {
            if (!r.ok) throw new Error(`POST 失敗 (${r.status})`);
            return r;
          }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        setSubmitError(`${failed.length}/${payloads.length} 個項目儲存失敗，請重試`);
        return;
      }
      // Fire-and-forget recompute-travel for this day so newly added entries
      // get travel_distance_m / travel_min populated. Non-blocking — UI returns
      // to trip view immediately; travel pills update after server done.
      void requestTravelRecompute(tripId, dayNum).catch(() => undefined);
      window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId, dayNum } }));
      showToast(`已加入 ${payloads.length} 個景點`, 'success');
      handleBack();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting, tab, searchResults, selectedSearch, poiFavorites, selectedSaved, customTitle, customTime, customDuration, customNote, customCoord, customCategory, searchCatOverride, tripId, dayNum]);

  if (!auth.user) return null;
  // v2.31.99: tripId 必填，但 dayNum 改成 optional — 沒帶 ?day=N 時 chip row
  // 上方讓 user 選一天再 unlock form（取代既有 invalid-params blocking page）。
  if (!tripId) {
    return (
      <AppShell
        sidebar={<DesktopSidebarConnected />}
        main={
          <div className="tp-add-stop-page-shell" data-testid="add-stop-page">
            <TitleBar title="加入景點" back={handleBack} backLabel="返回行程列表" />
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)' }}>
              無效的行程
            </div>
          </div>
        }
        bottomNav={<GlobalBottomNav authed={user !== null} />}
      />
    );
  }

  const dayLabel = hasDay ? deriveDayLabel(currentDay, dayNum) : '請選擇加入哪天';

  const titleBarActions = (
    <TitleBarPrimaryAction
      label="完成"
      busyLabel="加入中⋯"
      busy={submitting}
      disabled={!confirmEnabled}
      onClick={() => void handleConfirm()}
      testId="add-stop-titlebar-confirm"
    />
  );

  return (
    <>
      <ToastContainer />
      <AppShell
        sidebar={<DesktopSidebarConnected />}
        main={
          <div className="tp-add-stop-page-shell" data-testid="add-stop-page">
            <style>{SCOPED_STYLES}</style>
            <TitleBar
              title="加入景點"
              back={handleBack}
              backLabel="返回前頁"
              actions={titleBarActions}
            />
            <div className="tp-add-stop-page-day-meta">{dayLabel}</div>

            {/* v2.31.99 day picker chip row — 沒帶 ?day=N 進來時讓 user 選；帶了
                也仍顯，可隨時切換。Day metadata 還在 fetch 時不 render
                （allDays === null）— 避免閃爍空列。 */}
            {allDays && allDays.length > 0 && (
              <div
                className="tp-add-stop-daypicker"
                role="tablist"
                aria-label="選擇加入哪天"
                data-testid="add-stop-daypicker"
              >
                {allDays.map((d) => {
                  const isActive = d.dayNum === dayNum;
                  const mmdd = (d.date ?? '').slice(5).replace('-', '/');
                  return (
                    <button
                      key={d.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`tp-add-stop-daypicker-chip ${isActive ? 'is-active' : ''}`}
                      onClick={() => handlePickDay(d.dayNum)}
                      data-testid={`add-stop-daypicker-chip-${d.dayNum}`}
                    >
                      <span className="tp-add-stop-daypicker-chip-num">DAY {String(d.dayNum).padStart(2, '0')}</span>
                      {mmdd && <span className="tp-add-stop-daypicker-chip-date">{mmdd}{d.dayOfWeek ? `（${d.dayOfWeek}）` : ''}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {!hasDay && allDays && allDays.length === 0 && (
              <div className="tp-add-stop-daypicker-empty" data-testid="add-stop-daypicker-empty">
                此行程尚無日期，請先在「編輯行程」設定起訖日。
              </div>
            )}

            <div className="tp-add-stop-tabs" role="tablist" aria-label="加入景點來源">
              {([
                { key: 'search', label: '搜尋' },
                { key: 'favorites', label: '收藏' },
                { key: 'custom', label: '自訂' },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  className={`tp-add-stop-tab ${tab === t.key ? 'is-active' : ''}`}
                  onClick={() => setTab(t.key)}
                  data-testid={`add-stop-tab-${t.key}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="tp-add-stop-body">
              {(tab === 'search' || tab === 'favorites') && (
                <div className="tp-add-stop-subtabs" role="tablist" aria-label="景點類別">
                  {CATEGORY_TABS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      role="tab"
                      aria-selected={category === c.key}
                      className={`tp-add-stop-subtab ${category === c.key ? 'is-active' : ''}`}
                      onClick={() => setCategory(c.key)}
                      data-testid={`add-stop-subtab-${c.key}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}

              {tab === 'search' && (
                <>
                  <div className="tp-add-stop-region-row">
                    <button
                      type="button"
                      className="tp-add-stop-region-pill"
                      onClick={() => setRegionMenuOpen((v) => !v)}
                      data-testid="add-stop-region-pill"
                      aria-haspopup="listbox"
                      aria-expanded={regionMenuOpen}
                    >
                      {region} <Icon name="chevron-down" />
                    </button>
                    {regionMenuOpen && (
                      <ul
                        className="tp-add-stop-region-menu"
                        role="listbox"
                        aria-label="切換地區"
                        data-testid="add-stop-region-menu"
                      >
                        {REGION_OPTIONS.map((opt) => (
                          <li key={opt} role="option" aria-selected={region === opt}>
                            <button
                              type="button"
                              onClick={() => {
                                setRegion(opt);
                                setRegionMenuOpen(false);
                              }}
                              data-testid={`add-stop-region-opt-${opt}`}
                            >
                              {opt}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="tp-add-stop-search-row">
                    <div className="tp-add-stop-search-input-wrap">
                      <Icon name="search" />
                      <input
                        type="text"
                        className="tp-add-stop-search-input"
                        placeholder="搜尋景點、餐廳、住宿⋯"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        data-testid="add-stop-search-input"
                      />
                    </div>
                    <button
                      type="button"
                      className="tp-add-stop-filter-btn"
                      onClick={() => setFilterSheetOpen((v) => !v)}
                      aria-label="篩選"
                      aria-expanded={filterSheetOpen}
                      data-testid="add-stop-filter-btn"
                    >
                      <Icon name="filter" />
                      <span>篩選</span>
                    </button>
                  </div>
                  {filterSheetOpen && (
                    <div className="tp-add-stop-filter-sheet" data-testid="add-stop-filter-sheet" role="region" aria-label="篩選">
                      <p style={{ margin: 0, color: 'var(--color-muted)' }}>
                        篩選功能（評分、價位、open-now）開發中。目前可用上方類別 subtab 切換 POI 類別。
                      </p>
                    </div>
                  )}
                  {searching && <div className="tp-add-stop-empty">搜尋中⋯</div>}
                  {/* v2.31.55 fix：landing empty state 之前 gate 在
                    * `poiFavorites && poiFavorites.length > 0`，但 poiFavorites
                    * 只在 user 切到「收藏」 tab 才 fetch（line 664-681 lazy load），
                    * 搜尋 tab 預設 null → 永遠不 render → user 看到 blank page
                    * 完全沒 hint「該做什麼」。decouple 條件，搜尋 tab + query 空
                    * 一律顯示 hint。 */}
                  {!searching && query.trim().length === 0 && category === 'all' && (
                    <div className="tp-add-stop-empty">
                      輸入關鍵字搜尋，或切到「收藏」 tab 從你儲存的 POI 加入
                    </div>
                  )}
                  {!searching && query.trim().length === 0 && category !== 'all' && (
                    <div className="tp-add-stop-empty">輸入「{CATEGORY_TABS.find((c) => c.key === category)?.label}」 相關關鍵字開始搜尋</div>
                  )}
                  {!searching && query.trim().length >= 2 && searchResults.length === 0 && (
                    <div className="tp-add-stop-empty">沒有找到結果，換個關鍵字試試</div>
                  )}
                  {searchResults.length > 0 && (() => {
                    const filtered = searchResults.filter((r) => matchCategory(r.category, category));
                    if (filtered.length === 0) {
                      return <div className="tp-add-stop-empty">符合類別篩選的結果為 0，試著切到「為你推薦」看全部</div>;
                    }
                    return (
                      <>
                        <h3 className="tp-add-stop-result-title">
                          {query.trim().length >= 2 ? '搜尋結果' : '熱門景點'} · {region}
                        </h3>
                        <div className="tp-add-stop-grid">
                          {filtered.map((r, index) => {
                            const isSelected = selectedSearch.has(r.place_id);
                            return (
                              <label
                                key={r.place_id}
                                className={`tp-add-stop-card ${isSelected ? 'is-selected' : ''}`}
                                data-testid={`add-stop-search-card-${r.place_id}`}
                              >
                                <input
                                  type="checkbox"
                                  className="tp-add-stop-card-checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSearch(r.place_id)}
                                />
                                <div className="tp-add-stop-card-photo" data-tone={poiTone(r.category, index)}>
                                  <Icon name="location-pin" />
                                </div>
                                <span className="tp-add-stop-card-add">
                                  <Icon name={isSelected ? 'check' : 'plus'} />
                                  {isSelected ? '已加入' : '加入'}
                                </span>
                                <div className="tp-add-stop-card-body">
                                  <div className="tp-add-stop-card-name">{r.name}</div>
                                  <div className="tp-add-stop-card-meta">
                                    {typeof r.rating === 'number' && (
                                      <>
                                        <Icon name="star" />
                                        <span>{r.rating.toFixed(1)}</span>
                                        <span className="tp-add-stop-card-meta-sep">·</span>
                                      </>
                                    )}
                                    <span>{poiMeta(r.address, r.category)}</span>
                                  </div>
                                  {isSelected && (
                                    <div
                                      className="tp-add-stop-card-cat"
                                      // preventDefault (not stopPropagation): the card's hidden
                                      // checkbox toggles via LABEL ACTIVATION (a default action),
                                      // so clicking the picker's gaps/padding would deselect the
                                      // card. Only preventDefault cancels label activation.
                                      onClick={(e) => e.preventDefault()}
                                    >
                                      <EditableCategoryChip
                                        value={searchCatOverride[r.place_id] ?? mapGooglePrimaryTypeToPoiType(r.category)}
                                        autoValue={mapGooglePrimaryTypeToPoiType(r.category)}
                                        onChange={(t) =>
                                          setSearchCatOverride((m) => ({ ...m, [r.place_id]: t }))
                                        }
                                        testIdPrefix={`add-stop-search-cat-${r.place_id}`}
                                        // 搜尋卡 .tp-add-stop-card 是 overflow:hidden + ~331px 窄：compact
                                        // 維持 in-flow 緊湊 popover，否則桌機 absolute 寬浮層會被卡片裁成碎片。
                                        compact
                                      />
                                    </div>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </>
              )}

              {tab === 'favorites' && (
                <>
                  {savedLoading && <div className="tp-add-stop-empty">載入收藏⋯</div>}
                  {!savedLoading && poiFavorites !== null && poiFavorites.length === 0 && (
                    <div className="tp-add-stop-empty">
                      <div className="tp-add-stop-empty-icon"><Icon name="heart" /></div>
                      <div className="tp-add-stop-empty-title">還沒收藏景點</div>
                      <div className="tp-add-stop-empty-desc">在探索頁或地圖上點收藏地點，下次行程就能直接從這裡加入。</div>
                    </div>
                  )}
                  {poiFavorites !== null && poiFavorites.length > 0 && (() => {
                    const filtered = poiFavorites.filter((r) => matchCategory(r.poiType, category));
                    if (filtered.length === 0) {
                      return <div className="tp-add-stop-empty">符合類別篩選的收藏為 0，試著切到「為你推薦」看全部</div>;
                    }
                    return (
                      <>
                        <div className="tp-add-stop-favorites-header">
                          <h3 className="tp-add-stop-favorites-title">收藏 · {poiFavorites.length} 個景點</h3>
                          <button className="tp-add-stop-favorites-sort" type="button">
                            按收藏時間排序 <Icon name="chevron-down" />
                          </button>
                        </div>
                        <div className="tp-add-stop-grid">
                          {filtered.map((r, index) => {
                            const isSelected = selectedSaved.has(r.id);
                            return (
                              <label
                                key={r.id}
                                className={`tp-add-stop-card ${isSelected ? 'is-selected' : ''}`}
                                data-testid={`add-stop-favorites-card-${r.id}`}
                              >
                                <input
                                  type="checkbox"
                                  className="tp-add-stop-card-checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSaved(r.id)}
                                />
                                <div className="tp-add-stop-card-photo" data-tone={poiTone(r.poiType, index)}>
                                  <Icon name="location-pin" />
                                </div>
                                <span className="tp-add-stop-card-add">
                                  <Icon name={isSelected ? 'check' : 'plus'} />
                                  {isSelected ? '已加入' : '加入'}
                                </span>
                                <div className="tp-add-stop-card-body">
                                  <div className="tp-add-stop-card-name">{r.poiName}</div>
                                  <div className="tp-add-stop-card-meta">
                                    {/* v2.31.17: backend SELECT 補 p.rating，favorites card 跟
                                      * search card 一致：rating 存在則 ★ N.N · address，
                                      * 否則只顯 address。 */}
                                    {typeof r.poiRating === 'number' && (
                                      <>
                                        <Icon name="star" />
                                        <span>{r.poiRating.toFixed(1)}</span>
                                        <span className="tp-add-stop-card-meta-sep">·</span>
                                      </>
                                    )}
                                    <span>{poiMeta(r.poiAddress, r.poiType)}</span>
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </>
              )}

              {/* v2.32.1 fix: 等 destinations 載完才 mount LocationPickerMap，
                  避免 Tokyo fallback 鎖死 initial center。 */}
              {tab === 'custom' && customDestinations === null && (
                <div className="tp-add-stop-empty" data-testid="add-stop-custom-loading">
                  載入中⋯
                </div>
              )}
              {tab === 'custom' && customDestinations !== null && (
                <form onSubmit={(e) => { e.preventDefault(); void handleConfirm(); }}>
                  <CustomPoiForm
                    title={customTitle}
                    onTitleChange={(v) => { setCustomTitle(v); setCustomError(null); }}
                    coord={customCoord}
                    onCoordChange={setCustomCoord}
                    hintConfirmed={customHintConfirmed}
                    onHintConfirmedChange={setCustomHintConfirmed}
                    initialCenter={customInitialCenter}
                    error={customError}
                    testIdPrefix="add-stop-custom"
                    category={customCategory}
                    onCategoryChange={setCustomCategory}
                    extraRows={
                      <>
                        <div className="tp-custom-poi-form-row">
                          <div className="tp-custom-poi-form-field" data-testid="add-stop-custom-time">
                            <label htmlFor="add-stop-custom-time">開始時間</label>
                            <TripTimePicker
                              id="add-stop-custom-time"
                              value={customTime}
                              onChange={setCustomTime}
                              ariaLabel={`Day ${String(dayNum).padStart(2, '0')} 開始時間`}
                            />
                          </div>
                          <div className="tp-custom-poi-form-field">
                            <label htmlFor="add-stop-custom-duration">預估停留</label>
                            <input
                              id="add-stop-custom-duration"
                              className="tp-input-short"
                              type="number"
                              inputMode="numeric"
                              value={customDuration}
                              onChange={(e) => setCustomDuration(e.target.value)}
                              placeholder="90"
                              data-testid="add-stop-custom-duration"
                            />
                          </div>
                        </div>
                        <div className="tp-custom-poi-form-row is-full">
                          <div className="tp-custom-poi-form-field">
                            <label htmlFor="add-stop-custom-note">備註（選填）</label>
                            <textarea
                              id="add-stop-custom-note"
                              value={customNote}
                              onChange={(e) => setCustomNote(e.target.value)}
                              placeholder="想看夕陽 · 推薦避開週末"
                              data-testid="add-stop-custom-note"
                            />
                          </div>
                        </div>
                      </>
                    }
                  />
                </form>
              )}
            </div>

            <div className="tp-page-bottom-bar">
              <span className="tp-add-stop-counter" data-testid="add-stop-counter">
                {/* v2.31.33: mobile counter 191px 容不下完整 dayLabel（DAY 01 · 7/29（三））→
                    簡化「將加入 DAY 01 · 7/29（三）」為「→ DAY 01」短 day index。Page header 已顯完整日期。 */}
                {hasDay
                  ? <>已選 <strong>{totalSelected}</strong> 個 → DAY {String(dayNum).padStart(2, '0')}</>
                  : <>請先選擇加入哪天</>
                }
                {submitError && <span style={{ color: 'var(--color-destructive)', marginLeft: 8 }}>{submitError}</span>}
              </span>
              <div className="tp-add-stop-actions">
                <button
                  type="button"
                  className="tp-add-stop-btn tp-add-stop-btn-cancel"
                  onClick={handleBack}
                  disabled={submitting}
                  data-testid="add-stop-cancel"
                >
                  取消
                </button>
                <button
                  type="button"
                  className="tp-add-stop-btn tp-add-stop-btn-confirm"
                  onClick={() => void handleConfirm()}
                  disabled={!confirmEnabled}
                  data-testid="add-stop-confirm"
                >
                  {submitting ? '加入中⋯' : '完成'}
                </button>
              </div>
            </div>
          </div>
        }
        bottomNav={<GlobalBottomNav authed={user !== null} />}
      />
    </>
  );
}
