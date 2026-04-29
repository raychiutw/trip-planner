/**
 * AddStopModal — Section 3 (terracotta-add-stop-modal)
 *
 * 3-tab modal pattern：搜尋 / 收藏 / 自訂。對應 mockup section 14
 * (line 6428-6714)。取代既有 DaySection inline `<InlineAddPoi>` 入口。
 *
 * 觸發方式：trip-level button (TripPage TitleBar「+ 加入景點」)，帶當前
 * activeDayNum 進來；user 選 / 填完後 batch POST 到該 day。
 *
 * 範圍說明（PR 內 ship）：
 *   - 搜尋 tab：reuse `/api/poi-search` 預設地區推薦 + 即時搜尋 + 多選 grid
 *   - 收藏 tab：fetch `/api/saved-pois` + 同樣多選 grid
 *   - 自訂 tab：簡易 form (title required + time + duration + note)
 *   - Footer：counter + 完成 (batch POST) + 取消
 *
 * Deferred to follow-up：
 *   - region selector taxonomy（目前使用 mockup 對齊的固定地區清單）
 *   - 推薦 chips by tag
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../shared/Icon';
import { apiFetchRaw } from '../../lib/apiClient';

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

type PoiCardTone = 'warm' | 'cool' | 'ocean' | 'amber';

export interface AddStopModalProps {
  open: boolean;
  tripId: string;
  dayNum: number;
  /** Optional 「DAY {NN} · {M}/{D}（{星期}）」 摘要顯示在 header + footer。 */
  dayLabel?: string;
  /** mockup-parity-qa-fixes: trip-context derived region 預設值，供 region pill 顯示。 */
  defaultRegion?: string;
  onClose: () => void;
  /** 完成 commit 後通知 parent，parent 可 refetch day 顯示新 entry。 */
  onAdded?: () => void;
}

/* mockup-parity-qa-fixes: region 選項 hardcode list（design.md decision 3）。
 * 後續 user 旅行跨更多 region 可改為 trip.countries 動態 mapping。 */
const REGION_OPTIONS = ['全部地區', '沖繩', '東京', '京都', '首爾', '台南'] as const;
type RegionOption = typeof REGION_OPTIONS[number];

type Tab = 'search' | 'saved' | 'custom';

const SCOPED_STYLES = `
.tp-add-stop-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: var(--z-modal, 60);
  display: grid; place-items: center;
  padding: 16px;
}
.tp-add-stop-modal {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  width: min(720px, 100%);
  max-height: 90vh;
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}
.tp-add-stop-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}
.tp-add-stop-title {
  /* mockup-parity-qa-fixes: title 700（mockup 規範） */
  font-size: var(--font-size-title3);
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.01em;
}
/* mockup section 14: region label + search row + visual POI cards */
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
/* mockup-parity-qa-fixes: filter button (mockup section 14:6460) */
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
.tp-add-stop-day-meta {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  margin-top: 2px;
}
.tp-add-stop-close {
  width: 36px; height: 36px;
  border: 0; background: transparent;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-muted);
  display: grid; place-items: center;
}
.tp-add-stop-close:hover { background: var(--color-hover); color: var(--color-foreground); }
.tp-add-stop-close .svg-icon { width: 18px; height: 18px; }

.tp-add-stop-tabs {
  display: flex; padding: 0 20px;
  border-bottom: 1px solid var(--color-border);
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
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 16px 20px;
}

/* Section 3.4：5 subtab chips — 共用 search + saved tab，居於 tab body 上方 */
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

.tp-add-stop-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px;
  border-top: 1px solid var(--color-border);
  background: var(--color-secondary);
  gap: 12px;
}
.tp-add-stop-counter {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
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

// Section 3.4-3.5：5 個 category subtab（為你推薦 / 景點 / 美食 / 住宿 / 購物）
// 純 client-side filter — 對 search results 與 saved POIs 同邏輯，避免引入新
// backend trending endpoint 增加 dependency。「為你推薦」 default tab 取 saved
// POI top 12 + search results 全顯示（兩個 grid 並列）。
type AddStopCategory = 'all' | 'attraction' | 'food' | 'hotel' | 'shopping';

const CATEGORY_TABS: ReadonlyArray<{ key: AddStopCategory; label: string }> = [
  { key: 'all', label: '為你推薦' },
  { key: 'attraction', label: '景點' },
  { key: 'food', label: '美食' },
  { key: 'hotel', label: '住宿' },
  { key: 'shopping', label: '購物' },
];

/** 將 POI category text 對應到 5 subtab；無資料 fallback 'all'。 */
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

export default function AddStopModal({ open, tripId, dayNum, dayLabel, defaultRegion, onClose, onAdded }: AddStopModalProps) {
  const [tab, setTab] = useState<Tab>('search');
  const [category, setCategory] = useState<AddStopCategory>('all');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PoiSearchResult[]>([]);
  // mockup-parity-qa-fixes: region selector + filter button state
  const initialRegion = REGION_OPTIONS.includes(defaultRegion as RegionOption)
    ? (defaultRegion as RegionOption)
    : '全部地區';
  const [region, setRegion] = useState<RegionOption>(initialRegion);
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

  useEffect(() => {
    if (open) setRegion(initialRegion);
  }, [open, initialRegion]);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setTab('search');
      setCategory('all');
      setQuery('');
      setSearchResults([]);
      setSelectedSearch(new Set());
      setSelectedSaved(new Set());
      setCustomTitle('');
      setCustomTime('');
      setCustomDuration('');
      setCustomNote('');
      setCustomError(null);
      setSubmitError(null);
    }
  }, [open]);

  // Esc 關閉
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 搜尋 debounced；query 空白時用目前地區載入 mockup 的「熱門景點」初始 grid。
  useEffect(() => {
    if (!open || tab !== 'search') return;
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
        // silent — empty grid still readable
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, tab, query, region]);

  // 收藏 fetch (lazy 切到 tab 才打)
  useEffect(() => {
    if (!open || tab !== 'saved' || savedPois !== null) return;
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
  }, [open, tab, savedPois]);

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

  // 自訂 tab 即使 title 是空，也讓 confirm 可點，這樣使用者點下去才能觸發
  // inline title required 驗證；其他 tab 則用 totalSelected 守 enabled。
  const confirmEnabled = tab === 'custom' ? !submitting : totalSelected > 0 && !submitting;

  const handleConfirm = useCallback(async () => {
    if (submitting) return;
    setSubmitError(null);

    type Body = {
      title: string;
      time?: string;
      note?: string;
    };

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
          apiFetchRaw(`/trips/${tripId}/days/${dayNum}/entries`, {
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
      onAdded?.();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, tab, searchResults, selectedSearch, savedPois, selectedSaved, customTitle, customTime, customDuration, customNote, tripId, dayNum, onAdded, onClose]);

  if (!open) return null;

  const modal = (
    <div
      className="tp-add-stop-backdrop"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="add-stop-modal-backdrop"
    >
      <style>{SCOPED_STYLES}</style>
      <div
        className="tp-add-stop-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-stop-modal-title"
        data-testid="add-stop-modal"
      >
        <div className="tp-add-stop-header">
          <div>
            <h2 id="add-stop-modal-title" className="tp-add-stop-title">加入景點</h2>
            <div className="tp-add-stop-day-meta">{dayLabel ?? `Day ${dayNum}`}</div>
          </div>
          <button
            type="button"
            className="tp-add-stop-close"
            onClick={onClose}
            aria-label="關閉"
            data-testid="add-stop-modal-close"
          >
            <Icon name="x-mark" />
          </button>
        </div>

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
              {/* mockup section 14:6452-6454 — region selector chip 在 search body 上方 */}
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
                    placeholder="搜尋景點、餐廳、住宿…"
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
                <div
                  className="tp-add-stop-filter-sheet"
                  data-testid="add-stop-filter-sheet"
                  role="region"
                  aria-label="篩選"
                >
                  <p style={{ margin: 0, color: 'var(--color-muted)' }}>
                    篩選功能（評分、價位、open-now）開發中。目前可用上方類別 subtab 切換 POI 類別。
                  </p>
                </div>
              )}
              {searching && <div className="tp-add-stop-empty">搜尋中…</div>}
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
              {savedLoading && <div className="tp-add-stop-empty">載入收藏…</div>}
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

        <div className="tp-add-stop-footer">
          <span className="tp-add-stop-counter" data-testid="add-stop-counter">
            {/* mockup section 14:6518 規範「已選 N 個 · 將加入 DAY {NN} · M/D」即使 0 也顯示 */}
            已選 <strong>{totalSelected}</strong> 個 · 將加入 {dayLabel ?? `DAY ${String(dayNum).padStart(2, '0')}`}
            {submitError && <span style={{ color: 'var(--color-destructive, #c0392b)', marginLeft: 8 }}>{submitError}</span>}
          </span>
          <div className="tp-add-stop-actions">
            <button
              type="button"
              className="tp-add-stop-btn tp-add-stop-btn-cancel"
              onClick={onClose}
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
              {submitting ? '加入中…' : '完成'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Portal so backdrop sits above any sticky header
  return typeof document === 'undefined' ? null : createPortal(modal, document.body);
}
