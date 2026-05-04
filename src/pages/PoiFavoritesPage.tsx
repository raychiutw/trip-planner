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
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';

interface PoiFavoriteRow {
  id: number;
  poiId: number;
  poiName: string;
  poiAddress: string | null;
  poiType: string;
  poiRegion?: string | null;
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

function deriveRegion(addr: string | null | undefined): string {
  if (!addr) return '其他';
  if (/沖縄|沖繩/i.test(addr)) return '沖繩';
  if (/京都/.test(addr)) return '京都';
  if (/大阪/.test(addr)) return '大阪';
  if (/東京/.test(addr)) return '東京';
  if (/釜山|부산/i.test(addr)) return '釜山';
  if (/首爾|서울/i.test(addr)) return '首爾';
  if (/台北/i.test(addr)) return '台北';
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
  font: inherit; font-size: 15px; color: var(--color-foreground);
  outline: none;
}
.favorites-search input::placeholder { color: var(--color-muted); }

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
.favorites-toolbar-btn {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 8px 14px; border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-accent-foreground);
  border: 1px solid var(--color-accent);
  cursor: pointer; min-height: 36px;
}
.favorites-toolbar-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.favorites-toolbar-btn-ghost {
  background: transparent; color: var(--color-foreground);
  border-color: var(--color-line-strong);
}
.favorites-toolbar-btn-destructive {
  background: transparent; color: var(--color-priority-high-dot, #c0392b);
  border-color: currentColor;
}

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

.favorites-card .poi-category {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--color-muted);
}
.favorites-card .poi-name { font-size: var(--font-size-callout); font-weight: 700; color: var(--color-foreground); }
.favorites-card .poi-address { font-size: var(--font-size-footnote); color: var(--color-muted); }
.favorites-card .poi-usage-badge {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  margin-top: 2px;
}
.favorites-card .poi-actions {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; margin-top: 6px; padding-top: 8px;
  border-top: 1px solid var(--color-border);
}
.favorites-card .poi-select-label {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: var(--font-size-footnote); color: var(--color-muted);
  cursor: pointer;
}
.favorites-card .poi-add-link {
  font-size: var(--font-size-footnote); font-weight: 700;
  color: var(--color-accent); text-decoration: none;
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
.favorites-empty-cta .empty-cta-btn {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 10px 20px; border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-accent-foreground);
  border: 1px solid var(--color-accent);
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
  background: var(--color-accent); color: var(--color-accent-foreground);
  border-color: var(--color-accent);
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
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
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

  // Drop selections that no longer exist after refetch
  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(favorites.map((s) => s.id));
      let changed = false;
      const next = new Set<number>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [favorites]);

  // Region 計數（含 "全部" = total）
  const regionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set('all', favorites.length);
    for (const row of favorites) {
      const r = row.poiRegion ?? deriveRegion(row.poiAddress);
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    return counts;
  }, [favorites]);

  const regionOptions = useMemo(() => {
    const keys = Array.from(regionCounts.keys()).filter((k) => k !== 'all');
    keys.sort((a, b) => (regionCounts.get(b) ?? 0) - (regionCounts.get(a) ?? 0));
    return keys;
  }, [regionCounts]);

  const filteredFavorites = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return favorites.filter((row) => {
      if (typeFilter !== 'all' && row.poiType !== typeFilter) return false;
      if (regionFilter !== 'all') {
        const r = row.poiRegion ?? deriveRegion(row.poiAddress);
        if (r !== regionFilter) return false;
      }
      if (!q) return true;
      const haystack = `${row.poiName} ${row.poiAddress ?? ''} ${row.note ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [favorites, searchFilter, typeFilter, regionFilter]);

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
    setDeletingIds(new Set(ids));
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
      setSelectedIds(new Set());
      await loadFavorites();
    } finally {
      setDeletingSelected(false);
      setDeletingIds(new Set());
    }
  }

  const main = (
    <div className="favorites-shell">
      <style>{SCOPED_STYLES}</style>
      <TitleBar
        title="收藏"
        actions={
          <button
            type="button"
            className="tp-titlebar-action"
            onClick={() => navigate('/explore')}
            aria-label="探索"
            title="探索"
            data-testid="favorites-explore-titlebar"
          >
            <Icon name="search" />
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
          <div className="favorites-error" data-testid="favorites-error" role="alert">
            <p className="favorites-error-title">載入收藏失敗</p>
            <p className="favorites-error-desc">資料暫時無法取得。你的內容仍在伺服器上。</p>
            <button
              type="button"
              className="favorites-error-btn"
              onClick={() => void loadFavorites()}
              data-testid="favorites-error-retry"
            >
              重試
            </button>
          </div>
        )}

        {status === 'data' && favorites.length === 0 && (
          <div className="favorites-empty-cta" data-testid="favorites-empty">
            <span className="empty-eyebrow">my favorites</span>
            <h2 className="empty-title">還沒有收藏</h2>
            <p className="favorites-count-meta">在「探索」找景點，點 heart 圖示收藏，下次行程就能直接從這裡加入。</p>
            <button
              type="button"
              className="empty-cta-btn"
              onClick={() => navigate('/explore')}
              data-testid="favorites-empty-explore"
            >
              去探索找景點
            </button>
          </div>
        )}

        {status === 'data' && favorites.length > 0 && (
          <>
            <div>
              <div className="favorites-eyebrow" data-testid="favorites-eyebrow">my favorites · 我的收藏</div>
              <p className="favorites-count-meta" data-testid="favorites-count">{favorites.length} 個收藏 POI</p>
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

            <div
              className="favorites-type-row"
              role="group"
              aria-label="POI 類型篩選"
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
                    className="favorites-toolbar-btn favorites-toolbar-btn-ghost"
                    onClick={selectAllVisible}
                    disabled={deletingSelected}
                    data-testid="favorites-select-all"
                  >
                    全選
                  </button>
                  <button
                    type="button"
                    className="favorites-toolbar-btn favorites-toolbar-btn-ghost"
                    onClick={clearSelection}
                    disabled={deletingSelected}
                    data-testid="favorites-clear-selection"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="favorites-toolbar-btn favorites-toolbar-btn-destructive"
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
                    const isDeleting = deletingIds.has(row.id);
                    const usageCount = Array.isArray(row.usages) ? row.usages.length : 0;
                    return (
                      <article
                        className={`favorites-card ${isSelected ? 'is-selected' : ''} ${isDeleting ? 'is-deleting' : ''}`}
                        key={row.id}
                        data-testid={`favorites-card-${row.id}`}
                        {...(isDeleting ? { 'aria-live': 'polite' } : {})}
                      >
                        <div className="poi-category">{row.poiType}</div>
                        <div className="poi-name">{row.poiName}</div>
                        {row.poiAddress && <div className="poi-address">{row.poiAddress}</div>}
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
        message={`即將刪除 ${selectedIds.size} 個收藏 POI，此操作無法復原。`}
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
      bottomNav={<GlobalBottomNav authed={!!user} />}
    />
  );
}
