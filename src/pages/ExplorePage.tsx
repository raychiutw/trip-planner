/**
 * ExplorePage — V2 探索 POI（v2.21.0 secondary entry）.
 *
 * 從 v2.21.0 起，「我的收藏」升 primary nav (`/favorites` PoiFavoritesPage)，本頁變成純探索：
 *   - Nominatim search with single-click 加入收藏 per result
 *   - region pill / category subtab filter
 *   - heart toggle 加入「我的收藏」(loadSaved mini-fetch 維 favoriteKeySet 正確 disable)
 *
 * Auth: useRequireAuth — page is for logged-in users.
 * TitleBar 右上 action 拔除 (v2.33.140) — back ← 已回 /favorites，重複入口。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { mapNominatimCategory, POI_TYPE_LABELS } from '../lib/poiCategory';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import Icon from '../components/shared/Icon';
import ToastContainer, { showToast } from '../components/shared/Toast';
import InputModal from '../components/shared/InputModal';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';

/** Region 候選 (常用 destinations + 全部地區)。Active trip's region 自動加進來不重複。 */
const POPULAR_REGIONS = ['全部地區', '沖繩', '東京', '京都', '首爾', '台北'] as const;

import type { PoiSearchResult } from '../types/poi';
import { regionToApiParam } from '../lib/maps/region';
import { useNavigateBack } from '../hooks/useNavigateBack';

/**
 * Mini-fetch shape — favoriteKeyMap 用 (poiType, poiName) → favorite row id。
 * v2.31.43：原本只取 poiType + poiName 算 favoriteKeySet（heart-disable）；
 * 改為 toggle 後要拿 id 走 DELETE /poi-favorites/:id，故補 id 欄位。
 */
interface SavedKeyRow {
  id: number;
  poiName: string;
  poiType: string;
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

/* explore-header 改用統一 <TitleBar>。.explore-header CSS 已退役。 */

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
  font: inherit; font-size: var(--font-size-subheadline); color: var(--color-foreground);
  outline: none;
}
.explore-search input::placeholder { color: var(--color-muted); }
/* iOS Safari 對 input font-size < 16px 自動 zoom 破版；mobile 用 16px 防 zoom，desktop 維持 15px */
@media (max-width: 760px) {
  .explore-search input { font-size: var(--font-size-body); }
}
.explore-search button {
  padding: 8px 16px; border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-accent-foreground);
  border: none; cursor: pointer;
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
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
/* .explore-toolbar-btn* 在 JSX 從未引用（dead CSS），統一由 .tp-action-btn
 * family (css/tokens.css) 提供 — 未來 toolbar UI 需要按鈕直接用新 class */

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
  /* H6 exception: heart icon on permanent rgba(0,0,0) overlay — text must
     stay light in both light/dark mode for contrast against dark backdrop. */
  background: rgba(0, 0, 0, 0.45);
  color: #ffffff;
  display: grid; place-items: center;
  cursor: pointer;
  transition: background 120ms, color 120ms, transform 120ms;
  backdrop-filter: blur(8px);
}
.explore-poi-card .explore-poi-heart:hover:not(:disabled) { background: rgba(0, 0, 0, 0.65); transform: scale(1.05); }
.explore-poi-card .explore-poi-heart.is-saved {
  background: var(--color-accent); color: var(--color-accent-foreground);
}
/* v2.31.43 saved 狀態 hover 顯「取消收藏」affordance — 紅化 + 維持 scale 提示可 click。 */
.explore-poi-card .explore-poi-heart.is-saved:hover:not(:disabled) {
  background: var(--color-priority-high-bg, #fee2e2);
  color: var(--color-priority-high-dot, #b91c1c);
  transform: scale(1.05);
}
.explore-poi-card .explore-poi-heart .svg-icon { width: 18px; height: 18px; }
/* v2.23.8: ➕ 加入行程 button — accent 實心並排 ❤ 右側偏左 */
.explore-poi-card .explore-poi-add-to-trip {
  position: absolute;
  top: 8px; right: 52px;
  width: 36px; height: 36px;
  border: 0; border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  display: grid; place-items: center;
  cursor: pointer;
  transition: background 120ms, transform 120ms;
  backdrop-filter: blur(8px);
}
.explore-poi-card .explore-poi-add-to-trip:hover {
  filter: brightness(0.95);
  transform: scale(1.05);
}
.explore-poi-card .explore-poi-add-to-trip .svg-icon { width: 18px; height: 18px; }
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
  min-height: var(--spacing-tap-min);
}
.explore-region-pill:hover { border-color: var(--color-accent); color: var(--color-accent); }
.explore-region-pill[aria-expanded="true"] { border-color: var(--color-accent); color: var(--color-accent); }

/* Section 4.9：region picker popover (取代 window.prompt) */
.explore-region-picker-anchor { position: relative; display: inline-block; }
.explore-region-popover {
  position: absolute; top: calc(100% + 6px); left: 0;
  z-index: 50;
  min-width: 180px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 6px;
  animation: tp-region-pop-in 140ms var(--transition-timing-function-apple);
}
@keyframes tp-region-pop-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.explore-region-option {
  display: flex; align-items: center; gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none; background: transparent;
  border-radius: var(--radius-sm);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 500;
  color: var(--color-foreground);
  cursor: pointer;
  text-align: left;
  min-height: 36px;
}
.explore-region-option:hover { background: var(--color-hover); }
.explore-region-option.is-active {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  font-weight: 700;
}
.explore-region-option-divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}
.explore-region-option-custom {
  color: var(--color-accent);
  font-weight: 600;
}
.explore-subtabs {
  display: inline-flex; align-items: center; gap: 6px;
  flex-wrap: wrap;
}
.explore-subtab {
  border: 1px solid transparent; background: var(--color-secondary);
  padding: 6px 12px; border-radius: var(--radius-full);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-muted); cursor: pointer;
  min-height: var(--spacing-tap-min);
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
  font: inherit; font-size: var(--font-size-caption); font-weight: 600;
  color: var(--color-foreground); cursor: pointer; min-height: var(--spacing-tap-min);
}
.explore-poi-card .poi-actions button:hover { border-color: var(--color-accent); color: var(--color-accent); }
.explore-poi-card .poi-actions button.saved { background: var(--color-accent); color: var(--color-accent-foreground); border-color: var(--color-accent); }
.explore-poi-card .poi-actions button:disabled { opacity: 0.6; cursor: not-allowed; }

.explore-poi-card .poi-usage-badge {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  margin-top: 4px;
}
.explore-poi-card .poi-actions-saved { display: flex; gap: 12px; align-items: center; margin-top: 8px; }
.explore-poi-card .poi-select-label {
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  font-size: var(--font-size-footnote); color: var(--color-muted);
}
.explore-poi-card .poi-add-link {
  font-size: var(--font-size-footnote);
  color: var(--color-accent);
  text-decoration: none;
}
.explore-poi-card .poi-add-link:hover { text-decoration: underline; }

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

/* v2.31.22: category filter 0 結果 empty state — 暖 placeholder + reset CTA */
.explore-filter-empty {
  padding: 32px 24px; text-align: center;
  background: var(--color-background); border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  display: flex; flex-direction: column; gap: 12px; align-items: center;
}
.explore-filter-empty p {
  margin: 0; color: var(--color-muted); font-size: var(--font-size-callout);
}
.explore-filter-empty-reset {
  padding: 8px 16px; border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-accent-foreground);
  border: 0; font-weight: 600; cursor: pointer;
  font-size: var(--font-size-footnote);
}
.explore-filter-empty-reset:hover { filter: brightness(0.95); }

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

/* 2026-05-03 modal-to-fullpage migration audit: tp-trip-picker-* (backdrop +
 * modal shell + actions + cancel button) CSS 已退場。chooser 改 anchored
 * popover，rules 全搬到 src/components/explore/TripPickerPopover.tsx
 * SCOPED_STYLES。row hover / empty state 規則一併隨 component 走。 */
`;

export default function ExplorePage() {
  useRequireAuth();
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const goBack = useNavigateBack('/favorites');

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PoiSearchResult[]>([]);
  const [savedKeyRows, setSavedKeyRows] = useState<SavedKeyRow[]>([]);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  // Region selector + category subtab filter
  const [region, setRegion] = useState<string>('全部地區');
  const [category, setCategory] = useState<string>('all');

  /* Region picker popover state (取代 window.prompt) */
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [regionInputOpen, setRegionInputOpen] = useState(false);
  const regionAnchorRef = useRef<HTMLDivElement>(null);

  // Click-outside / Escape close popover
  useEffect(() => {
    if (!regionPickerOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (regionAnchorRef.current && !regionAnchorRef.current.contains(e.target as Node)) {
        setRegionPickerOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setRegionPickerOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [regionPickerOpen]);

  // Combined option list — POPULAR + active trip's region (if not in popular)
  const regionOptions = useMemo(() => {
    const list: string[] = [...POPULAR_REGIONS];
    if (region !== '全部地區' && !list.includes(region)) {
      list.splice(1, 0, region);
    }
    return list;
  }, [region]);

  /**
   * Mini-fetch /poi-favorites → favoriteKeySet (MF6) — 只為了 heart toggle disable
   * 正確性。PoiFavoritesPage 拆出後 ExplorePage 不再做完整 saved CRUD，但 heart
   * disable 「已收藏」 狀態仍要正確。codebase 沒 React Query/SWR，各頁獨立 fetch。
   */
  const loadSaved = useCallback(async () => {
    try {
      const rows = await apiFetch<SavedKeyRow[]>('/poi-favorites');
      setSavedKeyRows(rows);
    } catch {
      // silent — likely 401 or transient; heart disable 退回「皆未收藏」 fallback。
    }
  }, []);

  useEffect(() => { void loadSaved(); }, [loadSaved]);

  /* v2.31.43：Map<key, id> 取代 Set<key>，toggle off 走 DELETE 必須拿到 id。 */
  const favoriteKeyMap = useMemo(
    () => new Map<string, number>(
      savedKeyRows.map((r) => [`${r.poiType}::${r.poiName}`, r.id] as const),
    ),
    [savedKeyRows],
  );

  // AbortController + sequence guard — 防 auto-search / chip click / manual
  // submit 三路 fetch race，慢 response 覆蓋快 response。Submit-based UX 跟
  // usePoiSearch 的 debounce 範式不同 (按 Enter / chip 立即查)，留 fetch 但
  // 加 abort + seq。
  const searchAbortRef = useRef<AbortController | null>(null);
  async function runSearch(q: string) {
    if (q.length < 2) {
      showToast('至少輸入 2 個字', 'error', 2000);
      return;
    }
    searchAbortRef.current?.abort();
    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;
    setSearching(true);
    try {
      const regionApi = regionToApiParam(region);
      const regionParam = regionApi ? `&region=${encodeURIComponent(regionApi)}` : '';
      const body = await apiFetch<{ results?: PoiSearchResult[] }>(
        `/poi-search?q=${encodeURIComponent(q)}&limit=20${regionParam}`,
        { signal: ctrl.signal },
      );
      if (searchAbortRef.current === ctrl) setResults(body.results ?? []);
    } catch (_err) {
      // signal.aborted 直接判 — apiFetch 把 AbortError wrap 成 NET_TIMEOUT，
      // 用 signal state 比 err.name 更精準（avoids ApiError → DOMException name 損失）。
      if (ctrl.signal.aborted) return;
      showToast('搜尋失敗，請稍後再試', 'error', 3000);
      if (searchAbortRef.current === ctrl) setResults([]);
    } finally {
      if (searchAbortRef.current === ctrl) setSearching(false);
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

  /* mount auto-search default seed — 對齊 mockup landing 熱門 POI grid。 */
  const [hasAutoSearched, setHasAutoSearched] = useState(false);
  useEffect(() => {
    if (hasAutoSearched) return;
    const seed = region !== '全部地區' ? region : '東京';
    setHasAutoSearched(true);
    void runSearch(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  /**
   * v2.31.43 toggle 版本：is-saved 走 DELETE，否則走原本的 find-or-create + POST。
   * Heart icon click → 已收藏移除 / 未收藏加入，single button 兩種 affordance。
   */
  async function handleToggleFavorite(poi: PoiSearchResult, isPoiFavorited: boolean) {
    setSavingIds((s) => new Set(s).add(poi.place_id));
    try {
      if (isPoiFavorited) {
        const key = `${mapNominatimCategory(poi.category ?? '')}::${poi.name}`;
        const favoriteId = favoriteKeyMap.get(key);
        if (favoriteId == null) {
          showToast('找不到對應收藏 id，請重整頁面', 'error', 3000);
          return;
        }
        await apiFetch(`/poi-favorites/${favoriteId}`, { method: 'DELETE' });
        showToast(`已取消收藏「${poi.name}」`, 'success', 2000);
        await loadSaved();
        return;
      }
      // PR-T 2026-04-26：Nominatim raw 'tourism' / 'amenity' / 'shop' 會被
      // pois.type CHECK constraint 拒收 → 503；走 mapNominatimCategory 映射。
      const createResp = await apiFetch<{ id: number }>('/pois/find-or-create', {
        method: 'POST',
        body: JSON.stringify({
          name: poi.name,
          type: mapNominatimCategory(poi.category ?? ''),
          lat: poi.lat,
          lng: poi.lng,
          address: poi.address ?? '',
          category: poi.category ?? '',
          source: 'user-explore',
        }),
      });
      await apiFetch('/poi-favorites', {
        method: 'POST',
        body: JSON.stringify({ poiId: createResp.id }),
      });
      showToast(`已加入收藏「${poi.name}」`, 'success', 2000);
      await loadSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知錯誤';
      const verb = isPoiFavorited ? '取消收藏' : '加入收藏';
      showToast(`${verb}失敗：${msg}`, 'error', 3000);
    } finally {
      setSavingIds((s) => {
        const next = new Set(s);
        next.delete(poi.place_id);
        return next;
      });
    }
  }

  const main = (
    <div className="explore-shell">
      <style>{SCOPED_STYLES}</style>
      {/* v2.33.140: 拔 TitleBar 右上「收藏」ghost action — back ← 已回 /favorites，
          重複入口 user feedback「不需要右上角的按鈕」。 */}
      <TitleBar
        title="探索"
        back={goBack}
        backLabel="返回收藏"
      />
      <div className="explore-wrap" data-testid="explore-page">
        <ToastContainer />

        <>
            {/* Section 4.9：對齊 mockup section 18 (line 7298-7311) element 順序
              * → region pill → search bar → subtab chips → grid */}
            <div className="explore-region-bar">
              <div className="explore-region-picker-anchor" ref={regionAnchorRef}>
                <button
                  type="button"
                  className="explore-region-pill"
                  onClick={() => setRegionPickerOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={regionPickerOpen}
                  data-testid="explore-region-pill"
                >
                  <Icon name="location-pin" />
                  <span>{region} ▾</span>
                </button>
                {regionPickerOpen && (
                  <div className="explore-region-popover" role="listbox" data-testid="explore-region-popover">
                    {regionOptions.map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        role="option"
                        aria-selected={opt === region}
                        className={`explore-region-option${opt === region ? ' is-active' : ''}`}
                        onClick={() => {
                          setRegion(opt);
                          setRegionPickerOpen(false);
                        }}
                        data-testid={`explore-region-option-${opt}`}
                      >
                        {opt}
                      </button>
                    ))}
                    <div className="explore-region-option-divider" aria-hidden="true" />
                    <button
                      type="button"
                      className="explore-region-option explore-region-option-custom"
                      onClick={() => {
                        setRegionPickerOpen(false);
                        setRegionInputOpen(true);
                      }}
                      data-testid="explore-region-option-custom"
                    >
                      + 自訂地區…
                    </button>
                  </div>
                )}
              </div>
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

            <div className="explore-subtabs" role="tablist" aria-label="景點類別">
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
              // Section 4.9：client-side category filter only。region bias 從 v2.23.4
              // 起改走 server-side locationBias circle（functions/api/poi-search.ts）—
              // address-includes 中文 city 名 client filter 對英文 address「Tokyo, Japan」
              // 永遠 mismatch，drop。
              const filtered = results.filter((p) => {
                if (category === 'all') return true;
                const cat = (p.category ?? '').toLowerCase();
                if (category === 'food' && /restaurant|cafe|food|bar|bakery|餐|食/.test(cat)) return true;
                if (category === 'hotel' && /hotel|hostel|guest|inn|住宿|飯店/.test(cat)) return true;
                if (category === 'shopping' && /shop|mall|market|購物/.test(cat)) return true;
                if (category === 'attraction' && /attract|museum|park|temple|景點|公園/.test(cat)) return true;
                return false;
              });
              // v2.31.22: category filter 沒符合結果時的中文 label，給 empty state 用。
              const CATEGORY_LABELS: Record<string, string> = {
                all: '為你推薦',
                attraction: '景點',
                food: '美食',
                hotel: '住宿',
                shopping: '購物',
              };
              // v2.31.55：query 空時 user 在「為你推薦」auto-seed landing，
              // header「搜尋結果」語意不對。改 conditional：query 有值 = 真正搜尋
              // → 「搜尋結果」；query 空 = landing → 「推薦景點」。對齊 add-stop /
              // change-poi page section title 同樣的 search/landing 切換邏輯。
              const sectionTitle = query.trim().length >= 2 ? '搜尋結果' : '推薦景點';
              return (
                <section className="explore-section" data-testid="explore-results">
                  <h2>{sectionTitle}</h2>
                  <p className="section-meta">
                    {filtered.length} / {results.length} 個景點 · 點愛心圖示加入我的收藏
                  </p>
                  {filtered.length === 0 ? (
                    // v2.31.22: filter 0 結果 empty state — 以前是空白讓 user 迷路。
                    <div className="explore-filter-empty" data-testid="explore-filter-empty">
                      <p>沒有符合「{CATEGORY_LABELS[category] ?? category}」的結果。試試其他分類或回到「為你推薦」。</p>
                      <button
                        type="button"
                        className="explore-filter-empty-reset"
                        onClick={() => setCategory('all')}
                        data-testid="explore-filter-empty-reset"
                      >
                        回到為你推薦
                      </button>
                    </div>
                  ) : (
                  <div className="explore-poi-grid">
                    {filtered.map((poi) => {
                      /* v2.31.43：key 用 mapped category 對齊 backend pois.type 寫法
                       * （`/pois/find-or-create` body `type: mapNominatimCategory(...)`）。
                       * 之前用 raw `poi.category` 算 key，永遠跟 saved row poiType 對不上，
                       * isPoiFavorited heart 永遠 false → 重複加收藏。順手修。 */
                      const key = `${mapNominatimCategory(poi.category ?? '')}::${poi.name}`;
                      const isPoiFavorited = favoriteKeyMap.has(key);
                      const isSaving = savingIds.has(poi.place_id);
                      // Stable tone 1-8 derived from place_id char-sum hash（v2.23.0：string id）。
                      const placeIdHash = (poi.place_id || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
                      const tone = (placeIdHash % 8) + 1;
                      return (
                        <article className="explore-poi-card" key={poi.place_id}>
                          <div
                            className="explore-poi-cover"
                            data-tone={String(tone)}
                            aria-hidden="true"
                          >
                            <button
                              type="button"
                              className={`explore-poi-heart ${isPoiFavorited ? 'is-saved' : ''}`}
                              onClick={() => !isSaving && handleToggleFavorite(poi, isPoiFavorited)}
                              disabled={isSaving}
                              aria-label={isPoiFavorited ? '已收藏 · 點擊取消' : '加入收藏'}
                              title={isPoiFavorited ? '已收藏 · 點擊取消' : '加入收藏'}
                              data-testid={`explore-save-btn-${poi.place_id}`}
                            >
                              <Icon name="heart" />
                            </button>
                            {/* v2.23.8: ➕ 加入行程 — direct-mode AddPoiFavoriteToTripPage（不需先收藏） */}
                            <button
                              type="button"
                              className="explore-poi-add-to-trip"
                              onClick={() => {
                                const params = new URLSearchParams({
                                  place_id: poi.place_id,
                                  name: poi.name,
                                  lat: String(poi.lat),
                                  lng: String(poi.lng),
                                });
                                if (poi.address) params.set('address', poi.address);
                                if (poi.category) params.set('category', poi.category);
                                navigate(`/add-to-trip?${params.toString()}`);
                              }}
                              aria-label="加入行程"
                              title="加入行程"
                              data-testid={`explore-add-to-trip-btn-${poi.place_id}`}
                            >
                              <Icon name="plus" />
                            </button>
                          </div>
                          <div className="explore-poi-body">
                            {/* v2.31.20: poi.category 是 Google Places primary type
                              * (例 'ramen_restaurant')。直接 render 會顯 RAMEN_RESTAURANT
                              * raw enum；走 mapNominatimCategory → 中文 label。 */}
                            <div className="poi-category">{POI_TYPE_LABELS[mapNominatimCategory(poi.category)] ?? 'POI'}</div>
                            <div className="poi-name">{poi.name}</div>
                            <div className="poi-address">{poi.address ?? ''}</div>
                            {/* v2.31.12: backend `PoiSearchResult.rating` 已含 Google rating。
                              v2.34.38 prod audit fix: 無 rating 不 render ★（之前 fallback
                              「探索更多評論」是 CTA-as-rating 怪 UX 看似 link 實則無動作）。 */}
                            {typeof poi.rating === 'number' && (
                              <div className="explore-poi-rating">
                                <span className="explore-poi-rating-star">★</span>
                                <span>{poi.rating.toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  )}
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
                <p className="landing-copy">看起來這個地區暫時沒結果，點下方建議或自行搜尋。</p>
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
      </div>

      {/* Region 自訂 input modal (取代 window.prompt) */}
      <InputModal
        open={regionInputOpen}
        title="自訂地區"
        message="輸入要查看的地區，例如：「大阪」、「曼谷」、「巴黎」。"
        placeholder="地區名稱"
        defaultValue={region === '全部地區' ? '' : region}
        confirmLabel="切換"
        allowEmpty
        onConfirm={(v) => {
          setRegion(v.trim() || '全部地區');
          setRegionInputOpen(false);
        }}
        onCancel={() => setRegionInputOpen(false)}
      />
    </div>
  );

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={main}
      bottomNav={<GlobalBottomNav authed={user !== null} />}
    />
  );
}
