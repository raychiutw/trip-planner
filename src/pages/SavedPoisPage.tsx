/**
 * SavedPoisPage — V2 「我的收藏」 primary nav page (v2.21.0)
 *
 * 從 ExplorePage saved-tab 抽出升 top-level route /saved。提供：
 *  - 5-state matrix: loading skeleton / empty CTA / error PageErrorState / data / optimistic-delete
 *  - search-within-saved (client-side filter)
 *  - 篩選 chip row (POI type)
 *  - 多選 + 批次刪除 (ConfirmModal)
 *  - 「加入行程 →」link → /saved-pois/:id/add-to-trip
 *  - TitleBar 右上 secondary action「探索」(ghost) → navigate /explore
 *
 * 不含原 ExplorePage 的 search/region/heart toggle — 那些留在 /explore。
 *
 * Reference: DESIGN.md L562-624 (V2 Owner Cutover saved_pois universal pool spec)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import Icon from '../components/shared/Icon';
import ToastContainer, { showToast } from '../components/shared/Toast';
import ConfirmModal from '../components/shared/ConfirmModal';
import TripPickerPopover from '../components/explore/TripPickerPopover';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';

interface SavedPoiRow {
  id: number;
  poiId: number;
  poiName: string;
  poiAddress: string | null;
  poiType: string;
  savedAt: string;
  note: string | null;
  usages?: Array<{
    tripId: string;
    tripName: string;
    dayNum: number | null;
    dayDate: string | null;
    entryId: number | null;
  }>;
}

interface TripPickerRow {
  tripId: string;
  name?: string;
  title?: string | null;
  countries?: string | null;
}

const TYPE_FILTER_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'restaurant', label: '餐廳' },
  { key: 'attraction', label: '景點' },
  { key: 'shopping', label: '購物' },
  { key: 'hotel', label: '住宿' },
] as const;

type LoadStatus = 'loading' | 'data' | 'error';

const SCOPED_STYLES = `
.saved-shell { background: var(--color-secondary); height: 100%; overflow-y: auto; }
.saved-wrap {
  padding: 24px 24px 64px;
  max-width: 960px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 16px;
  color: var(--color-foreground);
}
@media (max-width: 760px) { .saved-wrap { padding: 16px 16px 32px; gap: 12px; } }

.saved-eyebrow {
  font-size: var(--font-size-eyebrow);
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-muted);
}
.saved-count-meta { color: var(--color-muted); margin: 0; font-size: var(--font-size-footnote); }

.saved-search {
  display: flex; align-items: center; gap: 8px;
  background: var(--color-background);
  border: 1px solid var(--color-border); border-radius: var(--radius-full);
  padding: 8px 16px; min-height: 44px;
}
.saved-search:focus-within { border-color: var(--color-accent); }
.saved-search .search-icon { width: 18px; height: 18px; color: var(--color-muted); flex-shrink: 0; }
.saved-search input {
  flex: 1; border: none; background: transparent;
  font: inherit; font-size: 15px; color: var(--color-foreground);
  outline: none;
}
.saved-search input::placeholder { color: var(--color-muted); }

.saved-filters {
  display: flex; flex-wrap: wrap; gap: 8px;
}
.saved-filter-chip {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 6px 14px; border-radius: var(--radius-full);
  background: var(--color-secondary); color: var(--color-muted);
  border: 1px solid var(--color-border);
  cursor: pointer;
  min-height: 36px;
  transition: background 120ms, color 120ms, border-color 120ms;
}
.saved-filter-chip:hover { background: var(--color-tertiary); color: var(--color-foreground); }
.saved-filter-chip.is-active {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  border-color: var(--color-accent-bg);
}

.saved-toolbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: space-between;
  padding: 10px 14px; border-radius: var(--radius-md);
  background: var(--color-accent-subtle); border: 1px solid var(--color-accent-bg);
}
.saved-toolbar-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.saved-toolbar-btn {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 8px 14px; border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-accent-foreground);
  border: 1px solid var(--color-accent);
  cursor: pointer; min-height: 36px;
}
.saved-toolbar-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.saved-toolbar-btn-ghost {
  background: transparent; color: var(--color-foreground);
  border-color: var(--color-line-strong);
}
.saved-toolbar-btn-destructive {
  background: transparent; color: var(--color-priority-high-dot, #c0392b);
  border-color: currentColor;
}

.saved-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
}
@media (max-width: 760px) { .saved-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } }

.saved-card {
  background: var(--color-background);
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  padding: 14px;
  display: flex; flex-direction: column; gap: 6px;
  transition: opacity 200ms, border-color 120ms;
}
.saved-card.is-selected { border-color: var(--color-accent); background: var(--color-accent-subtle); }
.saved-card.is-deleting { opacity: 0.5; pointer-events: none; }

.saved-card .poi-category {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--color-muted);
}
.saved-card .poi-name { font-size: var(--font-size-callout); font-weight: 700; color: var(--color-foreground); }
.saved-card .poi-address { font-size: var(--font-size-footnote); color: var(--color-muted); }
.saved-card .poi-usage-badge {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  margin-top: 2px;
}
.saved-card .poi-actions {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; margin-top: 6px; padding-top: 8px;
  border-top: 1px solid var(--color-border);
}
.saved-card .poi-select-label {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: var(--font-size-footnote); color: var(--color-muted);
  cursor: pointer;
}
.saved-card .poi-add-link {
  font-size: var(--font-size-footnote); font-weight: 700;
  color: var(--color-accent); text-decoration: none;
  padding: 6px 10px; border-radius: var(--radius-sm);
  transition: background 120ms;
}
.saved-card .poi-add-link:hover { background: var(--color-accent-subtle); }
.saved-card .poi-deleting-label {
  font-size: var(--font-size-footnote); color: var(--color-muted); font-style: italic;
}

.saved-empty-cta {
  padding: 48px 24px;
  background: var(--color-background);
  border: 1px dashed var(--color-line-strong);
  border-radius: var(--radius-lg);
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.saved-empty-cta .empty-eyebrow {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--color-muted);
}
.saved-empty-cta .empty-title {
  margin: 0; font-size: var(--font-size-title3); font-weight: 800;
  color: var(--color-foreground);
}
.saved-empty-cta .empty-cta-btn {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 10px 20px; border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-accent-foreground);
  border: 1px solid var(--color-accent);
  cursor: pointer; min-height: var(--spacing-tap-min);
  text-decoration: none; display: inline-block;
}

.saved-error {
  padding: 32px 24px; background: var(--color-background);
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.saved-error-title { font-weight: 700; color: var(--color-foreground); }
.saved-error-desc { color: var(--color-muted); font-size: var(--font-size-footnote); }
.saved-error-btn {
  font: inherit; font-weight: 600; padding: 8px 16px;
  border-radius: var(--radius-full); border: 1px solid var(--color-border);
  background: var(--color-secondary); cursor: pointer; min-height: 36px;
}

.saved-skeleton-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
@media (max-width: 760px) { .saved-skeleton-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
.saved-skeleton-card {
  height: 140px; border-radius: var(--radius-md);
  background: linear-gradient(90deg, var(--color-secondary) 0%, var(--color-tertiary) 50%, var(--color-secondary) 100%);
  background-size: 200% 100%;
  animation: tp-skel-shimmer 1.4s linear infinite;
}
@keyframes tp-skel-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
@media (prefers-reduced-motion: reduce) {
  .saved-skeleton-card { animation: none; background: var(--color-secondary); }
}

.saved-no-match {
  padding: 24px; background: var(--color-background);
  border: 1px dashed var(--color-border); border-radius: var(--radius-md);
  text-align: center; color: var(--color-muted); font-size: var(--font-size-footnote);
}
`;

export default function SavedPoisPage() {
  useRequireAuth();
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  const [saved, setSaved] = useState<SavedPoiRow[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [showTripPicker, setShowTripPicker] = useState(false);
  const [trips, setTrips] = useState<TripPickerRow[] | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const loadSaved = useCallback(async () => {
    setStatus('loading');
    try {
      const rows = await apiFetch<SavedPoiRow[]>('/saved-pois');
      setSaved(rows);
      setStatus('data');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[SavedPoisPage] load failed', err);
      setStatus('error');
    }
  }, []);

  useEffect(() => { void loadSaved(); }, [loadSaved]);

  // Drop selections that no longer exist after refetch
  useEffect(() => {
    setSelectedIds((prev) => {
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

  const filteredSaved = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return saved.filter((row) => {
      if (typeFilter !== 'all' && row.poiType !== typeFilter) return false;
      if (!q) return true;
      const haystack = `${row.poiName} ${row.poiAddress ?? ''} ${row.note ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [saved, searchFilter, typeFilter]);

  function toggleSelection(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }

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
        showToast('刪除失敗，請稍後再試', 'error', 3000);
      }
      setSelectedIds(new Set());
      await loadSaved();
    } finally {
      setDeletingSelected(false);
      setDeletingIds(new Set());
    }
  }

  async function openTripPicker() {
    if (selectedIds.size === 0) return;
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
    const count = selectedIds.size;
    showToast(
      `已選 ${count} 個 POI 加入「${tripId}」（待 entry POST API 接通）`,
      'success',
      2400,
    );
    setSelectedIds(new Set());
    navigate(`/trips?selected=${encodeURIComponent(tripId)}`);
  }

  const main = (
    <div className="saved-shell">
      <style>{SCOPED_STYLES}</style>
      <TitleBar
        title="我的收藏"
        actions={
          <button
            type="button"
            className="tp-titlebar-action"
            onClick={() => navigate('/explore')}
            aria-label="探索"
            title="探索"
            data-testid="saved-explore-titlebar"
          >
            <Icon name="search" />
            <span className="tp-titlebar-action-label">探索</span>
          </button>
        }
      />
      <div className="saved-wrap" data-testid="saved-page">
        <ToastContainer />

        {status === 'loading' && (
          <div className="saved-skeleton-grid" data-testid="saved-loading">
            <div className="saved-skeleton-card" />
            <div className="saved-skeleton-card" />
            <div className="saved-skeleton-card" />
          </div>
        )}

        {status === 'error' && (
          <div className="saved-error" data-testid="saved-error" role="alert">
            <p className="saved-error-title">載入收藏失敗</p>
            <p className="saved-error-desc">資料暫時無法取得。你的內容仍在伺服器上。</p>
            <button
              type="button"
              className="saved-error-btn"
              onClick={() => void loadSaved()}
              data-testid="saved-error-retry"
            >
              重試
            </button>
          </div>
        )}

        {status === 'data' && saved.length === 0 && (
          <div className="saved-empty-cta" data-testid="saved-empty">
            <span className="empty-eyebrow">my saved</span>
            <h2 className="empty-title">還沒有收藏</h2>
            <p className="saved-count-meta">在「探索」找景點，點 heart 圖示收藏，下次行程就能直接從這裡加入。</p>
            <button
              type="button"
              className="empty-cta-btn"
              onClick={() => navigate('/explore')}
              data-testid="saved-empty-explore"
            >
              去探索找景點
            </button>
          </div>
        )}

        {status === 'data' && saved.length > 0 && (
          <>
            <div>
              <div className="saved-eyebrow">my saved</div>
              <p className="saved-count-meta" data-testid="saved-count">{saved.length} 個收藏 POI</p>
            </div>

            <div className="saved-search">
              <span className="search-icon"><Icon name="search" /></span>
              <input
                type="search"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="搜尋收藏（名稱 / 地址 / 備註）"
                data-testid="saved-search-input"
                aria-label="搜尋收藏"
              />
            </div>

            <div className="saved-filters" role="tablist" aria-label="POI 類型篩選">
              {TYPE_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === opt.key}
                  className={`saved-filter-chip ${typeFilter === opt.key ? 'is-active' : ''}`}
                  onClick={() => setTypeFilter(opt.key)}
                  data-testid={`saved-filter-${opt.key}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {selectedIds.size > 0 && (
              <div className="saved-toolbar" data-testid="saved-toolbar">
                <span>已選 {selectedIds.size} 個</span>
                <div className="saved-toolbar-actions">
                  <button
                    type="button"
                    className="saved-toolbar-btn saved-toolbar-btn-ghost"
                    onClick={clearSelection}
                    disabled={deletingSelected}
                    data-testid="saved-clear-selection"
                  >
                    取消選擇
                  </button>
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="saved-toolbar-btn"
                      onClick={openTripPicker}
                      disabled={deletingSelected}
                      data-testid="saved-add-to-trip"
                      aria-haspopup="dialog"
                      aria-expanded={showTripPicker}
                    >
                      加入行程
                    </button>
                    <TripPickerPopover
                      open={showTripPicker}
                      trips={trips}
                      selectedCount={selectedIds.size}
                      onPick={pickTrip}
                      onClose={() => setShowTripPicker(false)}
                    />
                  </div>
                  <button
                    type="button"
                    className="saved-toolbar-btn saved-toolbar-btn-destructive"
                    onClick={requestDeleteSelected}
                    disabled={deletingSelected}
                    data-testid="saved-delete-selected"
                  >
                    {deletingSelected ? '刪除中…' : '刪除'}
                  </button>
                </div>
              </div>
            )}

            {filteredSaved.length === 0 ? (
              <div className="saved-no-match" data-testid="saved-no-match">
                沒有符合條件的收藏。試試清空搜尋或切換類型。
              </div>
            ) : (
              <div className="saved-grid">
                {filteredSaved.map((row) => {
                  const isSelected = selectedIds.has(row.id);
                  const isDeleting = deletingIds.has(row.id);
                  const usageCount = Array.isArray(row.usages) ? row.usages.length : 0;
                  return (
                    <article
                      className={`saved-card ${isSelected ? 'is-selected' : ''} ${isDeleting ? 'is-deleting' : ''}`}
                      key={row.id}
                      data-testid={`saved-card-${row.id}`}
                    >
                      <div className="poi-category">{row.poiType}</div>
                      <div className="poi-name">{row.poiName}</div>
                      {row.poiAddress && <div className="poi-address">{row.poiAddress}</div>}
                      {usageCount > 0 && (
                        <div className="poi-usage-badge" data-testid={`saved-usage-badge-${row.id}`}>
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
                                data-testid={`saved-check-${row.id}`}
                              />
                              <span>{isSelected ? '已選' : '選取'}</span>
                            </label>
                            <a
                              href={`/saved-pois/${row.id}/add-to-trip`}
                              className="poi-add-link"
                              data-testid={`saved-add-to-trip-${row.id}`}
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
