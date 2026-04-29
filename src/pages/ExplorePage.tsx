/**
 * ExplorePage — V2 探索 POI（mockup-explore-v2.html parity）.
 *
 * Two tabs:
 *   1. 搜尋  — Nominatim search with single-click 儲存 per result.
 *   2. 我的收藏 — multi-select + 「加入行程」toolbar to push selection into a trip.
 *
 * Auth: useRequireAuth — page is for logged-in users.
 *
 * Add-to-trip flow (MVP): pick trip from a small modal, navigate to
 * /trips?selected=<tripId> with a toast hint. Server-side bulk-add endpoint
 * is the natural next step; the UI is shaped so wiring it later is a 1-line
 * change inside `addSelectedToTrip`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { mapNominatimCategory } from '../lib/poiCategory';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useActiveTrip } from '../contexts/ActiveTripContext';
import Icon from '../components/shared/Icon';
import ToastContainer, { showToast } from '../components/shared/Toast';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';

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
  savedAt: string;
  note: string | null;
}

interface TripPickerRow {
  tripId: string;
  name?: string;
  title?: string | null;
  countries?: string | null;
}

const SCOPED_STYLES = `
.explore-shell {
  background: var(--color-secondary);
  height: 100%;
  overflow-y: auto;
}
.explore-wrap {
  padding: 24px 24px 64px;
  max-width: 960px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 20px;
  color: var(--color-foreground);
}
@media (max-width: 760px) { .explore-wrap { padding: 16px 16px 32px; gap: 16px; } }

/* explore-header 改用統一 <PageHeader>。.explore-header CSS 已退役。 */

/* Section 4.9 (terracotta-mockup-parity-v2)：對齊 mockup section 18 拿掉
 * 「搜尋 / 我的收藏」 tab pair。改用 TitleBar action button 切兩 view，
 * 既有 .explore-tabs / .explore-tab CSS 已退役一併刪除避免 dead rules。 */

.explore-search {
  display: flex; align-items: center; gap: 8px;
  background: var(--color-background);
  border: 1px solid var(--color-border); border-radius: var(--radius-full);
  padding: 8px 16px; min-height: 48px;
}
.explore-search:focus-within { border-color: var(--color-accent); }
.explore-search .search-icon { width: 18px; height: 18px; color: var(--color-muted); flex-shrink: 0; }
.explore-search input {
  flex: 1; border: none; background: transparent;
  font: inherit; font-size: 15px; color: var(--color-foreground);
  outline: none;
}
.explore-search input::placeholder { color: var(--color-muted); }
.explore-search button {
  padding: 8px 16px; border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-accent-foreground);
  border: none; cursor: pointer;
  font: inherit; font-size: 14px; font-weight: 600;
  min-height: 36px;
}
.explore-search button:disabled { opacity: 0.5; cursor: not-allowed; }
.explore-search button:hover:not(:disabled) { filter: brightness(var(--hover-brightness)); }

/* Selection toolbar — appears when ≥1 saved item is checked.
 * PR-X 2026-04-26：margin-bottom 16 給跟下方 POI grid 留間隔（user 指示）。 */
.explore-toolbar {
  position: sticky; top: 0; z-index: 5;
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  margin-bottom: 16px;
  background: var(--color-accent-subtle);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-md);
  font-size: var(--font-size-callout); color: var(--color-accent);
}
.explore-toolbar-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.explore-toolbar-btn {
  padding: 8px 14px; border-radius: var(--radius-full);
  border: 1px solid var(--color-accent);
  background: var(--color-accent); color: var(--color-accent-foreground);
  font: inherit; font-weight: 600; font-size: var(--font-size-footnote);
  cursor: pointer; min-height: 36px;
}
.explore-toolbar-btn-ghost {
  background: transparent; color: var(--color-accent);
}
.explore-toolbar-btn-destructive {
  background: transparent; color: var(--color-destructive);
  border-color: var(--color-destructive);
}
.explore-toolbar-btn-destructive:hover:not(:disabled) {
  background: var(--color-destructive-bg);
  filter: none;
}
.explore-toolbar-btn:hover:not(:disabled) { filter: brightness(var(--hover-brightness)); }
.explore-toolbar-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.explore-section h2 {
  font-size: var(--font-size-title3); font-weight: 700;
  letter-spacing: -0.01em; margin-bottom: 8px;
}
.explore-section .section-meta {
  font-size: var(--font-size-footnote); color: var(--color-muted); margin-bottom: 12px;
}

/* Section 4.9 (terracotta-mockup-parity-v2)：對齊 mockup section 18 grid
 * 規格 (mockup line 7290 desktop / 7366 compact)：
 * desktop ≥1024px = 3-col；compact ≤1024px = 2-col。 */
.explore-poi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
@media (min-width: 1024px) {
  .explore-poi-grid { grid-template-columns: repeat(3, 1fr); }
}
.explore-poi-card {
  position: relative;
  background: var(--color-background); border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex; flex-direction: column;
  overflow: hidden;
  transition: border-color 120ms, box-shadow 120ms, transform 120ms;
}
.explore-poi-card:hover {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
.explore-poi-card.is-selected { border-color: var(--color-accent); box-shadow: 0 0 0 1px var(--color-accent); }
/* Section 4.9：cover photo placeholder — 16:9 + 8-tone gradient by data-tone */
.explore-poi-cover {
  position: relative;
  aspect-ratio: 16/9;
  width: 100%;
  background: var(--color-tertiary);
}
.explore-poi-cover[data-tone="1"] { background: linear-gradient(135deg, #f5cba7 0%, #d68160 100%); }
.explore-poi-cover[data-tone="2"] { background: linear-gradient(135deg, #a3d9b1 0%, #5b9b6e 100%); }
.explore-poi-cover[data-tone="3"] { background: linear-gradient(135deg, #b3c7e6 0%, #6b88b8 100%); }
.explore-poi-cover[data-tone="4"] { background: linear-gradient(135deg, #f5d088 0%, #c98b2c 100%); }
.explore-poi-cover[data-tone="5"] { background: linear-gradient(135deg, #e3a3c4 0%, #b06a8e 100%); }
.explore-poi-cover[data-tone="6"] { background: linear-gradient(135deg, #c8b5e3 0%, #8a73b8 100%); }
.explore-poi-cover[data-tone="7"] { background: linear-gradient(135deg, #f0a59a 0%, #c95745 100%); }
.explore-poi-cover[data-tone="8"] { background: linear-gradient(135deg, #b8e3d5 0%, #67a896 100%); }
.explore-poi-card .explore-poi-heart {
  position: absolute;
  top: 8px; right: 8px;
  width: 36px; height: 36px;
  border: 0; border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  display: grid; place-items: center;
  cursor: pointer;
  transition: background 120ms, color 120ms, transform 120ms;
  backdrop-filter: blur(8px);
}
.explore-poi-card .explore-poi-heart:hover { background: rgba(0, 0, 0, 0.65); transform: scale(1.05); }
.explore-poi-card .explore-poi-heart.is-saved {
  background: var(--color-accent); color: var(--color-accent-foreground);
}
.explore-poi-card .explore-poi-heart .svg-icon { width: 18px; height: 18px; }
.explore-poi-body {
  padding: 14px 16px;
  display: flex; flex-direction: column; gap: 6px;
}
.explore-poi-card .explore-poi-rating {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  margin-top: 4px;
}
.explore-poi-card .explore-poi-rating-star { color: var(--color-priority-medium-dot, #f5a62c); }
.explore-poi-card .poi-category {
  font-size: var(--font-size-eyebrow); font-weight: 700; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--color-muted);
}

/* Section 4.9：region selector pill + subtabs (5 個 category chip) */
.explore-region-bar {
  display: flex; align-items: center; gap: 12px;
  margin: 12px 0;
  flex-wrap: wrap;
}
.explore-region-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-background);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-foreground); cursor: pointer;
  min-height: 32px;
}
.explore-region-pill:hover { border-color: var(--color-accent); color: var(--color-accent); }
.explore-subtabs {
  display: inline-flex; align-items: center; gap: 6px;
  flex-wrap: wrap;
}
.explore-subtab {
  border: 1px solid transparent; background: var(--color-secondary);
  padding: 6px 12px; border-radius: var(--radius-full);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-muted); cursor: pointer;
  min-height: 32px;
}
.explore-subtab:hover { color: var(--color-foreground); }
.explore-subtab.is-active {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  border-color: var(--color-accent-bg);
}
.explore-poi-card .poi-name {
  font-size: var(--font-size-headline); font-weight: 700;
  letter-spacing: -0.005em; color: var(--color-foreground);
}
.explore-poi-card .poi-address {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.explore-poi-card .poi-actions { display: flex; gap: 8px; margin-top: 6px; align-items: center; }
.explore-poi-card .poi-actions button {
  padding: 6px 12px; border-radius: var(--radius-full);
  border: 1px solid var(--color-border); background: var(--color-background);
  font: inherit; font-size: 12px; font-weight: 600;
  color: var(--color-foreground); cursor: pointer; min-height: 32px;
}
.explore-poi-card .poi-actions button:hover { border-color: var(--color-accent); color: var(--color-accent); }
.explore-poi-card .poi-actions button.saved { background: var(--color-accent); color: var(--color-accent-foreground); border-color: var(--color-accent); }
.explore-poi-card .poi-actions button:disabled { opacity: 0.6; cursor: not-allowed; }

.explore-poi-checkbox {
  width: 22px; height: 22px;
  margin: 0; cursor: pointer;
  accent-color: var(--color-accent);
}

.explore-empty {
  padding: 24px; text-align: center; color: var(--color-muted);
  background: var(--color-background); border: 1px dashed var(--color-border);
  border-radius: var(--radius-md); font-size: var(--font-size-callout);
}

/* F6 design-review: landing empty state — 暖色 onboarding card + chip suggestions */
.explore-landing-empty {
  padding: 48px 24px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  margin-top: 8px;
}
.explore-landing-empty .landing-eyebrow {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--color-muted);
}
.explore-landing-empty .landing-title {
  margin: 0; font-size: var(--font-size-title3); font-weight: 800;
  color: var(--color-foreground);
}
.explore-landing-empty .landing-copy {
  margin: 0 0 8px; font-size: var(--font-size-callout); color: var(--color-muted);
  max-width: 320px;
}
.explore-landing-empty .landing-chips {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;
}
.explore-landing-empty .landing-chip {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 10px 16px; border-radius: var(--radius-full);
  background: var(--color-accent-subtle); color: var(--color-accent-deep);
  border: 1px solid var(--color-accent-bg);
  cursor: pointer;
  min-height: var(--spacing-tap-min);
  transition: background-color 120ms, color 120ms;
}
.explore-landing-empty .landing-chip:hover {
  background: var(--color-accent); color: var(--color-accent-foreground);
  border-color: var(--color-accent);
}

/* Trip picker modal */
.tp-trip-picker-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: var(--z-modal, 60);
  display: grid; place-items: center;
  padding: 16px;
}
.tp-trip-picker {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 24px;
  width: 100%; max-width: 420px;
  max-height: min(80vh, 560px);
  display: flex; flex-direction: column; gap: 12px;
}
.tp-trip-picker h2 { font-size: var(--font-size-title3); font-weight: 800; margin: 0; }
.tp-trip-picker p { color: var(--color-muted); font-size: var(--font-size-footnote); margin: 0; }
.tp-trip-picker-list {
  flex: 1; min-height: 0;
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 6px;
  margin-top: 4px;
}
.tp-trip-picker-row {
  text-align: left;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font: inherit; cursor: pointer;
  display: flex; flex-direction: column; gap: 2px;
}
.tp-trip-picker-row:hover { border-color: var(--color-accent); background: var(--color-hover); }
.tp-trip-picker-row .row-title { font-weight: 700; font-size: var(--font-size-callout); }
.tp-trip-picker-row .row-meta { color: var(--color-muted); font-size: var(--font-size-footnote); }
.tp-trip-picker-empty {
  padding: 16px; text-align: center; color: var(--color-muted);
  font-size: var(--font-size-footnote);
}
.tp-trip-picker-actions {
  display: flex; justify-content: flex-end; gap: 8px;
}
.tp-trip-picker-cancel {
  padding: 8px 16px; border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: transparent; color: var(--color-foreground);
  font: inherit; font-weight: 600; cursor: pointer; min-height: 36px;
}
`;

type Tab = 'search' | 'saved';

export default function ExplorePage() {
  useRequireAuth();
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PoiSearchResult[]>([]);
  const [saved, setSaved] = useState<SavedPoiRow[]>([]);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [selectedSavedIds, setSelectedSavedIds] = useState<Set<number>>(new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [showTripPicker, setShowTripPicker] = useState(false);
  const [trips, setTrips] = useState<TripPickerRow[] | null>(null);
  // Section 4.9：region selector + category subtab filter
  // Section 5 (E4)：region 預設用 active trip's countries → 對應地區名
  const { activeTripId } = useActiveTrip();
  const defaultRegion = useMemo(() => {
    const t = trips?.find((x) => x.tripId === activeTripId);
    const country = (t?.countries ?? '').trim().toUpperCase();
    if (country.includes('JP')) return '沖繩';
    if (country.includes('KR')) return '首爾';
    if (country.includes('TW')) return '台北';
    return '全部地區';
  }, [trips, activeTripId]);
  const [region, setRegion] = useState<string>('全部地區');
  // 第一次 trips/activeTripId resolve 後同步 default
  useEffect(() => {
    if (region === '全部地區' && defaultRegion !== '全部地區') setRegion(defaultRegion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultRegion]);
  const [category, setCategory] = useState<string>('all');

  const loadSaved = useCallback(async () => {
    try {
      const rows = await apiFetch<SavedPoiRow[]>('/saved-pois');
      setSaved(rows);
    } catch {
      // silent — likely 401
    }
  }, []);

  useEffect(() => { void loadSaved(); }, [loadSaved]);

  const savedKeySet = useMemo(
    () => new Set(saved.map((r) => `${r.poiType}::${r.poiName}`)),
    [saved],
  );

  // Drop selections that no longer exist (after refetch)
  useEffect(() => {
    setSelectedSavedIds((prev) => {
      const validIds = new Set(saved.map((s) => s.id));
      let changed = false;
      const next = new Set<number>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [saved]);

  async function runSearch(q: string) {
    if (q.length < 2) {
      showToast('至少輸入 2 個字', 'error', 2000);
      return;
    }
    setSearching(true);
    try {
      const resp = await fetch(`/api/poi-search?q=${encodeURIComponent(q)}&limit=20`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const body = (await resp.json()) as { results: PoiSearchResult[] };
      setResults(body.results);
    } catch {
      showToast('搜尋失敗（Nominatim 暫時無法連線）', 'error', 3000);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await runSearch(query.trim());
  }

  /** F6 design-review: chip suggestion click → 自動填欄 + 觸發搜尋。 */
  function handleChipClick(suggestion: string) {
    setQuery(suggestion);
    void runSearch(suggestion);
  }

  /** F6 design-review: landing empty state suggestion chips。 */
  const SUGGESTED_QUERIES = ['沖繩美麗海水族館', '首里城', '國際通', '古宇利大橋', '美國村'];

  /* 2026-04-29 (E5 user 拍板「對齊 mockup default load 熱門 POI grid」):
   * 移除 onboarding empty state「試試熱門 POI」,改 mount 後 region resolve 自動
   * runSearch 拉熱門 POI grid。region 預設「全部地區」 fallback 用熱門目的地
   * 「東京」做 seed,有 active trip 則 active trip's region(沖繩/首爾/台北)。 */
  const [hasAutoSearched, setHasAutoSearched] = useState(false);
  useEffect(() => {
    if (hasAutoSearched || tab !== 'search') return;
    const seed = region !== '全部地區' ? region : '東京';
    setHasAutoSearched(true);
    void runSearch(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, tab]);

  async function handleSave(poi: PoiSearchResult) {
    setSavingIds((s) => new Set(s).add(poi.osm_id));
    try {
      // PR-T 2026-04-26：原本直接送 poi.category（Nominatim raw 'tourism' /
      // 'amenity' / 'shop' 等），會被 pois.type CHECK constraint 拒收 → 503。
      // 走 mapNominatimCategory() 映射到 whitelist（同 InlineAddPoi 用法）。
      const createResp = await apiFetch<{ id: number }>('/pois/find-or-create', {
        method: 'POST',
        body: JSON.stringify({
          name: poi.name,
          type: mapNominatimCategory(poi.category),
          lat: poi.lat,
          lng: poi.lng,
          address: poi.address,
          category: poi.category,
          source: 'user-explore',
        }),
      });
      await apiFetch('/saved-pois', {
        method: 'POST',
        body: JSON.stringify({ poiId: createResp.id }),
      });
      showToast(`已儲存「${poi.name}」`, 'success', 2000);
      await loadSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知錯誤';
      showToast(`儲存失敗：${msg}`, 'error', 3000);
    } finally {
      setSavingIds((s) => {
        const next = new Set(s);
        next.delete(poi.osm_id);
        return next;
      });
    }
  }

  function toggleSavedSelection(id: number) {
    setSelectedSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() { setSelectedSavedIds(new Set()); }

  // PR-X 2026-04-26：批次刪除選中的 saved POI。confirm → Promise.all DELETE
  // → optimistic local removal + reload。
  async function handleDeleteSelected() {
    const ids = Array.from(selectedSavedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`確定刪除選中的 ${ids.length} 個收藏？此操作無法復原。`)) return;
    setDeletingSelected(true);
    try {
      const results = await Promise.all(
        ids.map((id) =>
          apiFetch(`/saved-pois/${id}`, { method: 'DELETE' })
            .then(() => ({ id, ok: true as const }))
            .catch((err: unknown) => ({ id, ok: false as const, err })),
        ),
      );
      const failed = results.filter((r) => !r.ok);
      if (failed.length === 0) {
        showToast(`已刪除 ${ids.length} 個收藏`, 'success', 2400);
      } else if (failed.length < ids.length) {
        showToast(`已刪除 ${ids.length - failed.length} 個，${failed.length} 個失敗`, 'error', 3000);
      } else {
        showToast(`刪除失敗，請稍後再試`, 'error', 3000);
      }
      setSelectedSavedIds(new Set());
      await loadSaved();
    } finally {
      setDeletingSelected(false);
    }
  }

  async function openTripPicker() {
    if (selectedSavedIds.size === 0) return;
    setShowTripPicker(true);
    if (trips !== null) return;
    try {
      const myRes = await fetch('/api/my-trips', { credentials: 'same-origin' });
      const allRes = await fetch('/api/trips?all=1', { credentials: 'same-origin' });
      if (!myRes.ok || !allRes.ok) {
        setTrips([]);
        return;
      }
      const myJson = (await myRes.json()) as { tripId: string }[];
      const allJson = (await allRes.json()) as TripPickerRow[];
      const mine = new Set(myJson.map((r) => r.tripId));
      setTrips(allJson.filter((t) => mine.has(t.tripId)));
    } catch {
      setTrips([]);
    }
  }

  function pickTrip(tripId: string) {
    setShowTripPicker(false);
    const count = selectedSavedIds.size;
    showToast(
      `已選 ${count} 個 POI 加入「${tripId}」（待 entry POST API 接通）`,
      'success',
      2400,
    );
    setSelectedSavedIds(new Set());
    navigate(`/trips?selected=${encodeURIComponent(tripId)}`);
  }

  const main = (
    <div className="explore-shell">
      <style>{SCOPED_STYLES}</style>
      {/* TitleBar 拉出 .explore-wrap,full-width sticky 對齊其他頁面 standard。 */}
      <TitleBar
        title={tab === 'saved' ? '我的收藏' : '探索'}
        back={tab === 'saved' ? () => setTab('search') : undefined}
        backLabel={tab === 'saved' ? '返回探索' : undefined}
        actions={
          tab === 'search' ? (
            <button
              type="button"
              className="tp-titlebar-action"
              onClick={() => setTab('saved')}
              aria-label="我的收藏"
              title="我的收藏"
              data-testid="explore-saved-titlebar"
            >
              {/* 2026-04-29 mockup parity (E1):桌機 icon+「我的收藏」文字
               * (對齊 mockup S18 line 7294/7370),手機 (<=760px) 縮回 icon-only。
               * 「所有 title 規範」:.tp-titlebar-action class 統一 pattern。 */}
              <Icon name="heart" />
              <span className="tp-titlebar-action-label">我的收藏</span>
            </button>
          ) : null
        }
      />
      <div className="explore-wrap" data-testid="explore-page">
        <ToastContainer />

        {/* 收藏 view 內顯示 count meta，取代既有 tab badge，與 mockup
          * section 18 single-content 結構一致 */}
        {tab === 'saved' && saved.length > 0 && (
          <p className="section-meta" data-testid="explore-saved-count">{saved.length} 個收藏 POI</p>
        )}

        {tab === 'search' && (
          <>
            {/* Section 4.9：對齊 mockup section 18 (line 7298-7311) element 順序
              * → region pill → search bar → subtab chips → grid */}
            <div className="explore-region-bar">
              <button
                type="button"
                className="explore-region-pill"
                onClick={() => {
                  const next = window.prompt('輸入要查看的地區（例：沖繩、首爾、台北）', region === '全部地區' ? '' : region);
                  if (next != null) setRegion(next.trim() || '全部地區');
                }}
                data-testid="explore-region-pill"
              >
                <Icon name="location-pin" />
                <span>{region} ▾</span>
              </button>
            </div>

            <form className="explore-search" onSubmit={handleSearch}>
              <span className="search-icon"><Icon name="search" /></span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋景點、餐廳、住宿…"
                data-testid="explore-search-input"
              />
              <button type="submit" disabled={searching} data-testid="explore-search-submit">
                {searching ? '搜尋中...' : '搜尋'}
              </button>
            </form>

            <div className="explore-subtabs" role="tablist" aria-label="POI 類別">
              {([
                { key: 'all', label: '為你推薦' },
                { key: 'attraction', label: '景點' },
                { key: 'food', label: '美食' },
                { key: 'hotel', label: '住宿' },
                { key: 'shopping', label: '購物' },
              ] as const).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={category === s.key}
                  className={`explore-subtab ${category === s.key ? 'is-active' : ''}`}
                  onClick={() => setCategory(s.key)}
                  data-testid={`explore-subtab-${s.key}`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {results.length > 0 && (() => {
              // Section 4.9：純 client-side filter — region 對應 address contains，
              // category 對應 poi.category text；無資料就 fallback 全顯示。
              const filtered = results.filter((p) => {
                if (region !== '全部地區' && !(p.address ?? '').includes(region)) return false;
                if (category === 'all') return true;
                const cat = (p.category ?? '').toLowerCase();
                if (category === 'food' && /restaurant|cafe|food|bar|bakery|餐|食/.test(cat)) return true;
                if (category === 'hotel' && /hotel|hostel|guest|inn|住宿|飯店/.test(cat)) return true;
                if (category === 'shopping' && /shop|mall|market|購物/.test(cat)) return true;
                if (category === 'attraction' && /attract|museum|park|temple|景點|公園/.test(cat)) return true;
                return false;
              });
              return (
                <section className="explore-section" data-testid="explore-results">
                  <h2>搜尋結果</h2>
                  <p className="section-meta">
                    {filtered.length} / {results.length} 個 POI · 點愛心圖示加入我的收藏
                  </p>
                  <div className="explore-poi-grid">
                    {filtered.map((poi) => {
                      const key = `${poi.category || 'poi'}::${poi.name}`;
                      const isSaved = savedKeySet.has(key);
                      const isSaving = savingIds.has(poi.osm_id);
                      // Stable tone 1-8 derived from osm_id 後綴 hash。
                      const tone = ((poi.osm_id ?? 0) % 8) + 1;
                      return (
                        <article className="explore-poi-card" key={poi.osm_id}>
                          <div
                            className="explore-poi-cover"
                            data-tone={String(tone)}
                            aria-hidden="true"
                          >
                            <button
                              type="button"
                              className={`explore-poi-heart ${isSaved ? 'is-saved' : ''}`}
                              onClick={() => !isSaved && !isSaving && handleSave(poi)}
                              disabled={isSaving || isSaved}
                              aria-label={isSaved ? '已儲存' : '儲存到收藏'}
                              data-testid={`explore-save-btn-${poi.osm_id}`}
                            >
                              <Icon name="heart" />
                            </button>
                          </div>
                          <div className="explore-poi-body">
                            <div className="poi-category">{poi.category || 'POI'}</div>
                            <div className="poi-name">{poi.name}</div>
                            <div className="poi-address">{poi.address}</div>
                            {/* Section 4.9：rating meta — 真實 rating 待 backend
                              提供 Google rating 接入；先用 placeholder ⭐ + 「待補」 */}
                            <div className="explore-poi-rating">
                              <span className="explore-poi-rating-star">★</span>
                              <span>探索更多評論</span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })()}

            {results.length === 0 && query && !searching && (
              <div className="explore-empty">沒有找到「{query}」的結果。換個關鍵字試試？</div>
            )}

            {/* 2026-04-29 (E5):landing empty state 移除,改 mount auto search
             * 帶熱門 POI grid。fallback empty state 只 fire 在 search 失敗 +
             * 沒結果情境(沒 query,results=[]),提供 chip 讓 user 重啟。 */}
            {results.length === 0 && !query && !searching && hasAutoSearched && (
              <div className="explore-landing-empty" data-testid="explore-landing-empty">
                <div className="landing-eyebrow">沒拿到結果</div>
                <h3 className="landing-title">試試這些</h3>
                <p className="landing-copy">看起來這個地區暫時沒結果,點下方建議或自行搜尋。</p>
                <div className="landing-chips">
                  {SUGGESTED_QUERIES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="landing-chip"
                      onClick={() => handleChipClick(s)}
                      data-testid={`explore-suggestion-${s}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'saved' && (
          <section className="explore-section" data-testid="explore-saved">
            <h2>我的收藏</h2>
            <p className="section-meta">勾選想加入行程的 POI，點「加入行程」一鍵丟進選定 trip。</p>

            {selectedSavedIds.size > 0 && (
              <div className="explore-toolbar" data-testid="explore-toolbar">
                <span>已選 {selectedSavedIds.size} 個</span>
                <div className="explore-toolbar-actions">
                  <button
                    type="button"
                    className="explore-toolbar-btn explore-toolbar-btn-ghost"
                    onClick={clearSelection}
                    disabled={deletingSelected}
                    data-testid="explore-clear-selection"
                  >
                    取消選擇
                  </button>
                  <button
                    type="button"
                    className="explore-toolbar-btn"
                    onClick={openTripPicker}
                    disabled={deletingSelected}
                    data-testid="explore-add-to-trip"
                  >
                    加入行程
                  </button>
                  <button
                    type="button"
                    className="explore-toolbar-btn explore-toolbar-btn-destructive"
                    onClick={handleDeleteSelected}
                    disabled={deletingSelected}
                    data-testid="explore-delete-selected"
                  >
                    {deletingSelected ? '刪除中…' : '刪除'}
                  </button>
                </div>
              </div>
            )}

            {saved.length === 0 ? (
              <div className="explore-empty">還沒有儲存任何 POI。先去「搜尋」找幾個。</div>
            ) : (
              <div className="explore-poi-grid">
                {saved.map((row) => {
                  const isSelected = selectedSavedIds.has(row.id);
                  return (
                    <article
                      className={`explore-poi-card ${isSelected ? 'is-selected' : ''}`}
                      key={row.id}
                      data-testid={`saved-card-${row.id}`}
                    >
                      <div className="poi-category">{row.poiType}</div>
                      <div className="poi-name">{row.poiName}</div>
                      {row.poiAddress && <div className="poi-address">{row.poiAddress}</div>}
                      <div className="poi-actions">
                        <label
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        >
                          <input
                            type="checkbox"
                            className="explore-poi-checkbox"
                            checked={isSelected}
                            onChange={() => toggleSavedSelection(row.id)}
                            data-testid={`saved-check-${row.id}`}
                          />
                          <span style={{ fontSize: 'var(--font-size-footnote)', color: 'var(--color-muted)' }}>
                            {isSelected ? '已選' : '選取'}
                          </span>
                        </label>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {showTripPicker && (
        <div
          className="tp-trip-picker-backdrop"
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) setShowTripPicker(false); }}
          data-testid="explore-trip-picker"
        >
          <div className="tp-trip-picker" role="dialog" aria-modal="true" aria-labelledby="trip-picker-title">
            <h2 id="trip-picker-title">選擇要加入的行程</h2>
            <p>已選 {selectedSavedIds.size} 個 POI</p>
            <div className="tp-trip-picker-list">
              {trips === null && <div className="tp-trip-picker-empty">載入中…</div>}
              {trips !== null && trips.length === 0 && (
                <div className="tp-trip-picker-empty">你還沒有任何行程，先去新增一個。</div>
              )}
              {trips !== null && trips.map((t) => (
                <button
                  key={t.tripId}
                  type="button"
                  className="tp-trip-picker-row"
                  onClick={() => pickTrip(t.tripId)}
                  data-testid={`explore-trip-pick-${t.tripId}`}
                >
                  <span className="row-title">{t.title || t.name || t.tripId}</span>
                  <span className="row-meta">{(t.countries ?? '').toUpperCase() || '—'}</span>
                </button>
              ))}
            </div>
            <div className="tp-trip-picker-actions">
              <button
                type="button"
                className="tp-trip-picker-cancel"
                onClick={() => setShowTripPicker(false)}
                data-testid="explore-trip-picker-cancel"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={main}
      bottomNav={<GlobalBottomNav authed={!!user} />}
    />
  );
}
