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
 *   - 搜尋 tab：reuse `/api/poi-search` 即時搜尋 + 多選 grid + checkbox
 *   - 收藏 tab：fetch `/api/saved-pois` + 同樣多選 grid
 *   - 自訂 tab：簡易 form (title required + time + duration + note)
 *   - Footer：counter + 完成 (batch POST) + 取消
 *
 * Deferred to follow-up：
 *   - 「為你推薦」trending（需 backend trending endpoint）
 *   - region selector + filter chip（需 region taxonomy）
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
/* mockup-parity-qa-fixes: region selector pill (mockup section 14:6452) */
.tp-add-stop-region-row { position: relative; margin-bottom: 12px; }
.tp-add-stop-region-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-background);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-foreground); cursor: pointer;
  min-height: 32px;
}
.tp-add-stop-region-pill:hover { border-color: var(--color-accent); color: var(--color-accent-deep); }
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
.tp-add-stop-filter-btn {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-background);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-foreground); cursor: pointer;
  min-height: 32px;
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
  margin-bottom: 12px;
}
.tp-add-stop-subtab {
  border: 1px solid transparent;
  background: var(--color-secondary);
  padding: 6px 12px;
  border-radius: var(--radius-full);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-muted); cursor: pointer;
  min-height: 32px;
}
.tp-add-stop-subtab:hover { color: var(--color-foreground); }
.tp-add-stop-subtab.is-active {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  border-color: var(--color-accent-bg);
}

.tp-add-stop-search-input-wrap {
  position: relative; margin-bottom: 12px;
}
.tp-add-stop-search-input-wrap .svg-icon {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  color: var(--color-muted);
  width: 16px; height: 16px;
  pointer-events: none;
}
.tp-add-stop-search-input {
  width: 100%; min-height: 44px;
  /* mockup-parity-qa-fixes: 加 right padding 100px 給 .tp-add-stop-filter-btn 留空間 */
  padding: 8px 100px 8px 36px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-background);
  font: inherit; font-size: var(--font-size-callout);
  color: var(--color-foreground);
}
.tp-add-stop-search-input:focus {
  outline: none; border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-subtle);
}

.tp-add-stop-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}
.tp-add-stop-card {
  display: flex; gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  cursor: pointer;
  transition: border-color 120ms, background 120ms;
  text-align: left;
  font: inherit;
  color: var(--color-foreground);
}
.tp-add-stop-card:hover { border-color: var(--color-accent); background: var(--color-hover); }
.tp-add-stop-card.is-selected {
  border-color: var(--color-accent);
  background: var(--color-accent-subtle);
}
.tp-add-stop-card-checkbox {
  flex-shrink: 0;
  width: 22px; height: 22px;
  margin: 0;
  accent-color: var(--color-accent);
}
.tp-add-stop-card-body { min-width: 0; flex: 1; }
.tp-add-stop-card-name {
  font-weight: 700; font-size: var(--font-size-footnote);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tp-add-stop-card-meta {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}

.tp-add-stop-empty {
  padding: 32px 16px; text-align: center;
  color: var(--color-muted);
  font-size: var(--font-size-callout);
}

.tp-add-stop-form { display: flex; flex-direction: column; gap: 12px; }
.tp-add-stop-form-row { display: flex; flex-direction: column; gap: 6px; }
.tp-add-stop-form-row label {
  font-size: var(--font-size-caption); font-weight: 700;
  color: var(--color-foreground);
}
.tp-add-stop-form-row input,
.tp-add-stop-form-row textarea,
.tp-add-stop-form-row select {
  padding: 10px 12px; min-height: 44px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  font: inherit; font-size: var(--font-size-callout);
  color: var(--color-foreground);
}
.tp-add-stop-form-row textarea { min-height: 80px; resize: vertical; }
.tp-add-stop-form-row input:focus,
.tp-add-stop-form-row textarea:focus,
.tp-add-stop-form-row select:focus {
  outline: none; border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-subtle);
}
.tp-add-stop-form-row-error {
  color: var(--color-destructive, #c0392b);
  font-size: var(--font-size-caption2);
  margin-top: 2px;
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

  // 搜尋 debounced
  useEffect(() => {
    if (!open || tab !== 'search') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const resp = await fetch(`/api/poi-search?q=${encodeURIComponent(trimmed)}&limit=20`);
        if (resp.ok) {
          const data = (await resp.json()) as PoiSearchResult[];
          setSearchResults(Array.isArray(data) ? data : []);
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
  }, [open, tab, query]);

  // 收藏 fetch (lazy 切到 tab 才打)
  useEffect(() => {
    if (!open || tab !== 'saved' || savedPois !== null) return;
    setSavedLoading(true);
    (async () => {
      try {
        const resp = await fetch('/api/saved-pois', { credentials: 'same-origin' });
        if (resp.ok) {
          const data = (await resp.json()) as SavedPoiRow[];
          setSavedPois(Array.isArray(data) ? data : []);
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
              <div className="tp-add-stop-search-input-wrap">
                <Icon name="search" />
                <input
                  type="text"
                  className="tp-add-stop-search-input"
                  placeholder="搜尋景點、餐廳、地址…（最少 2 字）"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  data-testid="add-stop-search-input"
                />
                {/* mockup section 14:6460 — filter button trailing search input */}
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
                  <div className="tp-add-stop-grid">
                    {filtered.map((r) => {
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
                          <div className="tp-add-stop-card-body">
                            <div className="tp-add-stop-card-name">{r.name}</div>
                            <div className="tp-add-stop-card-meta">{r.address}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}

          {tab === 'saved' && (
            <>
              {savedLoading && <div className="tp-add-stop-empty">載入收藏…</div>}
              {!savedLoading && savedPois !== null && savedPois.length === 0 && (
                <div className="tp-add-stop-empty">還沒有收藏任何 POI。先去「探索」儲存幾個。</div>
              )}
              {savedPois !== null && savedPois.length > 0 && (() => {
                const filtered = savedPois.filter((r) => matchCategory(r.poiType, category));
                if (filtered.length === 0) {
                  return <div className="tp-add-stop-empty">符合類別篩選的收藏為 0，試著切到「為你推薦」看全部</div>;
                }
                return (
                  <div className="tp-add-stop-grid">
                    {filtered.map((r) => {
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
                          <div className="tp-add-stop-card-body">
                            <div className="tp-add-stop-card-name">{r.poiName}</div>
                            <div className="tp-add-stop-card-meta">{r.poiAddress ?? r.poiType}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}

          {tab === 'custom' && (
            <form className="tp-add-stop-form" onSubmit={(e) => { e.preventDefault(); void handleConfirm(); }}>
              <div className="tp-add-stop-form-row">
                <label htmlFor="add-stop-custom-title">標題 *</label>
                <input
                  id="add-stop-custom-title"
                  type="text"
                  value={customTitle}
                  onChange={(e) => { setCustomTitle(e.target.value); setCustomError(null); }}
                  placeholder="例：海邊散步、那霸機場 check-in"
                  autoFocus
                  data-testid="add-stop-custom-title"
                />
                {customError && (
                  <div className="tp-add-stop-form-row-error" data-testid="add-stop-custom-error">{customError}</div>
                )}
              </div>
              <div className="tp-add-stop-form-row">
                <label htmlFor="add-stop-custom-time">時間（選填）</label>
                <input
                  id="add-stop-custom-time"
                  type="text"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  placeholder="例：14:00 或 10:00–12:30"
                  data-testid="add-stop-custom-time"
                />
              </div>
              <div className="tp-add-stop-form-row">
                <label htmlFor="add-stop-custom-duration">停留時間（分鐘，選填）</label>
                <input
                  id="add-stop-custom-duration"
                  type="number"
                  inputMode="numeric"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  placeholder="例：90"
                  data-testid="add-stop-custom-duration"
                />
              </div>
              <div className="tp-add-stop-form-row">
                <label htmlFor="add-stop-custom-note">備註（選填）</label>
                <textarea
                  id="add-stop-custom-note"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="任何補充細節，例：要先預約、攜帶現金等"
                  data-testid="add-stop-custom-note"
                />
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
