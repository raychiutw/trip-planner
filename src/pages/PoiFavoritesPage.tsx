/**
 * PoiFavoritesPage — V2 「收藏」 primary nav (v2.21.0)
 *
 * mockup-driven hard gate aligned (docs/design-sessions/2026-05-04-favorites-redesign.html v4，
 * user sign-off 2026-05-04)。對齊 DESIGN.md L623-665 規範：
 *   - TitleBar title「收藏」（統一 nav label，ownership 由 hero eyebrow 補）
 *   - 8-state matrix: loading / empty-pool / filter-no-results / error / data /
 *                     optimistic-delete / bulk-action-busy / pagination
 *   - region pill row + type filter row：role="group" + aria-pressed (NOT tablist)
 *   - batch flow delete-only (DUC1 sign-off)：toolbar 只「全選 / 取消 / 刪除」，
 *     per-card「加入行程 →」link 為唯一 add-to-trip 入口
 *   - viewport breakpoints: ≥1024 3-col / 640-1023 2-col / <430 1-col
 *   - a11y: aria-pressed / aria-label per row checkbox / aria-live on optimistic
 *
 * 不含原 ExplorePage 的 search/region/heart toggle — 那些留在 /explore。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import Icon from '../components/shared/Icon';
import ToastContainer, { showToast } from '../components/shared/Toast';
import ConfirmModal from '../components/shared/ConfirmModal';
import PageErrorState from '../components/shared/PageErrorState';
import EmptyState from '../components/shared/EmptyState';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import AccountCircle from '../components/shell/AccountCircle';
import { POI_TYPE_LABELS, mapNominatimCategory } from '../lib/poiCategory';
import { poiTypeToTone } from '../lib/timelineUtils';

interface PoiFavoriteRow {
  id: number;
  poiId: number;
  poiName: string;
  poiAddress: string | null;
  poiType: string;
  /** v2.31.19: Google rating（pois.rating，1.0-5.0）。backend 已 SELECT。 */
  poiRating?: number | null;
  favoritedAt: string;
  note: string | null;
  usages?: Array<{
    tripId: string;
    tripName: string;
    dayNum: number | null;
    dayDate: string | null;
    entryId: number | null;
  }>;
}

const TYPE_FILTER_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'restaurant', label: '餐廳' },
  { key: 'attraction', label: '景點' },
  { key: 'shopping', label: '購物' },
  { key: 'hotel', label: '住宿' },
] as const;

type LoadStatus = 'loading' | 'data' | 'error';

const PAGE_SIZE = 24;
const PAGINATION_THRESHOLD = 200;

const REGIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/沖縄|沖繩/i, '沖繩'],
  [/京都/, '京都'],
  [/大阪/, '大阪'],
  [/東京/, '東京'],
  [/釜山|부산/i, '釜山'],
  [/首爾|서울/i, '首爾'],
  [/台北/i, '台北'],
];

function deriveRegion(addr: string | null | undefined): string {
  if (!addr) return '其他';
  for (const [re, name] of REGIONS) {
    if (re.test(addr)) return name;
  }
  return '其他';
}

const SCOPED_STYLES = `
.favorites-shell { background: var(--color-secondary); height: 100%; overflow-y: auto; }
.favorites-wrap {
  padding: 24px 24px 64px;
  max-width: 1040px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 16px;
  color: var(--color-foreground);
}
@media (max-width: 1023px) { .favorites-wrap { padding: 16px 16px 32px; gap: 12px; } }

.favorites-eyebrow {
  font-size: var(--font-size-eyebrow);
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-muted);
}
.favorites-count-meta {
  color: var(--color-muted); margin: 0;
  font-size: var(--font-size-footnote);
  font-variant-numeric: tabular-nums;
}

.favorites-search {
  display: flex; align-items: center; gap: 8px;
  background: var(--color-background);
  border: 1px solid var(--color-border); border-radius: var(--radius-full);
  padding: 8px 16px; min-height: 44px;
}
.favorites-search:focus-within { border-color: var(--color-accent); }
.favorites-search .search-icon { width: 18px; height: 18px; color: var(--color-muted); flex-shrink: 0; }
.favorites-search input {
  flex: 1; border: none; background: transparent;
  font: inherit; font-size: var(--font-size-subheadline); color: var(--color-foreground);
  outline: none;
}
.favorites-search input::placeholder { color: var(--color-muted); }
/* iOS Safari 對 input font-size < 16px 自動 zoom 破版；mobile 用 16px 防 zoom，desktop 維持 15px */
@media (max-width: 760px) {
  .favorites-search input { font-size: var(--font-size-body); }
}

.favorites-region-row,
.favorites-type-row {
  display: flex; flex-wrap: wrap; gap: 8px;
}
.favorites-chip {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 6px 14px; border-radius: var(--radius-full);
  background: var(--color-secondary); color: var(--color-muted);
  border: 1px solid var(--color-border);
  cursor: pointer;
  min-height: 36px;
  display: inline-flex; align-items: center; gap: 6px;
  transition: background 120ms, color 120ms, border-color 120ms;
}
.favorites-chip:hover { background: var(--color-tertiary); color: var(--color-foreground); }
.favorites-chip[aria-pressed="true"] {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  border-color: var(--color-accent-bg);
}
.favorites-chip-count {
  font-variant-numeric: tabular-nums;
  font-weight: 600; color: var(--color-muted); opacity: 0.85;
}

.favorites-toolbar {
  position: sticky; bottom: 0; z-index: 5;
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: space-between;
  padding: 10px 14px; border-radius: var(--radius-md);
  background: var(--color-accent-subtle); border: 1px solid var(--color-accent-bg);
}
.favorites-toolbar-actions { display: flex; gap: 8px; flex-wrap: wrap; }
/* button visual treatment 由 .tp-action-btn / --ghost / --destructive 提供 (css/tokens.css) */

.favorites-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
}
@media (max-width: 1023px) and (min-width: 640px) { .favorites-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
@media (max-width: 639px) { .favorites-grid { grid-template-columns: 1fr; gap: 12px; } }

.favorites-card {
  background: var(--color-background);
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  padding: 14px;
  display: flex; flex-direction: column; gap: 6px;
  transition: opacity 200ms, border-color 120ms;
}
.favorites-card.is-selected { border-color: var(--color-accent); background: var(--color-accent-subtle); }
.favorites-card.is-deleting { opacity: 0.5; pointer-events: none; }

/* 三色：收藏卡依 POI 類型上同色系淡底（玩/看/買=柔褐、住/移動=sage、吃=粉）*/
.favorites-card[data-tone="accent"] { --tone-deep: var(--color-accent-deep); --tone-subtle: var(--color-accent-subtle); --tone-bg: var(--color-accent-bg); }
.favorites-card[data-tone="sage"]   { --tone-deep: var(--color-accent-2-deep); --tone-subtle: var(--color-accent-2-subtle); --tone-bg: var(--color-accent-2-bg); }
.favorites-card[data-tone="pink"]   { --tone-deep: var(--color-accent-3-deep); --tone-subtle: var(--color-accent-3-subtle); --tone-bg: var(--color-accent-3-bg); }
.favorites-card[data-tone="accent"]:not(.is-selected),
.favorites-card[data-tone="sage"]:not(.is-selected),
.favorites-card[data-tone="pink"]:not(.is-selected) { background: var(--tone-subtle); border-color: var(--tone-bg); }

.favorites-card .poi-category {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--tone-deep, var(--color-muted));
}
.favorites-card .poi-name { font-size: var(--font-size-callout); font-weight: 700; color: var(--color-foreground); }
.favorites-card .poi-address { font-size: var(--font-size-footnote); color: var(--color-muted); }
.favorites-card .poi-rating { color: var(--color-accent); font-weight: 600; }
.favorites-card .poi-meta-sep { color: var(--color-muted); }
.favorites-card .poi-usage-badge {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  margin-top: 2px;
}
.favorites-card .poi-actions {
  display: flex; align-items: center; justify-content: space-between;
  /* §8.3：grid 卡等高（align-items:stretch）但動作列原只 margin-top:6px 跟著內容 →
   * 內容少的卡動作列浮在中段、跨卡參差。改 margin-top:auto 把動作列 pin 到卡底，
   * 使一排卡的「加入行程 / 勾選」對齊同一水平線。 */
  gap: 8px; margin-top: auto; padding-top: 8px;
  border-top: 1px solid var(--color-border);
}
.favorites-card .poi-select-label {
  display: inline-flex; align-items: center; gap: 6px;
  /* §9.2：label 是實際點擊區（含 checkbox + 文字），原僅 ~20px 高 → 保底 44pt 觸控。 */
  min-height: var(--spacing-tap-min);
  font-size: var(--font-size-footnote); color: var(--color-muted);
  cursor: pointer;
}
.favorites-card .poi-add-link {
  font-size: var(--font-size-footnote); font-weight: 700;
  color: var(--color-accent-text); text-decoration: none;
  padding: 6px 10px; border-radius: var(--radius-sm);
  transition: background 120ms;
}
.favorites-card .poi-add-link:hover { background: var(--color-accent-subtle); }
.favorites-card .poi-deleting-label {
  font-size: var(--font-size-footnote); color: var(--color-muted); font-style: italic;
}

.favorites-empty-cta {
  padding: 48px 24px;
  background: var(--color-background);
  border: 1px dashed var(--color-line-strong);
  border-radius: var(--radius-lg);
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.favorites-empty-cta .empty-eyebrow {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--color-muted);
}
.favorites-empty-cta .empty-title {
  margin: 0; font-size: var(--font-size-title3); font-weight: 800;
  color: var(--color-foreground);
}
.favorites-empty-cta .empty-message {
  margin: 0; color: var(--color-muted); font-size: var(--font-size-footnote);
}
.favorites-empty-cta .empty-cta-btn {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 10px 20px; border-radius: var(--radius-full);
  background: var(--color-accent-fill); color: var(--color-accent-foreground);
  border: 1px solid var(--color-accent-fill);
  cursor: pointer; min-height: var(--spacing-tap-min);
  text-decoration: none; display: inline-block;
}

.favorites-error {
  padding: 32px 24px; background: var(--color-background);
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.favorites-error-title { font-weight: 700; color: var(--color-foreground); }
.favorites-error-desc { color: var(--color-muted); font-size: var(--font-size-footnote); }
.favorites-error-btn {
  font: inherit; font-weight: 600; padding: 8px 16px;
  border-radius: var(--radius-full); border: 1px solid var(--color-border);
  background: var(--color-secondary); cursor: pointer; min-height: 36px;
}

.favorites-skeleton-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
@media (max-width: 1023px) and (min-width: 640px) { .favorites-skeleton-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
@media (max-width: 639px) { .favorites-skeleton-grid { grid-template-columns: 1fr; gap: 12px; } }
.favorites-skeleton-card {
  height: 140px; border-radius: var(--radius-md);
  background: linear-gradient(90deg, var(--color-secondary) 0%, var(--color-tertiary) 50%, var(--color-secondary) 100%);
  background-size: 200% 100%;
  animation: tp-skel-shimmer 1.4s linear infinite;
}
@keyframes tp-skel-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
@media (prefers-reduced-motion: reduce) {
  .favorites-skeleton-card { animation: none; background: var(--color-secondary); }
}

.favorites-no-match {
  padding: 24px; background: var(--color-background);
  border: 1px dashed var(--color-border); border-radius: var(--radius-md);
  text-align: center; color: var(--color-muted); font-size: var(--font-size-footnote);
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.favorites-no-match-clear {
  font: inherit; font-weight: 600;
  padding: 6px 14px; border-radius: var(--radius-full);
  background: transparent; color: var(--color-foreground);
  border: 1px solid var(--color-line-strong); cursor: pointer; min-height: 36px;
}

.favorites-pagination {
  display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 12px;
}
.favorites-pagination-btn {
  font: inherit; font-variant-numeric: tabular-nums;
  min-width: 36px; min-height: 36px;
  padding: 6px 10px; border-radius: var(--radius-md);
  background: var(--color-background); color: var(--color-foreground);
  border: 1px solid var(--color-border); cursor: pointer;
}
.favorites-pagination-btn[aria-current="page"] {
  background: var(--color-accent-fill); color: var(--color-accent-foreground);
  border-color: var(--color-accent-fill);
}
.favorites-pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }
`;

export default function PoiFavoritesPage() {
  useRequireAuth();
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  const [favorites, setFavorites] = useState<PoiFavoriteRow[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const loadFavorites = useCallback(async () => {
    setStatus('loading');
    try {
      const rows = await apiFetch<PoiFavoriteRow[]>('/poi-favorites');
      setFavorites(rows);
      setStatus('data');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PoiFavoritesPage] load failed', err);
      setStatus('error');
    }
  }, []);

  useEffect(() => { void loadFavorites(); }, [loadFavorites]);

  // Region 計數（含 "全部" = total）— 從 poiAddress derive（server 無 region field）
  const regionByRow = useMemo(
    () => new Map(favorites.map((row) => [row.id, deriveRegion(row.poiAddress)] as const)),
    [favorites],
  );

  const regionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set('all', favorites.length);
    for (const region of regionByRow.values()) {
      counts.set(region, (counts.get(region) ?? 0) + 1);
    }
    return counts;
  }, [regionByRow, favorites.length]);

  const regionOptions = useMemo(() => {
    const keys = Array.from(regionCounts.keys()).filter((k) => k !== 'all');
    keys.sort((a, b) => (regionCounts.get(b) ?? 0) - (regionCounts.get(a) ?? 0));
    return keys;
  }, [regionCounts]);

  const filteredFavorites = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return favorites.filter((row) => {
      if (typeFilter !== 'all' && row.poiType !== typeFilter) return false;
      if (regionFilter !== 'all' && regionByRow.get(row.id) !== regionFilter) return false;
      if (!q) return true;
      const haystack = `${row.poiName} ${row.poiAddress ?? ''} ${row.note ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [favorites, searchFilter, typeFilter, regionFilter, regionByRow]);

  const usePagination = favorites.length >= PAGINATION_THRESHOLD;
  const totalPages = usePagination ? Math.max(1, Math.ceil(filteredFavorites.length / PAGE_SIZE)) : 1;
  const visibleFavorites = useMemo(() => {
    if (!usePagination) return filteredFavorites;
    const start = (page - 1) * PAGE_SIZE;
    return filteredFavorites.slice(start, start + PAGE_SIZE);
  }, [filteredFavorites, usePagination, page]);

  // 切換 filter / search 時重置 page
  useEffect(() => { setPage(1); }, [searchFilter, typeFilter, regionFilter]);

  function toggleSelection(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }
  function selectAllVisible() {
    setSelectedIds(new Set(visibleFavorites.map((r) => r.id)));
  }
  function clearAllFilters() {
    setSearchFilter('');
    setTypeFilter('all');
    setRegionFilter('all');
  }

  function requestDeleteSelected() {
    if (selectedIds.size === 0) return;
    setDeleteConfirmOpen(true);
  }
  async function handleDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setDeleteConfirmOpen(false);
    setDeletingSelected(true);
    try {
      const results = await Promise.all(
        ids.map((id) =>
          apiFetch(`/poi-favorites/${id}`, { method: 'DELETE' })
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
        showToast('刪除失敗，請稍後再試', 'error', 3000);
      }
      await loadFavorites();
    } finally {
      setSelectedIds(new Set());
      setDeletingSelected(false);
    }
  }

  const main = (
    <div className="favorites-shell">
      <style>{SCOPED_STYLES}</style>
      <TitleBar
        title="收藏"
        account={<AccountCircle />}
        actions={
          <button
            type="button"
            className="tp-titlebar-action"
            onClick={() => navigate('/explore')}
            aria-label="探索"
            title="探索"
            data-testid="favorites-explore-titlebar"
          >
            {/* §6b：原用 search 放大鏡 icon 與頁內搜尋列放大鏡撞（像兩個搜尋）。改
                sidebar-explore（探索語意），消除重複、與頁內 .favorites-search 區隔。 */}
            <Icon name="sidebar-explore" />
            <span className="tp-titlebar-action-label">探索</span>
          </button>
        }
      />
      <div className="favorites-wrap" data-testid="favorites-page">
        <ToastContainer />

        {status === 'loading' && (
          <div
            className="favorites-skeleton-grid"
            data-testid="favorites-loading"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="favorites-skeleton-card" />
            <div className="favorites-skeleton-card" />
            <div className="favorites-skeleton-card" />
          </div>
        )}

        {status === 'error' && (
          <PageErrorState
            title="載入收藏失敗"
            message="資料暫時無法取得。你的內容仍在伺服器上。"
            onRetry={() => void loadFavorites()}
            className="favorites-error"
            testId="favorites-error"
            retryTestId="favorites-error-retry"
          />
        )}

        {status === 'data' && favorites.length === 0 && (
          <EmptyState
            eyebrow="我的收藏"
            title="還沒有收藏"
            message="在「探索」找景點，點愛心圖示收藏，下次行程就能直接從這裡加入。"
            ctaLabel="去探索找景點"
            onCta={() => navigate('/explore')}
            className="favorites-empty-cta"
            testId="favorites-empty"
            ctaTestId="favorites-empty-explore"
          />
        )}

        {status === 'data' && favorites.length > 0 && (
          <>
            <div>
              <div className="favorites-eyebrow" data-testid="favorites-eyebrow">我的收藏</div>
              <p className="favorites-count-meta" data-testid="favorites-count">{favorites.length} 個收藏景點</p>
            </div>

            <div className="favorites-search">
              <span className="search-icon"><Icon name="search" /></span>
              <input
                type="search"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="搜尋收藏（名稱 / 地址 / 備註）"
                data-testid="favorites-search-input"
                aria-label="搜尋收藏"
              />
            </div>

            {/* v2.31.32: 只有 1 region group 時「全部 N / {region} N」count 完全等價，
                UI 多餘。≥2 group 才顯 row（有實際 filter 意義）。 */}
            {regionOptions.length >= 2 && (
              <div
                className="favorites-region-row"
                role="group"
                aria-label="地區篩選"
                data-testid="favorites-region-row"
              >
                <button
                  type="button"
                  className="favorites-chip"
                  aria-pressed={regionFilter === 'all'}
                  onClick={() => setRegionFilter('all')}
                  data-testid="favorites-region-all"
                >
                  全部 <span className="favorites-chip-count">{regionCounts.get('all') ?? 0}</span>
                </button>
                {regionOptions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="favorites-chip"
                    aria-pressed={regionFilter === r}
                    onClick={() => setRegionFilter(r)}
                    data-testid={`favorites-region-${r}`}
                  >
                    {r} <span className="favorites-chip-count">{regionCounts.get(r) ?? 0}</span>
                  </button>
                ))}
              </div>
            )}

            <div
              className="favorites-type-row"
              role="group"
              aria-label="景點類型篩選"
              data-testid="favorites-type-row"
            >
              {TYPE_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className="favorites-chip"
                  aria-pressed={typeFilter === opt.key}
                  onClick={() => setTypeFilter(opt.key)}
                  data-testid={`favorites-type-${opt.key}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {selectedIds.size > 0 && (
              <div
                className="favorites-toolbar"
                role="region"
                aria-label="批次操作"
                data-testid="favorites-toolbar"
              >
                <span>已選 {selectedIds.size} 個</span>
                <div className="favorites-toolbar-actions">
                  <button
                    type="button"
                    className="tp-action-btn tp-action-btn--ghost"
                    onClick={selectAllVisible}
                    disabled={deletingSelected}
                    data-testid="favorites-select-all"
                  >
                    全選
                  </button>
                  <button
                    type="button"
                    className="tp-action-btn tp-action-btn--ghost"
                    onClick={clearSelection}
                    disabled={deletingSelected}
                    data-testid="favorites-clear-selection"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="tp-action-btn tp-action-btn--destructive"
                    onClick={requestDeleteSelected}
                    disabled={deletingSelected}
                    data-testid="favorites-delete-selected"
                  >
                    {deletingSelected ? '刪除中…' : '刪除'}
                  </button>
                </div>
              </div>
            )}

            {filteredFavorites.length === 0 ? (
              <div className="favorites-no-match" data-testid="favorites-no-match">
                <span>目前的篩選沒有符合的收藏</span>
                <button
                  type="button"
                  className="favorites-no-match-clear"
                  onClick={clearAllFilters}
                  data-testid="favorites-clear-filters"
                >
                  清除篩選
                </button>
              </div>
            ) : (
              <>
                <div className="favorites-grid">
                  {visibleFavorites.map((row) => {
                    const isSelected = selectedIds.has(row.id);
                    const isDeleting = deletingSelected && isSelected;
                    const usageCount = Array.isArray(row.usages) ? row.usages.length : 0;
                    return (
                      <article
                        className={`favorites-card ${isSelected ? 'is-selected' : ''} ${isDeleting ? 'is-deleting' : ''}`}
                        key={row.id}
                        data-tone={poiTypeToTone(mapNominatimCategory(row.poiType))}
                        data-testid={`favorites-card-${row.id}`}
                        {...(isDeleting ? { 'aria-live': 'polite' } : {})}
                      >
                        <div className="poi-category">{POI_TYPE_LABELS[mapNominatimCategory(row.poiType)] ?? '景點'}</div>
                        <div className="poi-name">{row.poiName}</div>
                        {/* v2.31.19: backend poi-favorites SELECT 已含 rating（v2.31.17 補），
                          * card 跟 add-stop / change-poi favorites card 一致顯 ★ N.N · address。 */}
                        {(row.poiAddress || typeof row.poiRating === 'number') && (
                          <div className="poi-address">
                            {typeof row.poiRating === 'number' && (
                              <>
                                <span className="poi-rating">★ {row.poiRating.toFixed(1)}</span>
                                {row.poiAddress && <span className="poi-meta-sep"> · </span>}
                              </>
                            )}
                            {row.poiAddress}
                          </div>
                        )}
                        {usageCount > 0 && (
                          <div className="poi-usage-badge" data-testid={`favorites-usage-badge-${row.id}`}>
                            目前在 {usageCount} 個行程
                          </div>
                        )}
                        <div className="poi-actions">
                          {isDeleting ? (
                            <span className="poi-deleting-label">移除中…</span>
                          ) : (
                            <>
                              <label className="poi-select-label">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelection(row.id)}
                                  data-testid={`favorites-check-${row.id}`}
                                  aria-label={`選取 ${row.poiName} 收藏`}
                                />
                                <span>{isSelected ? '已選' : '選取'}</span>
                              </label>
                              <a
                                href={`/favorites/${row.id}/add-to-trip`}
                                className="poi-add-link"
                                data-testid={`favorites-add-to-trip-${row.id}`}
                              >
                                加入行程 →
                              </a>
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {usePagination && (
                  <nav
                    className="favorites-pagination"
                    aria-label="分頁"
                    data-testid="favorites-pagination"
                  >
                    <button
                      type="button"
                      className="favorites-pagination-btn"
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label="上一頁"
                    >
                      ←
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 8).map((n) => (
                      <button
                        key={n}
                        type="button"
                        className="favorites-pagination-btn"
                        aria-current={page === n ? 'page' : undefined}
                        onClick={() => setPage(n)}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="favorites-pagination-btn"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      aria-label="下一頁"
                    >
                      →
                    </button>
                  </nav>
                )}
              </>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        open={deleteConfirmOpen}
        title="確定刪除收藏？"
        message={`即將刪除 ${selectedIds.size} 個收藏景點，此操作無法復原。`}
        confirmLabel="刪除"
        busy={deletingSelected}
        onConfirm={handleDeleteSelected}
        onCancel={() => setDeleteConfirmOpen(false)}
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
