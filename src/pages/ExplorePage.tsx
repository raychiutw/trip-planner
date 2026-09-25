/**
 * ExplorePage — V2 探索 POI（v2.21.0 secondary entry）.
 *
 * 從 v2.21.0 起，「我的收藏」升 primary nav (`/favorites` PoiFavoritesPage)，本頁變成純探索：
 *   - Google Places search with single-click 加入收藏 per result
 *   - region pill / category subtab filter
 *   - heart toggle 加入「我的收藏」(loadSaved mini-fetch 維 favoriteKeySet 正確 disable)
 *
 * Auth: useRequireAuth — page is for logged-in users.
 * TitleBar 右上 action 拔除 (v2.33.140) — back ← 已回 /favorites，重複入口。
 */
import AuthStatus from '../components/shared/AuthStatus';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import { TripSelect } from '../components/TripSelect';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { mapNominatimCategory, poiCategoryLabel } from '../lib/poiCategory';
import { poiTypeToTone } from '../lib/timelineUtils';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { ApiError } from '../lib/errors';
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
import { useExploreResults, type ExploreVisit } from '../hooks/useExploreResults';
import { useNavigateBack } from '../hooks/useNavigateBack';

/** Favorites use canonical place identity; names can match unrelated businesses. */
interface SavedKeyRow {
  id: number;
  poiId: number;
  poiPlaceId?: string | null;
}

const SCOPED_STYLES = `
/* 捲到底載更多的哨兵 / 結尾提示。哨兵本身要有高度，否則 IntersectionObserver
   永遠不會觸發（零高度元素在多數瀏覽器不算 intersecting）。 */
.explore-load-more {
  min-block-size: 44px;
  display: grid;
  place-items: center;
  color: var(--color-muted);
  font-size: 13px;
  padding-block: 12px;
}
.explore-load-more.is-end { color: var(--color-muted); opacity: 0.75; }

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
  background: var(--color-accent-fill); color: var(--color-accent-foreground);
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
/* Section 4.9：cover placeholder — 16:9 漸層（v2.54.11 起依 POI 類型三色，見上方 .explore-poi-card[data-tone] .explore-poi-cover）*/
.explore-poi-cover {
  position: relative;
  aspect-ratio: 16/9;
  width: 100%;
  background: var(--color-tertiary);
}
/* 三色：探索卡依 POI 類型上同色系淡底 + 類型標籤色 + cover 漸層（v2.54.11：cover 從舊的
   8 色 hash 裝飾改成依 POI 類型三色，與行程一覽 cover 一致、整頁回歸木棕為主）。neutral 顯式
   回 accent 柔褐。 */
/* v2.55.89 V3 Phase 2：探索卡改 neutral system surface（design.md §8 收藏/探索不以色卡分類）。
   卡底/border 走中性 secondary/tertiary；--tone/-deep 保留柔褐給 cover 漸層與 accent。 */
.explore-poi-card[data-tone="accent"],
.explore-poi-card[data-tone="sage"],
.explore-poi-card[data-tone="pink"],
.explore-poi-card[data-tone="neutral"] { --tone: var(--color-accent); --tone-deep: var(--color-accent-deep); --tone-subtle: var(--color-secondary); --tone-bg: var(--color-tertiary); }
.explore-poi-card[data-tone] { background: var(--tone-subtle); border-color: var(--tone-bg); }
.explore-poi-card[data-tone] .explore-poi-cover { background-image: linear-gradient(135deg, var(--tone) 0%, var(--tone-deep) 100%); }
.explore-poi-card .explore-poi-heart {
  position: absolute;
  top: 8px; right: 8px;
  /* §9.2：44pt HIG 觸控區（原 36px 低於最小觸控目標，手機難點）。 */
  width: var(--spacing-tap-min); height: var(--spacing-tap-min);
  border: 0; border-radius: 50%;
  /* H6 exception: heart icon on permanent rgba(0,0,0) overlay — text must
     stay light in both light/dark mode for contrast against dark backdrop. */
  background: rgba(0, 0, 0, 0.45);
  color: #ffffff;
  display: grid; place-items: center;
  cursor: pointer;
  transition: background 120ms, color 120ms, transform 120ms;
  backdrop-filter: blur(8px);
  /* v2.54.11: cover 改三色後，已收藏的粉底愛心會疊在 food（粉）cover 上同色相溶、
     邊界消失。加 neutral 陰影讓圓鈕在任何同色系 cover 上都浮起、邊界恆可辨（不靠淺 tone 當前景）。*/
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
}
.explore-poi-card .explore-poi-heart:hover:not(:disabled) { background: rgba(0, 0, 0, 0.65); transform: scale(1.05); }
.explore-poi-card .explore-poi-heart.is-saved {
  /* 三色：已收藏愛心 = 第三色粉（收藏/愛心 = 粉）*/
  background: var(--color-accent-3); color: var(--color-accent-foreground);
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
  /* §9.2：44pt HIG 觸控區；並排 ❤ 左側（8 + 44 + 8 = 60）。 */
  top: 8px; right: 60px;
  width: var(--spacing-tap-min); height: var(--spacing-tap-min);
  border: 0; border-radius: 50%;
  background: var(--color-accent-fill);
  color: var(--color-accent-foreground);
  display: grid; place-items: center;
  cursor: pointer;
  transition: background 120ms, transform 120ms;
  backdrop-filter: blur(8px);
  /* v2.54.11: 同上 — 柔褐底加入鈕疊在 attraction（柔褐）cover 上同色相溶，加陰影浮起。*/
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
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
  text-transform: uppercase; color: var(--tone-deep, var(--color-muted));
}

/* Section 4.9：region selector pill + subtabs (5 個 category chip) */
.explore-region-bar {
  display: flex; align-items: center; gap: 12px;
  margin: 12px 0;
  flex-wrap: wrap;
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
/* v2.55.73 動態細類 chip — 數量 badge + 三色 tone（吃=粉／看買=柔褐／住移動=sage）。 */
.explore-subtab-count {
  margin-left: 5px; font-size: var(--font-size-caption2); font-weight: 700;
  opacity: 0.7; font-variant-numeric: tabular-nums;
}
.explore-subtab[data-tone] { --tone-subtle: var(--color-accent-subtle); --tone-deep: var(--color-accent-deep); --tone-bg: var(--color-accent-bg); }
.explore-subtab[data-tone="sage"] { --tone-subtle: var(--color-accent-2-subtle); --tone-deep: var(--color-accent-2-deep); --tone-bg: var(--color-accent-2-bg); }
.explore-subtab[data-tone="pink"] { --tone-subtle: var(--color-accent-3-subtle); --tone-deep: var(--color-accent-3-deep); --tone-bg: var(--color-accent-3-bg); }
/* resting：tone-deep 文字（三色 legend），bg 維持中性；active：tone 淡底 pill（對齊 DESIGN.md 淡底 active）。 */
.explore-subtab[data-tone="accent"] { color: var(--color-accent-deep); }
.explore-subtab[data-tone="sage"] { color: var(--color-accent-2-deep); }
.explore-subtab[data-tone="pink"] { color: var(--color-accent-3-deep); }
.explore-subtab.is-active[data-tone] {
  background: var(--tone-subtle); color: var(--tone-deep); border-color: var(--tone-bg);
}
/* Category overflow uses the existing Headless UI menu keyboard and focus behavior. */
.explore-cat-more { position: relative; display: inline-flex; }
.explore-cat-more-summary { list-style: none; user-select: none; }
.explore-cat-more-summary::-webkit-details-marker { display: none; }
.explore-cat-more-summary[aria-expanded="true"] {
  background: var(--color-accent-subtle); color: var(--color-accent-deep); border-color: var(--color-accent-bg);
}
.explore-cat-menu {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 20;
  min-width: 200px; max-width: min(300px, 80vw);
  background: var(--color-background); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); box-shadow: var(--shadow-lg);
  padding: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 2px;
}
.explore-cat-menu-item {
  display: flex; align-items: center; gap: 8px; padding: 9px 10px;
  border: none; background: transparent; border-radius: var(--radius-sm);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 500;
  color: var(--color-foreground); cursor: pointer; text-align: left;
  min-height: var(--spacing-tap-min);
}
.explore-cat-menu-item:hover { background: var(--color-hover); }
.explore-cat-menu-item.is-active { background: var(--color-accent-subtle); color: var(--color-accent-deep); }
.explore-cat-menu-item .explore-subtab-count { margin-left: auto; }
.explore-cat-menu-dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; background: var(--color-line-strong); }
.explore-cat-menu-item[data-tone="accent"] .explore-cat-menu-dot { background: var(--color-accent); }
.explore-cat-menu-item[data-tone="sage"] .explore-cat-menu-dot { background: var(--color-accent-2); }
.explore-cat-menu-item[data-tone="pink"] .explore-cat-menu-dot { background: var(--color-accent-3); }
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
.explore-poi-card .poi-actions button.saved { background: var(--color-accent-3); color: var(--color-accent-foreground); border-color: var(--color-accent-3); }
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
  background: var(--color-accent-fill); color: var(--color-accent-foreground);
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
  background: var(--color-accent-fill); color: var(--color-accent-foreground);
  border-color: var(--color-accent-fill);
}

/* 2026-05-03 modal-to-fullpage migration audit: tp-trip-picker-* (backdrop +
 * modal shell + actions + cancel button) CSS 已退場。chooser 改 anchored
 * popover，rules 全搬到 src/components/explore/TripPickerPopover.tsx
 * SCOPED_STYLES。row hover / empty state 規則一併隨 component 走。 */
`;

export default function ExplorePage() {
  const auth = useRequireAuth();
  const { user } = auth;
  const navigate = useNavigate();
  const goBack = useNavigateBack('/favorites');

  const location = useLocation();
  const restored = (location.state as { exploreVisit?: ExploreVisit } | null)?.exploreVisit;
  const [query, setQuery] = useState(restored?.query ?? '');
  const exploration = useExploreResults(restored?.results);
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (restored && shellRef.current) shellRef.current.scrollTop = restored.scrollTop; }, [restored]);
  const { searching, loadingMore, canLoadMore, moreError, error: searchError, loadMore: loadMoreResults } = exploration;
  const { results, nextPageToken, pagesLoaded } = exploration.snapshot;
  const [savedKeyRows, setSavedKeyRows] = useState<SavedKeyRow[]>([]);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const saving = useRef(new Set<string>());
  const savedRead = useRef(0);
  const activeVisit = useRef(true);
  const [savedReady, setSavedReady] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [favoriteNotice, setFavoriteNotice] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  useEffect(() => { activeVisit.current = true; return () => { activeVisit.current = false; }; }, []);
  // Region selector + category subtab filter
  const [region, setRegion] = useState<string>(restored?.region ?? '全部地區');
  const [category, setCategory] = useState<string>(restored?.category ?? 'all');

  // v2.55.73: 動態細類 chip（Variant C）— 由當前結果的 Google primaryType 生成、依數量
  // 排序、帶父類三色 tone。前 INLINE_CHIP_LIMIT 個 inline，其餘進「更多」選單。
  const INLINE_CHIP_LIMIT = 4;
  const fineCategories = useMemo(() => {
    const byLabel = new Map<string, { label: string; tone: string; count: number }>();
    for (const poi of results) {
      const label = poiCategoryLabel(poi.category ?? '') ?? '其他';
      const hit = byLabel.get(label);
      if (hit) hit.count += 1;
      else byLabel.set(label, { label, tone: poiTypeToTone(mapNominatimCategory(poi.category ?? '')), count: 1 });
    }
    return Array.from(byLabel.values()).sort((a, b) => b.count - a.count);
  }, [results]);
  const inlineChips = fineCategories.slice(0, INLINE_CHIP_LIMIT);
  const overflowChips = fineCategories.slice(INLINE_CHIP_LIMIT);
  // 新搜尋後選過的細類可能已不存在 → 退回「為你推薦」，避免 filter 空畫面（衍生值，不用 effect）。
  const activeCategory =
    category === 'all' || fineCategories.some((c) => c.label === category) ? category : 'all';
  // 選中的細類若落在「更多」選單內 → summary 顯該 label 並 active（否則 row 上看不出已選）。
  const activeInOverflow = overflowChips.some((c) => c.label === activeCategory);

  const [regionInputOpen, setRegionInputOpen] = useState(false);
  // Combined option list — POPULAR + active trip's region (if not in popular)
  const regionOptions = useMemo(() => {
    const list: string[] = [...POPULAR_REGIONS];
    if (region !== '全部地區' && !list.includes(region)) {
      list.splice(1, 0, region);
    }
    return list;
  }, [region]);

  const loadSaved = useCallback(async () => {
    const generation = ++savedRead.current;
    setSavedReady(false);
    setSavedError(null);
    try {
      const rows = await apiFetch<SavedKeyRow[]>('/poi-favorites');
      if (!Array.isArray(rows) || rows.some((r) => !r || !Number.isSafeInteger(r.id) || r.id <= 0
        || !Number.isSafeInteger(r.poiId) || r.poiId <= 0)) throw new Error('Invalid favorites response');
      if (activeVisit.current && savedRead.current === generation) { setSavedKeyRows(rows); setSavedReady(true); }
      return rows;
    } catch {
      if (activeVisit.current && savedRead.current === generation) setSavedError('收藏狀態載入失敗，請重試');
      return null;
    }
  }, []);
  useEffect(() => { if (user?.id) void loadSaved(); }, [loadSaved, user?.id]);
  const favoriteKeyMap = useMemo(
    () => new Map<string, number>(savedKeyRows.flatMap((r) => r.poiPlaceId ? [[r.poiPlaceId, r.id] as const] : [])),
    [savedKeyRows],
  );

  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  async function runSearch(q: string) {
    if (q.length < 2) { showToast('至少輸入 2 個字', 'error', 2000); return; }
    setCategory('all');
    await exploration.search(q, region);
  }

  // 哨兵進入視野 → 載下一頁。deps 帶 loadMoreResults：token / 頁數變動後要重掛，
  // 否則 observer 抓著舊 closure 的 nextPageToken 會一直請求同一頁。
  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMoreResults(true);
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMoreResults, results.length, nextPageToken, pagesLoaded]);

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

  async function handleToggleFavorite(poi: PoiSearchResult, isPoiFavorited: boolean) {
    if (!savedReady || saving.current.has(poi.place_id)) return;
    saving.current.add(poi.place_id);
    setSavingIds(new Set(saving.current));
    setFavoriteError(null);
    setFavoriteNotice(null);
    try {
      if (isPoiFavorited) {
        const favoriteId = favoriteKeyMap.get(poi.place_id);
        if (favoriteId == null) throw new Error('找不到收藏，請重試收藏狀態');
        await apiFetch(`/poi-favorites/${favoriteId}`, { method: 'DELETE' });
        if (!activeVisit.current) return;
        setSavedKeyRows((rows) => rows.filter((r) => r.id !== favoriteId));
        setFavoriteNotice(`已取消收藏「${poi.name}」`);
      } else {
        const created = await apiFetch<{ id: number }>('/pois/find-or-create', {
          method: 'POST', body: JSON.stringify({ name: poi.name, type: mapNominatimCategory(poi.category ?? ''),
            lat: poi.lat, lng: poi.lng, address: poi.address ?? '', category: poi.category ?? '', source: 'user-explore', place_id: poi.place_id }),
        });
        if (!activeVisit.current) return;
        if (!Number.isSafeInteger(created?.id) || created.id <= 0) throw new Error('無法確認景點資料');
        let row: SavedKeyRow;
        try {
          row = await apiFetch<SavedKeyRow>('/poi-favorites', { method: 'POST', body: JSON.stringify({ poiId: created.id }) });
          if (!Number.isSafeInteger(row?.id) || row.id <= 0 || row.poiId !== created.id) throw new Error('無法確認收藏結果，請重試收藏狀態');
        } catch (err) {
          if (!(err instanceof ApiError) || err.status !== 409 || !activeVisit.current) throw err;
          const rows = await loadSaved();
          const existing = rows?.find((r) => r.poiId === created.id);
          if (!existing) throw err;
          row = existing;
        }
        if (!activeVisit.current) return;
        setSavedKeyRows((rows) => [...rows.filter((r) => r.id !== row.id), { ...row, poiPlaceId: poi.place_id }]);
        setFavoriteNotice(`已加入收藏「${poi.name}」`);
      }
    } catch (err) {
      if (activeVisit.current) setFavoriteError(`${isPoiFavorited ? '取消' : '加入'}收藏「${poi.name}」失敗：${err instanceof Error ? err.message : '請重試'}`);
    } finally {
      saving.current.delete(poi.place_id);
      if (activeVisit.current) setSavingIds(new Set(saving.current));
    }
  }

  const main = (
    <div className="explore-shell" ref={shellRef}>
      <style>{SCOPED_STYLES}</style>
      {/* v2.33.140: 拔 TitleBar 右上「收藏」ghost action — back ← 已回 /favorites，
          重複入口 user feedback「不需要右上角的按鈕」。 */}
      <TitleBar
        title="探索"
        back={goBack}
        backLabel="返回收藏"
        backLabelVisible
      />
      <div className="explore-wrap" data-testid="explore-page">
        <ToastContainer />
        {(savedError || favoriteError) && <div role="alert">{favoriteError || savedError}
          <button type="button" onClick={() => { setFavoriteError(null); void loadSaved(); }}>重試收藏狀態</button>
        </div>}
        {favoriteNotice && <p role="status">{favoriteNotice}</p>}
        {location.state?.notice && <p role="status">{location.state.notice}</p>}

        <>
            {/* Section 4.9：對齊 mockup section 18 (line 7298-7311) element 順序
              * → region pill → search bar → subtab chips → grid */}
            <div className="explore-region-bar">
              <div data-testid="explore-region-pill">
                <TripSelect value={region} ariaLabel="探索地區" variant="pill"
                  options={[...regionOptions.map((value) => ({ value, label: value })), { value: '__custom_region__', label: '+ 自訂地區…' }]}
                  onChange={(value) => {
                    if (value === '__custom_region__') { setRegionInputOpen(true); return; }
                    setRegion(value); setCategory('all');
                    void exploration.search(query.trim().length >= 2 ? query.trim() : value === '全部地區' ? '東京' : value, value);
                  }} />
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

            <div className="explore-subtabs" role="group" aria-label="景點類別">
              {/* v2.55.73: 動態細類 chip — 「為你推薦」永遠第一，其餘由結果 primaryType
                  生成、依數量排序、帶三色 tone。前 4 inline，長尾收進「更多」鍵盤選單。 */}
              <button
                type="button"
                aria-pressed={activeCategory === 'all'}
                className={`explore-subtab ${activeCategory === 'all' ? 'is-active' : ''}`}
                onClick={() => setCategory('all')}
                data-testid="explore-cat-all"
              >
                為你推薦
                {results.length > 0 && <span className="explore-subtab-count">{results.length}</span>}
              </button>
              {inlineChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  aria-pressed={activeCategory === chip.label}
                  className={`explore-subtab ${activeCategory === chip.label ? 'is-active' : ''}`}
                  data-tone={chip.tone}
                  onClick={() => setCategory(chip.label)}
                  data-testid={`explore-cat-${chip.label}`}
                >
                  {chip.label}
                  <span className="explore-subtab-count">{chip.count}</span>
                </button>
              ))}
              {overflowChips.length > 0 && (
                <Menu as="div" className="explore-cat-more">
                  <MenuButton
                    className={`explore-subtab explore-cat-more-summary ${activeInOverflow ? 'is-active' : ''}`}
                    data-testid="explore-cat-more"
                  >
                    {activeInOverflow ? activeCategory : '更多'}
                    <span className="explore-subtab-count">{overflowChips.length}</span>
                  </MenuButton>
                  <MenuItems className="explore-cat-menu">
                    {overflowChips.map((chip) => (
                      <MenuItem key={chip.label} as="button"
                        type="button"
                        aria-current={activeCategory === chip.label || undefined}
                        className={`explore-cat-menu-item ${activeCategory === chip.label ? 'is-active' : ''}`}
                        data-tone={chip.tone}
                        onClick={() => {
                          setCategory(chip.label);
                        }}
                        data-testid={`explore-cat-menu-${chip.label}`}
                      >
                        <span className="explore-cat-menu-dot" />
                        {chip.label}
                        <span className="explore-subtab-count">{chip.count}</span>
                      </MenuItem>
                    ))}
                  </MenuItems>
                </Menu>
              )}
            </div>

            {results.length > 0 && (() => {
              // Section 4.9：client-side category filter only。region bias 從 v2.23.4
              // 起改走 server-side locationBias circle（functions/api/poi-search.ts）—
              // address-includes 中文 city 名 client filter 對英文 address「Tokyo, Japan」
              // 永遠 mismatch，drop。
              // v2.55.73: exact 細類 label 過濾（chip label 由 poiCategoryLabel 生成，
              // 與此處同一函式 → 保證一致）。activeCategory 已防 stale label。
              const filtered =
                activeCategory === 'all'
                  ? results
                  : results.filter((p) => (poiCategoryLabel(p.category ?? '') ?? '其他') === activeCategory);
              // v2.31.55：query 空時 user 在「為你推薦」auto-seed landing，
              // header「搜尋結果」語意不對。改 conditional：query 有值 = 真正搜尋
              // → 「搜尋結果」；query 空 = landing → 「推薦景點」。對齊 add-stop /
              // change-poi page section title 同樣的 search/landing 切換邏輯。
              const sectionTitle = query.trim().length >= 2 ? '搜尋結果' : '推薦景點';
              return (
                <section className="explore-section" data-testid="explore-results">
                  <h2>{sectionTitle}</h2>
                  <p className="section-meta">
                    目前結果：{exploration.snapshot.query} · {exploration.snapshot.region} · {filtered.length} / {results.length} 個景點 · 點愛心圖示加入我的收藏
                  </p>
                  {filtered.length === 0 ? (
                    // v2.31.22: filter 0 結果 empty state — 以前是空白讓 user 迷路。
                    <div className="explore-filter-empty" data-testid="explore-filter-empty">
                      <p>沒有符合「{activeCategory}」的結果。試試其他分類或回到「為你推薦」。</p>
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
                      const key = poi.place_id;
                      const isPoiFavorited = favoriteKeyMap.has(key);
                      const isSaving = !savedReady || savingIds.has(poi.place_id);
                      return (
                        <article className="explore-poi-card" key={poi.place_id} data-tone={poiTypeToTone(mapNominatimCategory(poi.category))}>
                          {/* 裝飾 cover（純三色漸層、無語意）maintains aria-hidden。
                              interactive 按鈕移到 card 直屬（card 是 position:relative 定位脈絡，
                              位置不變）— 否則 aria-hidden 會把收藏/加入行程按鈕從 a11y tree 移除。 */}
                          <div className="explore-poi-cover" aria-hidden="true" />
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
                              const exploreVisit: ExploreVisit = { query, region, category: activeCategory, results: exploration.snapshot, scrollTop: shellRef.current?.scrollTop ?? 0 };
                              navigate('/explore', { replace: true, state: { exploreVisit } });
                              navigate(`/add-to-trip?${params.toString()}`, { state: { exploreVisit } });
                            }}
                            aria-label="加入行程"
                            title="加入行程"
                            data-testid={`explore-add-to-trip-btn-${poi.place_id}`}
                          >
                            <Icon name="plus" />
                          </button>
                          <div className="explore-poi-body">
                            {/* v2.31.20: poi.category 是 Google Places primary type
                              * (例 'ramen_restaurant')。直接 render 會顯 RAMEN_RESTAURANT
                              * raw enum；走 mapNominatimCategory → 中文 label。 */}
                            {/* v2.55.73: 顯示細類 label（拉麵/神社…）；未收錄英文則顯英文（事後補救）。 */}
                            <div className="poi-category">{poiCategoryLabel(poi.category) ?? 'POI'}</div>
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

            {/* 捲到底哨兵：進入視野就載下一頁。用 IntersectionObserver 而非 scroll
                listener —— 探索頁的捲動容器隨版面（手機整頁 / 桌機欄）不同，哨兵
                不需要知道自己在誰裡面捲。loadMoreResults 內部三道閘擋重複觸發。 */}
            {results.length > 0 && canLoadMore && (
              <div
                ref={loadMoreSentinelRef}
                className="explore-load-more"
                data-testid="explore-load-more"
                role="status"
                aria-live="polite"
              >
                {loadingMore ? '載入更多…' : <button type="button" onClick={() => void loadMoreResults()}>{moreError ? '重試載入更多' : '載入更多'}</button>}
                {moreError && <span role="alert">{moreError}</span>}
              </div>
            )}
            {results.length > 0 && !canLoadMore && (
              <div className="explore-load-more is-end" data-testid="explore-results-end">
                {nextPageToken ? `已顯示前 ${results.length} 筆結果，請縮小搜尋範圍以查看更多` : `已顯示全部 ${results.length} 筆結果`}
              </div>
            )}

            {searchError && <div role="alert">{searchError}<button type="button" onClick={() => void exploration.retry()}>重試搜尋</button></div>}
            {results.length === 0 && query && !searching && !searchError && (
              <div className="explore-empty">沒有找到「{exploration.snapshot.query}」的結果。換個關鍵字試試？</div>
            )}

            {/* 2026-04-29 (E5):landing empty state 移除,改 mount auto search
             * 帶熱門 POI grid。fallback empty state 只 fire 在 search 失敗 +
             * 沒結果情境(沒 query,results=[]),提供 chip 讓 user 重啟。 */}
            {results.length === 0 && !query && !searching && !searchError && pagesLoaded > 0 && (
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
          const value = v.trim() || '全部地區';
          setRegion(value); setCategory('all');
          void exploration.search(query.trim().length >= 2 ? query.trim() : value === '全部地區' ? '東京' : value, value);
          setRegionInputOpen(false);
        }}
        onCancel={() => setRegionInputOpen(false)}
      />
    </div>
  );

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={user ? main : <AuthStatus auth={auth} />}
      bottomNav={<GlobalBottomNav authed={user !== null} />}
    />
  );
}
