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
 *   - onClose / onAdded 改 navigate(-1) + dispatch tp-entry-updated
 *   - 完成按鈕同時放 TitleBar action + bottom bar (兩處同步 disabled state)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { apiFetch, apiFetchRaw } from '../lib/apiClient';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import Icon from '../components/shared/Icon';
import ToastContainer, { showToast } from '../components/shared/Toast';

interface PoiSearchResult {
  osm_id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
}

interface SavedPoiRow {
  id: number;
  poiId: number;
  poiName: string;
  poiAddress: string | null;
  poiType: string;
}

interface DayApiRow {
  id: number;
  day_num: number;
  date?: string | null;
  day_of_week?: string | null;
}

type PoiCardTone = 'warm' | 'cool' | 'ocean' | 'amber';

const REGION_OPTIONS = ['全部地區', '沖繩', '東京', '京都', '首爾', '台南'] as const;
type RegionOption = typeof REGION_OPTIONS[number];

type Tab = 'search' | 'saved' | 'custom';

type AddStopCategory = 'all' | 'attraction' | 'food' | 'hotel' | 'shopping';

const CATEGORY_TABS: ReadonlyArray<{ key: AddStopCategory; label: string }> = [
  { key: 'all', label: '為你推薦' },
  { key: 'attraction', label: '景點' },
  { key: 'food', label: '美食' },
  { key: 'hotel', label: '住宿' },
  { key: 'shopping', label: '購物' },
];

function matchCategory(category: string | null | undefined, target: AddStopCategory): boolean {
  if (target === 'all') return true;
  const cat = (category ?? '').toLowerCase();
  if (target === 'food') return /restaurant|cafe|food|bar|bakery|餐|食/.test(cat);
  if (target === 'hotel') return /hotel|hostel|guest|inn|住宿|飯店/.test(cat);
  if (target === 'shopping') return /shop|mall|market|購物/.test(cat);
  if (target === 'attraction') return /attract|museum|park|temple|景點|公園/.test(cat);
  return false;
}

function normalizeSearchResults(data: unknown): PoiSearchResult[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)
      ? (data as { results: unknown[] }).results
      : [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    const id = Number(item.osm_id ?? item.osmId);
    const name = typeof item.name === 'string' ? item.name : '';
    if (!Number.isFinite(id) || !name.trim()) return [];
    return [{
      osm_id: id,
      name,
      address: typeof item.address === 'string' ? item.address : '',
      lat: Number(item.lat) || 0,
      lng: Number(item.lng) || 0,
      category: typeof item.category === 'string' ? item.category : 'poi',
    }];
  });
}

function normalizeSavedPois(data: unknown): SavedPoiRow[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    const id = Number(item.id);
    const poiId = Number(item.poiId ?? item.poi_id);
    const poiName = item.poiName ?? item.poi_name;
    if (!Number.isFinite(id) || typeof poiName !== 'string' || !poiName.trim()) return [];
    const poiAddress = item.poiAddress ?? item.poi_address;
    const poiType = item.poiType ?? item.poi_type;
    return [{
      id,
      poiId: Number.isFinite(poiId) ? poiId : 0,
      poiName,
      poiAddress: typeof poiAddress === 'string' ? poiAddress : null,
      poiType: typeof poiType === 'string' ? poiType : 'poi',
    }];
  });
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

function deriveDayLabel(day: DayApiRow | null, dayNum: number): string {
  const dayPad = String(dayNum).padStart(2, '0');
  if (!day) return `DAY ${dayPad}`;
  const date = day.date ?? '';
  if (!date) return `DAY ${dayPad}`;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date);
  if (!m) return `DAY ${dayPad} · ${date}`;
  const month = parseInt(m[2]!, 10);
  const dom = parseInt(m[3]!, 10);
  const weekdayChar = day.day_of_week ?? '';
  return `DAY ${dayPad} · ${month}/${dom}${weekdayChar ? `（${weekdayChar}）` : ''}`;
}

const SCOPED_STYLES = `
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
  min-height: 32px;
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
  font: inherit; font-size: 18px; font-weight: 700;
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
.tp-add-stop-card-photo[data-tone="ocean"] {
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

.tp-add-stop-saved-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 14px;
  padding: 0 2px;
}
.tp-add-stop-saved-title {
  font-size: var(--font-size-callout);
  font-weight: 700;
  margin: 0;
}
.tp-add-stop-saved-sort {
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
  color: var(--color-destructive, #c0392b);
  font-size: var(--font-size-caption2);
  margin-top: 2px;
}
@media (max-width: 760px) {
  .tp-add-stop-form-row {
    grid-template-columns: 1fr;
  }
}

/* page-level sticky bottom bar (取代 modal sticky footer) */
.tp-add-stop-page-bottom-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 5;
  display: flex; gap: 12px; align-items: center; justify-content: space-between;
  padding: 12px 16px max(12px, env(safe-area-inset-bottom, 12px));
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-background) 94%, transparent);
  backdrop-filter: blur(var(--blur-glass, 14px));
  -webkit-backdrop-filter: blur(var(--blur-glass, 14px));
}
@media (min-width: 1024px) {
  .tp-add-stop-page-bottom-bar {
    left: 240px;
    padding: 16px 32px max(16px, env(safe-area-inset-bottom, 16px));
  }
}
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const dayNumParam = searchParams.get('day');
  const dayNum = dayNumParam ? parseInt(dayNumParam, 10) : NaN;

  const [tab, setTab] = useState<Tab>('search');
  const [category, setCategory] = useState<AddStopCategory>('all');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PoiSearchResult[]>([]);
  const [region, setRegion] = useState<RegionOption>('全部地區');
  const [regionMenuOpen, setRegionMenuOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedSearch, setSelectedSearch] = useState<Set<number>>(new Set());

  const [savedPois, setSavedPois] = useState<SavedPoiRow[] | null>(null);
  const [savedLoading, setSavedLoading] = useState(false);
  const [selectedSaved, setSelectedSaved] = useState<Set<number>>(new Set());

  const [customTitle, setCustomTitle] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [customDuration, setCustomDuration] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentDay, setCurrentDay] = useState<DayApiRow | null>(null);

  // Fetch day metadata for label rendering (replaces TripPage caller's inline derivation).
  useEffect(() => {
    if (!auth.user || !tripId || !Number.isFinite(dayNum)) return;
    let cancelled = false;
    (async () => {
      try {
        const days = await apiFetch<DayApiRow[]>(`/trips/${encodeURIComponent(tripId)}/days`);
        if (cancelled) return;
        const found = (days ?? []).find((d) => d.day_num === dayNum) ?? null;
        setCurrentDay(found);
      } catch {
        // silent — label fallback to DAY NN
      }
    })();
    return () => { cancelled = true; };
  }, [auth.user, tripId, dayNum]);

  // Search debounce
  useEffect(() => {
    if (tab !== 'search') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    const fallbackQuery = region !== '全部地區' ? region : '';
    const searchTerm = trimmed.length >= 2 ? trimmed : fallbackQuery;
    if (searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const resp = await fetch(`/api/poi-search?q=${encodeURIComponent(searchTerm)}&limit=20`);
        if (resp.ok) {
          setSearchResults(normalizeSearchResults(await resp.json()));
        }
      } catch {
        // silent
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [tab, query, region]);

  // Saved fetch (lazy 切到 tab 才打)
  useEffect(() => {
    if (tab !== 'saved' || savedPois !== null) return;
    setSavedLoading(true);
    (async () => {
      try {
        const resp = await fetch('/api/saved-pois', { credentials: 'same-origin' });
        if (resp.ok) {
          setSavedPois(normalizeSavedPois(await resp.json()));
        } else {
          setSavedPois([]);
        }
      } catch {
        setSavedPois([]);
      } finally {
        setSavedLoading(false);
      }
    })();
  }, [tab, savedPois]);

  function toggleSearch(id: number) {
    setSelectedSearch((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    if (tab === 'saved') return selectedSaved.size;
    return customTitle.trim() ? 1 : 0;
  }, [tab, selectedSearch, selectedSaved, customTitle]);

  const confirmEnabled = tab === 'custom' ? !submitting : totalSelected > 0 && !submitting;

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else if (tripId) {
      navigate(`/trips?selected=${encodeURIComponent(tripId)}`);
    } else {
      navigate('/trips');
    }
  }

  const handleConfirm = useCallback(async () => {
    if (submitting || !tripId || !Number.isFinite(dayNum)) return;
    setSubmitError(null);

    type Body = { title: string; time?: string; note?: string };

    let payloads: Body[] = [];

    if (tab === 'search') {
      payloads = searchResults
        .filter((r) => selectedSearch.has(r.osm_id))
        .map((r) => ({ title: r.name, note: r.address || undefined }));
    } else if (tab === 'saved') {
      const list = savedPois ?? [];
      payloads = list
        .filter((r) => selectedSaved.has(r.id))
        .map((r) => ({ title: r.poiName, note: r.poiAddress ?? undefined }));
    } else {
      const title = customTitle.trim();
      if (!title) {
        setCustomError('請輸入標題');
        return;
      }
      const note = [customDuration && `${customDuration} 分`, customNote].filter(Boolean).join(' · ') || undefined;
      payloads = [{ title, time: customTime || undefined, note }];
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
      window.dispatchEvent(new CustomEvent('tp-entry-updated', { detail: { tripId, dayNum } }));
      showToast(`已加入 ${payloads.length} 個景點`, 'success');
      handleBack();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting, tab, searchResults, selectedSearch, savedPois, selectedSaved, customTitle, customTime, customDuration, customNote, tripId, dayNum]);

  if (!auth.user) return null;
  if (!tripId || !Number.isFinite(dayNum)) {
    return (
      <AppShell
        sidebar={<DesktopSidebarConnected />}
        main={
          <div className="tp-add-stop-page-shell" data-testid="add-stop-page">
            <TitleBar title="加入景點" back={() => navigate('/trips')} backLabel="返回行程列表" />
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)' }}>
              無效的行程或日期參數
            </div>
          </div>
        }
        bottomNav={<GlobalBottomNav authed={!!user} />}
      />
    );
  }

  const dayLabel = deriveDayLabel(currentDay, dayNum);

  // TitleBar primary action (responsive icon + text / icon-only)
  const titleBarActions = (
    <button
      type="button"
      className="tp-titlebar-action is-primary"
      onClick={() => void handleConfirm()}
      disabled={!confirmEnabled}
      aria-label={submitting ? '加入中' : '完成'}
      data-testid="add-stop-titlebar-confirm"
    >
      <Icon name="check" />
      <span className="tp-titlebar-action-label">{submitting ? '加入中⋯' : '完成'}</span>
    </button>
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

            <div className="tp-add-stop-tabs" role="tablist" aria-label="加入景點來源">
              {([
                { key: 'search', label: '搜尋' },
                { key: 'saved', label: '收藏' },
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
              {(tab === 'search' || tab === 'saved') && (
                <div className="tp-add-stop-subtabs" role="tablist" aria-label="POI 類別">
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
                  {!searching && query.trim().length === 0 && category === 'all' && savedPois && savedPois.length > 0 && (
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
                        <h3 className="tp-add-stop-result-title">熱門景點 · {region}</h3>
                        <div className="tp-add-stop-grid">
                          {filtered.map((r, index) => {
                            const isSelected = selectedSearch.has(r.osm_id);
                            return (
                              <label
                                key={r.osm_id}
                                className={`tp-add-stop-card ${isSelected ? 'is-selected' : ''}`}
                                data-testid={`add-stop-search-card-${r.osm_id}`}
                              >
                                <input
                                  type="checkbox"
                                  className="tp-add-stop-card-checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSearch(r.osm_id)}
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
                                    <Icon name="star" />
                                    {poiMeta(r.address, r.category)}
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

              {tab === 'saved' && (
                <>
                  {savedLoading && <div className="tp-add-stop-empty">載入收藏⋯</div>}
                  {!savedLoading && savedPois !== null && savedPois.length === 0 && (
                    <div className="tp-add-stop-empty">
                      <div className="tp-add-stop-empty-icon"><Icon name="heart" /></div>
                      <div className="tp-add-stop-empty-title">還沒收藏景點</div>
                      <div className="tp-add-stop-empty-desc">在探索頁或地圖上點收藏地點，下次行程就能直接從這裡加入。</div>
                    </div>
                  )}
                  {savedPois !== null && savedPois.length > 0 && (() => {
                    const filtered = savedPois.filter((r) => matchCategory(r.poiType, category));
                    if (filtered.length === 0) {
                      return <div className="tp-add-stop-empty">符合類別篩選的收藏為 0，試著切到「為你推薦」看全部</div>;
                    }
                    return (
                      <>
                        <div className="tp-add-stop-saved-header">
                          <h3 className="tp-add-stop-saved-title">我的收藏 · {savedPois.length} 個景點</h3>
                          <button className="tp-add-stop-saved-sort" type="button">
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
                                data-testid={`add-stop-saved-card-${r.id}`}
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
                                    <Icon name="star" />
                                    {poiMeta(r.poiAddress, r.poiType)}
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

              {tab === 'custom' && (
                <form className="tp-add-stop-form" onSubmit={(e) => { e.preventDefault(); void handleConfirm(); }}>
                  <div className="tp-add-stop-form-row is-full">
                    <div className="tp-add-stop-form-field">
                      <label htmlFor="add-stop-custom-title">標題 *</label>
                      <input
                        id="add-stop-custom-title"
                        type="text"
                        value={customTitle}
                        onChange={(e) => { setCustomTitle(e.target.value); setCustomError(null); }}
                        placeholder="輸入景點名稱（例：心型岩看夕陽）"
                        autoFocus
                        data-testid="add-stop-custom-title"
                      />
                      {customError && (
                        <div className="tp-add-stop-form-row-error" data-testid="add-stop-custom-error">{customError}</div>
                      )}
                    </div>
                  </div>
                  <div className="tp-add-stop-form-row is-full">
                    <div className="tp-add-stop-form-field">
                      <label>地址 / 地標</label>
                      <div className="tp-add-stop-form-placeholder"><span>街道地址或地標關鍵字</span><Icon name="location-pin" /></div>
                      <div className="tp-add-stop-form-helper">輸入後系統自動定位座標（用於地圖 polyline 連結）</div>
                    </div>
                  </div>
                  <div className="tp-add-stop-form-row">
                    <div className="tp-add-stop-form-field">
                      <label htmlFor="add-stop-custom-time">開始時間</label>
                      <input
                        id="add-stop-custom-time"
                        type="text"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                        placeholder={`Day ${String(dayNum).padStart(2, '0')} · 17:00`}
                        data-testid="add-stop-custom-time"
                      />
                    </div>
                    <div className="tp-add-stop-form-field">
                      <label>結束時間</label>
                      <div className="tp-add-stop-form-select"><span>自動估算</span><Icon name="chevron-down" /></div>
                    </div>
                  </div>
                  <div className="tp-add-stop-form-row">
                    <div className="tp-add-stop-form-field">
                      <label>類型</label>
                      <div className="tp-add-stop-form-select"><span>SIGHT · 景點</span><Icon name="chevron-down" /></div>
                    </div>
                    <div className="tp-add-stop-form-field">
                      <label htmlFor="add-stop-custom-duration">預估停留</label>
                      <input
                        id="add-stop-custom-duration"
                        type="number"
                        inputMode="numeric"
                        value={customDuration}
                        onChange={(e) => setCustomDuration(e.target.value)}
                        placeholder="90"
                        data-testid="add-stop-custom-duration"
                      />
                    </div>
                  </div>
                  <div className="tp-add-stop-form-row is-full">
                    <div className="tp-add-stop-form-field">
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
                </form>
              )}
            </div>

            <div className="tp-add-stop-page-bottom-bar">
              <span className="tp-add-stop-counter" data-testid="add-stop-counter">
                已選 <strong>{totalSelected}</strong> 個 · 將加入 {dayLabel}
                {submitError && <span style={{ color: 'var(--color-destructive, #c0392b)', marginLeft: 8 }}>{submitError}</span>}
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
        bottomNav={<GlobalBottomNav authed={!!user} />}
      />
    </>
  );
}
