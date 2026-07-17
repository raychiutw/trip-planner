/**
 * ChangePoiPage — v2.23.8 變更 POI 全頁 form。
 *
 * Route: /trip/:id/stop/:eid/change-poi
 *
 * Use case：user 在 timeline row action 點「變更 POI」 → 進此頁，搜尋
 * + 選新 POI（search 或 favorites）→ submit 走 `PUT /api/trips/:id/entries/:eid/poi-id`
 * find-or-create mode（{name, lat, lng, source}）或 favorite mode ({poiId})。
 *
 * 完成後 fire-and-forget recompute travel + navigate 回 trip view。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import OperationShell from '../components/shell/OperationShell';
import Icon from '../components/shared/Icon';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { usePoiSearch } from '../hooks/usePoiSearch';
import { apiFetch, apiFetchRaw } from '../lib/apiClient';
import { requestTravelRecompute } from '../lib/travelRecompute';
import { EVENT } from '../lib/events';
import { regionToApiParam } from '../lib/maps/region';
import { mapGooglePrimaryTypeToPoiType, mapNominatimCategory, type PoiType } from '../lib/poiCategory';
import {
  REGION_OPTIONS,
  CATEGORY_TABS,
  matchCategory,
  normalizeSearchResults,
  poiTone,
  poiMeta,
  type PoiSearchTab as Tab,
  type PoiSearchCategory,
} from '../lib/poiSearchHelpers';
import type { PoiFavorite } from '../types/api';
// v2.31.98: 自訂 tab — 同 AddStopPage 共用 CustomPoiForm shared component。
import { CustomPoiForm, type CustomPoiCoord } from '../components/trip/CustomPoiForm';
import { EditableCategoryChip } from '../components/trip/EditableCategoryChip';
import {
  selectDefaultCenter,
  type Coord as PickerCoord,
} from '../lib/locationPicker';

interface TripDestApiLite {
  destOrder: number;
  name: string;
  lat?: number | null;
  lng?: number | null;
}

const SCOPED_STYLES = `
.tp-change-poi-page-shell {
  min-height: 100%;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
}
.tp-change-poi-tabs {
  display: flex;
  padding: 0 20px;
  border-bottom: 1px solid var(--color-border);
  margin-top: 8px;
}
.tp-change-poi-tab {
  border: 0;
  background: transparent;
  padding: 12px 16px;
  font: inherit;
  font-size: var(--font-size-callout);
  font-weight: 600;
  color: var(--color-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tp-change-poi-tab:hover {
  color: var(--color-foreground);
}
.tp-change-poi-tab.is-active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}
.tp-change-poi-body {
  flex: 1;
  min-height: 0;
  padding: 16px 20px 96px;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
}
@media (min-width: 768px) {
  .tp-change-poi-body {
    padding: 16px 24px 96px;
  }
}
/* v2.31.98: 自訂 tab 兩段式 layout 需要更寬空間（mockup C 1024px）。
   :has() 只在 ≥1024px 撐大；其他 tab 仍維持 720px 不變。 */
@media (min-width: 1024px) {
  .tp-change-poi-body:has(.tp-custom-poi-form-twopane) {
    max-width: 1024px;
    padding-left: 0;
    padding-right: 0;
  }
}
.tp-change-poi-subtabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 16px;
}
.tp-change-poi-subtab {
  border: 1px solid var(--color-border);
  background: var(--color-background);
  padding: 6px 12px;
  border-radius: var(--radius-full);
  font: inherit;
  font-size: var(--font-size-footnote);
  font-weight: 600;
  color: var(--color-foreground);
  cursor: pointer;
  min-height: var(--spacing-tap-min);
}
.tp-change-poi-subtab.is-active {
  background: var(--color-foreground);
  color: var(--color-accent-foreground);
  border-color: var(--color-foreground);
}
.tp-change-poi-region-row {
  position: relative;
  margin-bottom: 14px;
}
.tp-change-poi-region-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: var(--font-size-headline);
  font-weight: 700;
  letter-spacing: 0;
  color: var(--color-foreground);
  cursor: pointer;
}
.tp-change-poi-region-pill:hover {
  color: var(--color-accent-deep);
}
.tp-change-poi-region-pill .svg-icon {
  width: 14px;
  height: 14px;
  color: var(--color-muted);
}
.tp-change-poi-region-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 1;
  min-width: 160px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  list-style: none;
  padding: 4px;
  margin: 0;
}
.tp-change-poi-region-menu li button {
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: var(--font-size-footnote);
  color: var(--color-foreground);
  cursor: pointer;
  border-radius: var(--radius-sm);
}
.tp-change-poi-region-menu li button:hover {
  background: var(--color-hover);
}
.tp-change-poi-region-menu li[aria-selected="true"] button {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  font-weight: 700;
}
.tp-change-poi-search-row {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.tp-change-poi-search {
  position: relative;
  flex: 1;
  min-width: 0;
}
.tp-change-poi-search .svg-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--color-muted);
  pointer-events: none;
}
.tp-change-poi-search input {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  min-height: 44px;
  padding: 8px 14px 8px 36px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-secondary);
  font: inherit;
  font-size: var(--font-size-callout);
  color: var(--color-foreground);
  -webkit-text-fill-color: var(--color-foreground);
  caret-color: var(--color-foreground);
  outline: none;
}
.tp-change-poi-search input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-subtle);
}
.tp-change-poi-search input::placeholder {
  color: var(--color-muted);
  -webkit-text-fill-color: var(--color-muted);
  opacity: 1;
}
.tp-change-poi-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-background);
  font: inherit;
  font-size: var(--font-size-footnote);
  font-weight: 600;
  color: var(--color-foreground);
  cursor: pointer;
  min-height: 40px;
  flex-shrink: 0;
}
.tp-change-poi-filter-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent-deep);
}
.tp-change-poi-filter-btn .svg-icon {
  width: 14px;
  height: 14px;
  color: var(--color-muted);
}
.tp-change-poi-filter-sheet {
  margin: 0 0 12px;
  padding: 12px;
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
}
.tp-change-poi-result-title {
  font-size: var(--font-size-callout);
  font-weight: 700;
  margin: 0 0 10px;
  letter-spacing: 0;
}
.tp-change-poi-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.tp-change-poi-card {
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
.tp-change-poi-card:hover {
  border-color: var(--color-accent);
}
.tp-change-poi-card.is-selected {
  border-color: var(--color-accent);
  background: var(--color-background);
}
.tp-change-poi-card-photo {
  height: 96px;
  display: grid;
  place-items: center;
}
.tp-change-poi-card-photo[data-tone="warm"] {
  background: linear-gradient(135deg, var(--color-accent-bg), var(--color-tertiary));
}
.tp-change-poi-card-photo[data-tone="cool"] {
  background: linear-gradient(135deg, var(--color-poi-card-tone-cool-from), var(--color-poi-card-tone-cool-to));
}
.tp-change-poi-card-photo[data-tone="blue"] {
  background: linear-gradient(135deg, var(--color-poi-card-tone-tp-from), var(--color-poi-card-tone-tp-to));
}
.tp-change-poi-card-photo[data-tone="amber"] {
  background: linear-gradient(135deg, var(--color-poi-card-tone-amber-from), var(--color-poi-card-tone-amber-to));
}
.tp-change-poi-card-photo .svg-icon {
  width: 32px;
  height: 32px;
  color: var(--color-poi-card-tone-icon);
  filter: drop-shadow(0 1px 2px var(--color-poi-card-tone-icon-shadow));
}
.tp-change-poi-card-add {
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
.tp-change-poi-card-add .svg-icon {
  width: 12px;
  height: 12px;
}
.tp-change-poi-card.is-selected .tp-change-poi-card-add {
  background: var(--color-success);
}
.tp-change-poi-card-body {
  min-width: 0;
  padding: 10px 12px;
}
.tp-change-poi-card-name {
  font-weight: 700;
  font-size: var(--font-size-callout);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0;
  margin-bottom: 4px;
}
.tp-change-poi-card-meta {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tp-change-poi-card-meta .svg-icon {
  width: 10px;
  height: 10px;
  color: var(--color-warning);
  vertical-align: -1px;
  margin-right: 4px;
}
.tp-change-poi-card-meta-sep {
  margin: 0 6px;
  opacity: 0.6;
}
.tp-change-poi-empty {
  min-height: 260px;
  padding: 40px 20px;
  text-align: center;
  color: var(--color-muted);
  font-size: var(--font-size-callout);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}
.tp-change-poi-empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  display: grid;
  place-items: center;
}
.tp-change-poi-empty-icon .svg-icon {
  width: 28px;
  height: 28px;
}
.tp-change-poi-empty-title {
  font-size: var(--font-size-callout);
  font-weight: 700;
  color: var(--color-foreground);
}
.tp-change-poi-empty-desc {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  max-width: 280px;
  line-height: 1.6;
}
.tp-change-poi-favorites-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 14px;
  padding: 0 2px;
}
.tp-change-poi-favorites-title {
  font-size: var(--font-size-callout);
  font-weight: 700;
  margin: 0;
}
.tp-change-poi-favorites-sort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: var(--color-muted);
  font: inherit;
  font-size: var(--font-size-caption);
}
.tp-change-poi-counter {
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
  flex: 0 0 auto;
  white-space: nowrap;
}
.tp-change-poi-counter strong {
  color: var(--color-foreground);
}
/* v2.50.0: mode=new 搜尋結果分類 chip — bottom bar 獨立 flex item。
   共用 .tp-page-bottom-bar（css/tokens.css）是 gap:12px、無 flex-wrap、space-between，
   多一個 chip 在窄螢幕會擠/溢出 → 本頁 scoped override 加 flex-wrap（對齊 EditTripPage 作法），
   讓 chip + 動作按鈕在窄螢幕換行。 */
.tp-page-bottom-bar {
  flex-wrap: wrap;
}
.tp-change-poi-cat {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
}
.tp-change-poi-actions {
  display: flex;
  gap: 8px;
  flex: 1;
  min-width: 0;
  justify-content: flex-end;
}
.tp-change-poi-btn {
  min-height: 40px;
  padding: 8px 16px;
  border-radius: var(--radius-full);
  font: inherit;
  font-size: var(--font-size-footnote);
  font-weight: 700;
  cursor: pointer;
}
.tp-change-poi-btn-cancel {
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-foreground);
}
.tp-change-poi-btn-confirm {
  border: 1px solid var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  min-width: 112px;
}
.tp-change-poi-btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.tp-change-poi-error {
  color: var(--color-destructive);
  margin-left: 8px;
}
@media (max-width: 760px) {
  .tp-change-poi-grid {
    grid-template-columns: 1fr;
  }
  .tp-change-poi-actions {
    width: 100%;
  }
  .tp-change-poi-btn {
    flex: 1;
  }
}
`;

// v2.33.34: Tab / PoiCardTone / REGION_OPTIONS / CATEGORY_TABS extract 到
// src/lib/poiSearchHelpers.ts (shared with AddStopPage)。
type ChangePoiCategory = PoiSearchCategory;

interface SelectedPoi {
  source: 'search' | 'favorite';
  /** for favorite mode: pre-existing POI id */
  poiId?: number;
  /** for search mode: payload to send find-or-create */
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
  type?: string | null;
  category?: string | null;
  rating?: number | null;
  country?: string | null;
}

// v2.33.34: normalizeSearchResults / matchCategory / poiTone / poiMeta extract
// to src/lib/poiSearchHelpers.ts. ChangePoi 之前 normalizeSearchResults 是
// cast-only 無 type 檢查；現在用 shared 嚴格版（同 AddStop pre-extract 行為）。

function parseErrorCode(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as { error?: { code?: string } };
    return parsed.error?.code ?? null;
  } catch {
    return null;
  }
}

export default function ChangePoiPage() {
  const { tripId, entryId: entryIdParam } = useParams<{ tripId: string; entryId: string }>();
  const entryId = Number(entryIdParam);
  const navigate = useNavigate();
  const goBack = useNavigateBack(tripId ? `/trips?selected=${tripId}` : '/trips');

  // v2.27.0 multi-POI per entry：?mode=alternate 切換 add-alternate 行為
  // （title 改「加入備選景點」+ CTA 改「加為備選」+ 提交走 POST /alternates）
  // round 4 fix M5: use react-router's useSearchParams (reactive + SSR-safe) instead
  // of raw window.location.search which doesn't re-render on client-side route changes.
  const [searchParams, setSearchParams] = useSearchParams();
  // v2.32.0: mode=new → 從 AddEntryPage 過來「新增 entry」流程，submit 走
  // POST /trips/:id/days/:N/entries 而不是 PUT /poi-id 或 POST /alternates。
  // dayNum 從 ?day=N param 取得。完成後 navigate /stop/:newId/edit。
  const rawMode = searchParams.get('mode');
  const mode: 'master' | 'alternate' | 'new' =
    rawMode === 'alternate' ? 'alternate' : rawMode === 'new' ? 'new' : 'master';
  const newDayParam = searchParams.get('day');
  const newDayNum = newDayParam ? parseInt(newDayParam, 10) : NaN;
  const rawTab = searchParams.get('tab');
  const tab: Tab = rawTab === 'favorites' ? 'favorites' : rawTab === 'custom' ? 'custom' : 'search';
  const pageTitle =
    mode === 'new' ? '新增景點' : mode === 'alternate' ? '加入備選景點' : '置換景點';
  const submitLabel =
    mode === 'new' ? '加入行程' : mode === 'alternate' ? '加為備選' : '置換景點';

  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<string>('全部地區');
  const [regionMenuOpen, setRegionMenuOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [category, setCategory] = useState<ChangePoiCategory>('all');
  const [selected, setSelected] = useState<SelectedPoi | null>(null);
  // v2.50.0: mode=new search 加景點時可當場覆寫 auto-derived 分類（單選模型 → 單一 state，
  // 非 AddStopPage 的 Record）。null = 沿用 mapGooglePrimaryTypeToPoiType(selected.category)。
  // 換選取 / 改搜尋 / 切 tab 都 reset null → 每次選取回到自動推導預設。
  const [searchCatOverride, setSearchCatOverride] = useState<PoiType | null>(null);
  const [favorites, setFavorites] = useState<PoiFavorite[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // v2.27.0 OCC token: GET on mount, attach to PUT /poi-id + POST /alternates body so
  // concurrent multi-POI mutation (other tab swap / EditEntryPage) flips us to 409
  // STALE_ENTRY instead of silently overwriting.
  const [entryPoisVersion, setEntryPoisVersion] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // v2.31.98: 自訂 tab state（同 AddStopPage 模式）。
  const [customTitle, setCustomTitle] = useState('');
  const [customCoord, setCustomCoord] = useState<CustomPoiCoord | null>(null);
  const [customHintConfirmed, setCustomHintConfirmed] = useState(false);
  // 自訂 stop 無 Google 來源 → 預設 'attraction'，使用者用 CategoryPicker 可改。
  const [customCategory, setCustomCategory] = useState<PoiType>('attraction');
  const [customError, setCustomError] = useState<string | null>(null);
  // v2.32.1 fix: 初值改 null（"未載入"），與「載入後是 0 個 destinations」區分。
  // LocationPickerMap 只用 mount 時的 initialCenter，若 customDestinations 還是 null
  // 就 render 會卡在 Tokyo Station fallback 改不掉 — 必須等 fetch 完才能 mount。
  const [customDestinations, setCustomDestinations] = useState<TripDestApiLite[] | null>(null);

  const { results: searchResults, searching } = usePoiSearch({
    enabled: tab === 'search',
    query: query.trim(),
    region: regionToApiParam(region),
    limit: 20,
    normalise: normalizeSearchResults,
  });

  const handleSearchInput = useCallback((event: FormEvent<HTMLInputElement>) => {
    setQuery(event.currentTarget.value);
    setSelected(null);
    setSearchCatOverride(null);
  }, []);

  const buildSearchPoiBody = useCallback((poi: SelectedPoi) => ({
    name: poi.name,
    lat: poi.lat,
    lng: poi.lng,
    type: poi.type ?? mapNominatimCategory(poi.category ?? ''),
    category: poi.category ?? undefined,
    address: poi.address ?? undefined,
    rating: poi.rating ?? undefined,
    country: poi.country ?? undefined,
    source: 'google',
  }), []);

  const handleTabChange = useCallback((nextTab: Tab) => {
    if (nextTab === tab) return;
    setSelected(null);
    setSearchCatOverride(null);
    const next = new URLSearchParams(searchParams);
    next.set('tab', nextTab);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, tab]);

  const filteredSearchResults = useMemo(
    () => searchResults.filter((result) => matchCategory(result.category, category)),
    [category, searchResults],
  );

  const filteredFavorites = useMemo(
    () => (favorites ?? []).filter((favorite) => matchCategory(favorite.poiType, category)),
    [category, favorites],
  );

  useEffect(() => {
    if (tab !== 'favorites' || favorites !== null) return;
    let cancelled = false;
    apiFetch<PoiFavorite[]>('/poi-favorites')
      .then((data) => {
        if (cancelled) return;
        setFavorites(data);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [tab, favorites]);

  useEffect(() => {
    // v2.32.0: mode=new 不對應任何既有 entry，跳過 entryPoisVersion fetch（OCC token
    // 只在 PUT /poi-id + POST /alternates 用得到）
    if (mode === 'new') return;
    if (!tripId || !Number.isInteger(entryId)) return;
    let cancelled = false;
    apiFetch<{ entryPoisVersion?: string | number | null }>(
      `/trips/${encodeURIComponent(tripId)}/entries/${entryId}`,
    )
      .then((data) => {
        if (cancelled) return;
        if (data.entryPoisVersion != null) setEntryPoisVersion(String(data.entryPoisVersion));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [tripId, entryId, mode]);

  // v2.31.98: 自訂 tab map default-center fallback chain 從 trip destinations 取
  // v2.32.1 fix: 從 tab-gated 改 mount-gated — user 可能直接 ?tab=custom 進來，
  // 等切到 custom 才 fetch 已晚 (LocationPickerMap 一 mount 就鎖 initialCenter)。
  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    apiFetch<{ destinations?: TripDestApiLite[] }>(`/trips/${encodeURIComponent(tripId)}`)
      .then((data) => {
        if (cancelled) return;
        setCustomDestinations(data?.destinations ?? []);
      })
      .catch(() => {
        // Network fail → 標 [] 讓 customInitialCenter fallback 到 Tokyo（已是
        // 最後一道安全網），避免 null 永遠卡 render
        if (!cancelled) setCustomDestinations([]);
      });
    return () => { cancelled = true; };
  }, [tripId]);

  const customInitialCenter = useMemo<PickerCoord>(() => {
    return selectDefaultCenter({
      prevEntry: null,
      tripDestinations: (customDestinations ?? [])
        .filter((d) => typeof d.lat === 'number' && typeof d.lng === 'number')
        .map((d) => ({ lat: d.lat as number, lng: d.lng as number })),
    });
  }, [customDestinations]);

  const handleSubmit = useCallback(async () => {
    if (!tripId || submitting) return;
    // v2.32.0: mode=new 不需要 entryId，但需要 day param；其他 mode 需要 entryId。
    if (mode !== 'new' && !Number.isInteger(entryId)) return;
    if (mode === 'new' && !Number.isFinite(newDayNum)) return;
    // v2.31.98: custom tab 走自己的 payload 構造（title + coord + source: 'custom'），
    // search/favorites tab 仍走 selected POI 路徑。
    if (tab === 'custom') {
      const title = customTitle.trim();
      if (!title) { setCustomError('請輸入標題'); return; }
      if (!customCoord) { setCustomError('請在地圖上選擇位置'); return; }
      setSubmitting(true);
      setError(null);
      try {
        // v2.32.0: mode=new 走 POST /entries（建立新 entry + master），不需 OCC
        if (mode === 'new') {
        const body = { name: title, lat: customCoord.lat, lng: customCoord.lng, source: 'custom', poi_type: customCategory };
          const res = await apiFetchRaw(
            `/trips/${encodeURIComponent(tripId)}/days/${newDayNum}/entries`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
          );
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`新增景點失敗 (${res.status}): ${text.slice(0, 200)}`);
          }
          const created = (await res.json()) as { id?: number };
          void requestTravelRecompute(tripId).catch(() => undefined);
          window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId } }));
          if (created.id) {
            navigate(`/trip/${encodeURIComponent(tripId)}/stop/${created.id}/edit`, { replace: true });
          } else {
            navigate(`/trips?selected=${encodeURIComponent(tripId)}`, { replace: true });
          }
          return;
        }
        const occ = entryPoisVersion != null ? { entryPoisVersion } : {};
        // /alternates + /poi-id find-or-create read body.type (snake_case poi_type is
        // only for POST /entries). Forward the picked custom category here too.
        const body = { name: title, lat: customCoord.lat, lng: customCoord.lng, source: 'custom', type: customCategory, ...occ };
        const endpoint = mode === 'alternate'
          ? `/trips/${encodeURIComponent(tripId)}/entries/${entryId}/alternates`
          : `/trips/${encodeURIComponent(tripId)}/entries/${entryId}/poi-id`;
        const res = await apiFetchRaw(endpoint, {
          method: mode === 'alternate' ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const text = await res.text();
          if (res.status === 409) {
            const code = parseErrorCode(text);
            if (code === 'DUPLICATE_POI') throw new Error('此景點已存在於這個停留點');
            throw new Error('資料已被其他操作更新，請重新整理');
          }
          throw new Error(`${mode === 'alternate' ? '加備選' : '置換'}失敗 (${res.status}): ${text.slice(0, 200)}`);
        }
        if (mode === 'master') {
          void requestTravelRecompute(tripId).catch(() => undefined);
        }
        window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId } }));
        navigate(
          mode === 'alternate'
            ? `/trip/${encodeURIComponent(tripId)}/stop/${entryId}/edit`
            : `/trips?selected=${encodeURIComponent(tripId)}`,
          { replace: true },
        );
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : '失敗');
        setSubmitting(false);
        return;
      }
    }
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      // v2.32.0: mode=new 走 POST /entries — search/favorites picked POI 改 body shape
      if (mode === 'new') {
        const fromFav = selected.source === 'favorite' && selected.poiId;
        const body = fromFav
          ? { name: selected.name, poiId: selected.poiId, source: 'favorite' }
          : {
              name: selected.name,
              lat: selected.lat,
              lng: selected.lng,
              source: 'google',
              note: selected.address ?? undefined,
              // v2.50.0: 使用者當場覆寫的分類優先，否則沿用 Google primaryType auto-derive。
              poi_type: searchCatOverride ?? mapGooglePrimaryTypeToPoiType(selected.category),
            };
        const res = await apiFetchRaw(
          `/trips/${encodeURIComponent(tripId)}/days/${newDayNum}/entries`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`新增景點失敗 (${res.status}): ${text.slice(0, 200)}`);
        }
        const created = (await res.json()) as { id?: number };
        void requestTravelRecompute(tripId).catch(() => undefined);
        window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId } }));
        if (created.id) {
          navigate(`/trip/${encodeURIComponent(tripId)}/stop/${created.id}/edit`, { replace: true });
        } else {
          navigate(`/trips?selected=${encodeURIComponent(tripId)}`, { replace: true });
        }
        return;
      }
      const occ = entryPoisVersion != null ? { entryPoisVersion } : {};
      if (mode === 'alternate') {
        const body = {
          ...(selected.source === 'favorite' && selected.poiId
            ? { poiId: selected.poiId }
            : buildSearchPoiBody(selected)),
          ...occ,
        };
        const res = await apiFetchRaw(
          `/trips/${encodeURIComponent(tripId)}/entries/${entryId}/alternates`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        );
        if (!res.ok) {
          const text = await res.text();
          if (res.status === 409) {
            const code = parseErrorCode(text);
            if (code === 'DUPLICATE_POI') throw new Error('此景點已存在於這個停留點');
            throw new Error('資料已被其他操作更新，請重新整理');
          }
          throw new Error(`加備選失敗 (${res.status}): ${text.slice(0, 200)}`);
        }
        window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId } }));
        navigate(`/trip/${encodeURIComponent(tripId)}/stop/${entryId}/edit`, { replace: true });
        return;
      }

      // master 模式（既有 PUT /poi-id 流程）
      const body = {
        ...(selected.source === 'favorite' && selected.poiId
          ? { poiId: selected.poiId }
          : buildSearchPoiBody(selected)),
        ...occ,
      };
      const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/entries/${entryId}/poi-id`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 409) {
          throw new Error('資料已被其他操作更新，請重新整理');
        }
        throw new Error(`PUT 失敗 (${res.status}): ${text.slice(0, 200)}`);
      }
      // fire-and-forget recompute current day（user 換 POI 後 distance/min 應更新）
      void requestTravelRecompute(tripId).catch(() => undefined);
      window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId } }));
      navigate(`/trips?selected=${encodeURIComponent(tripId)}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '置換景點失敗');
      setSubmitting(false);
    }
    // customCategory MUST be here: handleSubmit reads it for the custom-tab payload
    // (poi_type / type). v2.50.0 added the state but never threaded it in → the
    // callback closed over the initial 'attraction' → custom POIs always saved as 景點.
  }, [selected, searchCatOverride, tripId, entryId, submitting, navigate, mode, buildSearchPoiBody, entryPoisVersion, tab, customTitle, customCoord, customCategory, newDayNum]);

  // v2.31.98: custom tab submit 啟動條件不同（要 title + coord，不要 selected）
  const submitDisabled = tab === 'custom'
    ? !customTitle.trim() || !customCoord || submitting
    : !selected || submitting;

  // v2.33.141: 拔 titleBar 右上 ✓ submit action — bottom sticky bar 已有
  // primary button 同 submitLabel (加為備選 / 加入行程 / 置換景點)，完全重複。
  // user feedback 2026-05-28「右上角紅框移除」。

  const categoryFilter = useMemo(() => (
    <div className="tp-change-poi-subtabs" role="group" aria-label="景點類別">
      {CATEGORY_TABS.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={category === item.key}
          className={`tp-change-poi-subtab ${category === item.key ? 'is-active' : ''}`}
          onClick={() => setCategory(item.key)}
          data-testid={`change-poi-subtab-${item.key}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  ), [category]);

  // 刻意「不」memoize：直接組 JSX。曾用 useMemo + 手維護 30 項 dep array，但 v2.50.0 加
  // customCategory 卻沒同步進 deps → memoized JSX 變 stale（picker 凍住 / 存錯分類，v2.54.4
  // 修）。對齊 AddStopPage（render 非 memoized、所以同類 bug 從未發生）。整頁 re-render 時
  // React 會 reconcile（LocationPickerMap 無 key、useGoogleMap 只 init 一次 → map 不 remount），
  // 成本微小，換來「加 state 不必記得改 dep array」的正確性。move-state-add-bug 不再可能。
  const main = (
    <OperationShell
      shellClassName="tp-change-poi-page-shell"
      testId="change-poi-page"
      title={pageTitle}
      back={goBack}
      scopedStyles={SCOPED_STYLES}
    >

      <div className="tp-change-poi-tabs" role="tablist" aria-label="景點來源">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'search'}
          className={`tp-change-poi-tab ${tab === 'search' ? 'is-active' : ''}`}
          onClick={() => handleTabChange('search')}
          data-testid="change-poi-tab-search"
        >
          搜尋
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'favorites'}
          className={`tp-change-poi-tab ${tab === 'favorites' ? 'is-active' : ''}`}
          onClick={() => handleTabChange('favorites')}
          data-testid="change-poi-tab-favorites"
        >
          收藏
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'custom'}
          className={`tp-change-poi-tab ${tab === 'custom' ? 'is-active' : ''}`}
          onClick={() => handleTabChange('custom')}
          data-testid="change-poi-tab-custom"
        >
          自訂
        </button>
      </div>

      <main className="tp-change-poi-body">
        {tab === 'search' && (
          <>
            <div className="tp-change-poi-region-row">
              <button
                type="button"
                className="tp-change-poi-region-pill"
                onClick={() => setRegionMenuOpen((open) => !open)}
                data-testid="change-poi-region-pill"
                aria-haspopup="listbox"
                aria-expanded={regionMenuOpen}
              >
                {region} <Icon name="chevron-down" />
              </button>
              {regionMenuOpen && (
                <ul
                  className="tp-change-poi-region-menu"
                  role="listbox"
                  aria-label="切換地區"
                  data-testid="change-poi-region-menu"
                >
                  {REGION_OPTIONS.map((option) => (
                    <li key={option} role="option" aria-selected={region === option}>
                      <button
                        type="button"
                        onClick={() => {
                          setRegion(option);
                          setRegionMenuOpen(false);
                        }}
                        data-testid={`change-poi-region-opt-${option}`}
                      >
                        {option}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="tp-change-poi-search-row">
              <div className="tp-change-poi-search">
                <Icon name="search" />
                <input
                  ref={inputRef}
                  type="text"
                  defaultValue={query}
                  onInput={handleSearchInput}
                  onChange={handleSearchInput}
                  onCompositionEnd={handleSearchInput}
                  autoComplete="off"
                  enterKeyHint="search"
                  placeholder="搜尋景點、餐廳、住宿⋯"
                  data-testid="change-poi-search-input"
                />
              </div>
              <button
                type="button"
                className="tp-change-poi-filter-btn"
                onClick={() => setFilterSheetOpen((open) => !open)}
                aria-label="篩選"
                aria-expanded={filterSheetOpen}
                data-testid="change-poi-filter-btn"
              >
                <Icon name="filter" />
                <span>篩選</span>
              </button>
            </div>

            {filterSheetOpen && (
              <div className="tp-change-poi-filter-sheet" role="region" aria-label="篩選" data-testid="change-poi-filter-sheet">
                可用上方類別切換景點、美食、住宿與購物結果。
              </div>
            )}

            {categoryFilter}

            {searching && <div className="tp-change-poi-empty">搜尋中⋯</div>}
            {!searching && query.trim().length === 0 && (
              <div className="tp-change-poi-empty">
                輸入關鍵字搜尋，或切到「收藏」分頁從你儲存的景點選取
              </div>
            )}
            {!searching && query.trim().length >= 2 && searchResults.length === 0 && (
              <div className="tp-change-poi-empty">沒有找到結果，換個關鍵字試試</div>
            )}
            {!searching && searchResults.length > 0 && filteredSearchResults.length === 0 && (
              <div className="tp-change-poi-empty">符合類別篩選的結果為 0，試著切到「為你推薦」看全部</div>
            )}
            {filteredSearchResults.length > 0 && (
              <>
                <h3 className="tp-change-poi-result-title">
                  {query.trim().length >= 2 ? '搜尋結果' : '熱門景點'} · {region}
                </h3>
                <div className="tp-change-poi-grid">
                  {filteredSearchResults.map((result, index) => {
                    const isSelected = selected?.source === 'search' && selected.name === result.name && selected.lat === result.lat;
                    return (
                      <button
                        key={result.place_id}
                        type="button"
                        className={`tp-change-poi-card ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => {
                          setSelected({
                            source: 'search',
                            name: result.name,
                            lat: result.lat,
                            lng: result.lng,
                            address: result.address,
                            type: mapNominatimCategory(result.category ?? ''),
                            category: result.category,
                            rating: result.rating ?? null,
                            country: result.country ?? null,
                          });
                          setSearchCatOverride(null);
                        }}
                        aria-pressed={isSelected}
                        data-testid={`change-poi-search-item-${result.place_id}`}
                      >
                        <div className="tp-change-poi-card-photo" data-tone={poiTone(result.category, index)}>
                          <Icon name="location-pin" />
                        </div>
                        <span className="tp-change-poi-card-add">
                          <Icon name={isSelected ? 'check' : 'plus'} />
                          {isSelected ? '已選' : '選取'}
                        </span>
                        <div className="tp-change-poi-card-body">
                          <div className="tp-change-poi-card-name">{result.name}</div>
                          <div className="tp-change-poi-card-meta">
                            {typeof result.rating === 'number' && (
                              <>
                                <Icon name="star" />
                                <span>{result.rating.toFixed(1)}</span>
                                <span className="tp-change-poi-card-meta-sep">·</span>
                              </>
                            )}
                            <span>{poiMeta(result.address, result.category)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'favorites' && (
          <>
            {categoryFilter}
            {!favorites && <div className="tp-change-poi-empty">載入收藏⋯</div>}
            {favorites?.length === 0 && (
              <div className="tp-change-poi-empty">
                <div className="tp-change-poi-empty-icon"><Icon name="heart" /></div>
                <div className="tp-change-poi-empty-title">還沒收藏景點</div>
                <div className="tp-change-poi-empty-desc">在探索頁或地圖上收藏地點，下次就能直接從這裡選取。</div>
              </div>
            )}
            {favorites !== null && favorites.length > 0 && filteredFavorites.length === 0 && (
              <div className="tp-change-poi-empty">符合類別篩選的收藏為 0，試著切到「為你推薦」看全部</div>
            )}
            {filteredFavorites.length > 0 && (
              <>
                <div className="tp-change-poi-favorites-header">
                  <h3 className="tp-change-poi-favorites-title">收藏 · {favorites?.length ?? 0} 個景點</h3>
                  <span className="tp-change-poi-favorites-sort">按收藏時間排序 <Icon name="chevron-down" /></span>
                </div>
                <div className="tp-change-poi-grid">
                  {filteredFavorites.map((favorite, index) => {
                    const isSelected = selected?.source === 'favorite' && selected.poiId === favorite.poiId;
                    return (
                      <button
                        key={favorite.id}
                        type="button"
                        className={`tp-change-poi-card ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => {
                          setSelected({
                            source: 'favorite',
                            poiId: favorite.poiId,
                            name: favorite.poiName ?? '',
                            lat: favorite.poiLat ?? 0,
                            lng: favorite.poiLng ?? 0,
                            address: favorite.poiAddress,
                            type: favorite.poiType ?? null,
                          });
                          // 維持「每次換選取都 reset override」不變式（favorite 不讀 override，
                          // 但保持狀態乾淨，避免回切搜尋時殘留）。
                          setSearchCatOverride(null);
                        }}
                        aria-pressed={isSelected}
                        data-testid={`change-poi-favorite-item-${favorite.id}`}
                      >
                        <div className="tp-change-poi-card-photo" data-tone={poiTone(favorite.poiType, index)}>
                          <Icon name="location-pin" />
                        </div>
                        <span className="tp-change-poi-card-add">
                          <Icon name={isSelected ? 'check' : 'plus'} />
                          {isSelected ? '已選' : '選取'}
                        </span>
                        <div className="tp-change-poi-card-body">
                          <div className="tp-change-poi-card-name">{favorite.poiName}</div>
                          <div className="tp-change-poi-card-meta">
                            {/* v2.31.17: backend SELECT 補 p.rating（poi-favorites GET），
                              * favorites card 跟 search card 一致顯 ★ N.N · address。 */}
                            {typeof favorite.poiRating === 'number' && (
                              <>
                                <Icon name="star" />
                                <span>{favorite.poiRating.toFixed(1)}</span>
                                <span className="tp-change-poi-card-meta-sep">·</span>
                              </>
                            )}
                            <span>{poiMeta(favorite.poiAddress, favorite.poiType)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* v2.32.1 fix: 等 destinations 載完才 mount — LocationPickerMap 鎖 mount 時
            initialCenter，若用 Tokyo fallback render 後沒救（map 不會 re-center）。 */}
        {tab === 'custom' && customDestinations === null && (
          <div className="tp-change-poi-empty" data-testid="change-poi-custom-loading">
            載入中⋯
          </div>
        )}
        {tab === 'custom' && customDestinations !== null && (
          <CustomPoiForm
            title={customTitle}
            onTitleChange={(v) => { setCustomTitle(v); setCustomError(null); }}
            coord={customCoord}
            onCoordChange={setCustomCoord}
            hintConfirmed={customHintConfirmed}
            onHintConfirmedChange={setCustomHintConfirmed}
            initialCenter={customInitialCenter}
            error={customError}
            testIdPrefix="change-poi-custom"
            category={customCategory}
            onCategoryChange={setCustomCategory}
          />
        )}
      </main>

      <div className="tp-page-bottom-bar">
        <span className="tp-change-poi-counter" data-testid="change-poi-counter">
          {tab === 'custom' ? (
            <>已選 <strong>{customTitle.trim() && customCoord ? 1 : 0}</strong> 個{customTitle.trim() ? ` · ${customTitle.trim()}` : ''}</>
          ) : (
            <>已選 <strong>{selected ? 1 : 0}</strong> 個{selected ? ` · ${selected.name}` : ''}</>
          )}
          {error && <span className="tp-change-poi-error" role="alert">{error}</span>}
        </span>
        {/* v2.50.0: 新增景點（mode=new）選了搜尋結果 → 可當場改分類，預設帶 auto-derive。
            獨立 flex item（bottom bar 加 .tp-page-bottom-bar flex-wrap override 讓窄螢幕可換行）。
            chip 在 fixed bottom bar → dropUp 讓 picker 向上彈出（否則被 viewport 底切掉、下排
            分類點不到）。key 綁選取身分 → 換選取時 remount、關掉殘留展開的 picker。
            favorite 來源重用既有 POI（自帶 type）故不顯示。 */}
        {mode === 'new' && selected?.source === 'search' && (
          <span className="tp-change-poi-cat">
            <EditableCategoryChip
              key={`${selected.name}-${selected.lat}-${selected.lng}`}
              value={searchCatOverride ?? mapGooglePrimaryTypeToPoiType(selected.category)}
              autoValue={mapGooglePrimaryTypeToPoiType(selected.category)}
              onChange={setSearchCatOverride}
              dropUp
              testIdPrefix="change-poi-cat"
            />
          </span>
        )}
        <div className="tp-change-poi-actions">
          <button
            type="button"
            className="tp-change-poi-btn tp-change-poi-btn-cancel"
            onClick={goBack}
            disabled={submitting}
            data-testid="change-poi-cancel"
          >
            取消
          </button>
          <button
            type="button"
            className="tp-change-poi-btn tp-change-poi-btn-confirm"
            disabled={submitDisabled}
            onClick={() => void handleSubmit()}
            data-testid="change-poi-submit"
          >
            {submitting ? '處理中⋯' : submitLabel}
          </button>
        </div>
      </div>
    </OperationShell>
  );

  return main;
}
