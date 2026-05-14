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
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import TitleBarPrimaryAction from '../components/shell/TitleBarPrimaryAction';
import Icon from '../components/shared/Icon';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { usePoiSearch } from '../hooks/usePoiSearch';
import { apiFetch, apiFetchRaw } from '../lib/apiClient';
import { regionToApiParam } from '../lib/maps/region';
import { mapNominatimCategory } from '../lib/poiCategory';
import type { PoiFavorite } from '../types/api';
import type { PoiSearchResult } from '../types/poi';

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
  min-height: 32px;
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
  font-size: 18px;
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
.tp-change-poi-card-photo[data-tone="ocean"] {
  background: linear-gradient(135deg, var(--color-poi-card-tone-ocean-from), var(--color-poi-card-tone-ocean-to));
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

type Tab = 'search' | 'favorites';
type PoiCardTone = 'warm' | 'cool' | 'ocean' | 'amber';
type ChangePoiCategory = 'all' | 'attraction' | 'food' | 'hotel' | 'shopping';

const REGION_OPTIONS = ['全部地區', '沖繩', '東京', '京都', '首爾', '台南'] as const;

const CATEGORY_TABS: ReadonlyArray<{ key: ChangePoiCategory; label: string }> = [
  { key: 'all', label: '為你推薦' },
  { key: 'attraction', label: '景點' },
  { key: 'food', label: '美食' },
  { key: 'hotel', label: '住宿' },
  { key: 'shopping', label: '購物' },
];

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

function normalizeSearchResults(data: unknown): PoiSearchResult[] {
  const rows = Array.isArray(data)
    ? data
    : (data as { results?: unknown[] })?.results;
  return Array.isArray(rows) ? (rows as PoiSearchResult[]) : [];
}

function matchCategory(category: string | null | undefined, target: ChangePoiCategory): boolean {
  if (target === 'all') return true;
  const cat = (category ?? '').toLowerCase();
  if (target === 'food') return /restaurant|cafe|food|bar|bakery|餐|食/.test(cat);
  if (target === 'hotel') return /hotel|hostel|guest|inn|住宿|飯店/.test(cat);
  if (target === 'shopping') return /shop|mall|market|購物/.test(cat);
  if (target === 'attraction') return /attract|museum|park|temple|景點|公園/.test(cat);
  return false;
}

function poiTone(category: string | null | undefined, index: number): PoiCardTone {
  const cat = (category ?? '').toLowerCase();
  if (/restaurant|cafe|food|bar|bakery|餐|食/.test(cat)) return 'warm';
  if (/shop|mall|market|購物/.test(cat)) return 'amber';
  if (/hotel|hostel|guest|inn|住宿|飯店/.test(cat)) return 'cool';
  const tones: readonly PoiCardTone[] = ['ocean', 'cool', 'amber', 'warm'];
  return tones[index % tones.length] ?? 'ocean';
}

function poiMeta(address: string | null | undefined, category: string | null | undefined): string {
  const primary = (address ?? '').split(',')[0]?.trim();
  return primary || category || '景點';
}

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
  const { user } = useCurrentUser();

  // v2.27.0 multi-POI per entry：?mode=alternate 切換 add-alternate 行為
  // （title 改「加入備選景點」+ CTA 改「加為備選」+ 提交走 POST /alternates）
  // round 4 fix M5: use react-router's useSearchParams (reactive + SSR-safe) instead
  // of raw window.location.search which doesn't re-render on client-side route changes.
  const [searchParams, setSearchParams] = useSearchParams();
  const mode: 'master' | 'alternate' = searchParams.get('mode') === 'alternate' ? 'alternate' : 'master';
  const tab: Tab = searchParams.get('tab') === 'favorites' ? 'favorites' : 'search';
  const pageTitle = mode === 'alternate' ? '加入備選景點' : '置換景點';
  const submitLabel = mode === 'alternate' ? '加為備選' : '置換景點';

  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<string>('全部地區');
  const [regionMenuOpen, setRegionMenuOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [category, setCategory] = useState<ChangePoiCategory>('all');
  const [selected, setSelected] = useState<SelectedPoi | null>(null);
  const [favorites, setFavorites] = useState<PoiFavorite[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // v2.27.0 OCC token: GET on mount, attach to PUT /poi-id + POST /alternates body so
  // concurrent multi-POI mutation (other tab swap / EditEntryPage) flips us to 409
  // STALE_ENTRY instead of silently overwriting.
  const [entryPoisVersion, setEntryPoisVersion] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
  }, [tripId, entryId]);

  const handleSubmit = useCallback(async () => {
    if (!selected || !tripId || !Number.isInteger(entryId) || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
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
            if (code === 'DUPLICATE_POI') throw new Error('此景點已存在於 stop 中');
            throw new Error('資料已被其他操作更新，請重新整理');
          }
          throw new Error(`加備選失敗 (${res.status}): ${text.slice(0, 200)}`);
        }
        window.dispatchEvent(new CustomEvent('tp-entry-updated', { detail: { tripId } }));
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
      void apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/recompute-travel`, {
        method: 'POST',
      }).catch(() => undefined);
      window.dispatchEvent(new CustomEvent('tp-entry-updated', { detail: { tripId } }));
      navigate(`/trips?selected=${encodeURIComponent(tripId)}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '置換景點失敗');
      setSubmitting(false);
    }
  }, [selected, tripId, entryId, submitting, navigate, mode, buildSearchPoiBody, entryPoisVersion]);

  const titleBarActions = useMemo(() => (
    <TitleBarPrimaryAction
      label={submitLabel}
      busyLabel="處理中⋯"
      busy={submitting}
      disabled={!selected}
      onClick={() => void handleSubmit()}
      testId="change-poi-titlebar-submit"
    />
  ), [handleSubmit, selected, submitLabel, submitting]);

  const categoryFilter = useMemo(() => (
    <div className="tp-change-poi-subtabs" role="group" aria-label="POI 類別">
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

  const main = useMemo(() => (
    <div className="tp-change-poi-page-shell" data-testid="change-poi-page">
      <style>{SCOPED_STYLES}</style>
      <TitleBar title={pageTitle} back={goBack} actions={titleBarActions} />

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
                輸入關鍵字搜尋，或切到「收藏」tab 從你儲存的 POI 選取
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
                <h3 className="tp-change-poi-result-title">熱門景點 · {region}</h3>
                <div className="tp-change-poi-grid">
                  {filteredSearchResults.map((result, index) => {
                    const isSelected = selected?.source === 'search' && selected.name === result.name && selected.lat === result.lat;
                    return (
                      <button
                        key={result.place_id}
                        type="button"
                        className={`tp-change-poi-card ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => setSelected({
                          source: 'search',
                          name: result.name,
                          lat: result.lat,
                          lng: result.lng,
                          address: result.address,
                          type: mapNominatimCategory(result.category ?? ''),
                          category: result.category,
                          rating: result.rating ?? null,
                          country: result.country ?? null,
                        })}
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
                            <Icon name="star" />
                            {poiMeta(result.address, result.category)}
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
                        onClick={() => setSelected({
                          source: 'favorite',
                          poiId: favorite.poiId,
                          name: favorite.poiName ?? '',
                          lat: favorite.poiLat ?? 0,
                          lng: favorite.poiLng ?? 0,
                          address: favorite.poiAddress,
                          type: favorite.poiType ?? null,
                        })}
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
                            <Icon name="star" />
                            {poiMeta(favorite.poiAddress, favorite.poiType)}
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
      </main>

      <div className="tp-page-bottom-bar">
        <span className="tp-change-poi-counter" data-testid="change-poi-counter">
          已選 <strong>{selected ? 1 : 0}</strong> 個
          {selected ? ` · ${selected.name}` : ''}
          {error && <span className="tp-change-poi-error" role="alert">{error}</span>}
        </span>
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
            disabled={!selected || submitting}
            onClick={() => void handleSubmit()}
            data-testid="change-poi-submit"
          >
            {submitting ? '處理中⋯' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  ), [
    category,
    categoryFilter,
    error,
    favorites,
    filterSheetOpen,
    filteredFavorites,
    filteredSearchResults,
    goBack,
    handleSearchInput,
    handleSubmit,
    handleTabChange,
    pageTitle,
    query,
    region,
    regionMenuOpen,
    searchResults.length,
    searching,
    selected,
    submitting,
    submitLabel,
    tab,
    titleBarActions,
  ]);

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={main}
      bottomNav={<GlobalBottomNav authed={!!user} />}
    />
  );
}
