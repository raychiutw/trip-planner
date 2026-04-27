/**
 * ExplorePage — V2 探索 POI（mockup-explore-v2.html parity）.
 *
 * Two tabs:
 *   1. 搜尋  — Nominatim search with single-click 儲存 per result.
 *   2. 儲存池 — multi-select + 「加入行程」toolbar to push selection into a trip.
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
import Icon from '../components/shared/Icon';
import ToastContainer, { showToast } from '../components/shared/Toast';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import PageHeader from '../components/shell/PageHeader';

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

/* Tab bar — segmented switch between 搜尋 / 儲存池 */
.explore-tabs {
  display: inline-flex; gap: 4px;
  padding: 4px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  align-self: flex-start;
}
.explore-tab {
  border: none; background: transparent;
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 8px 16px; border-radius: var(--radius-full);
  cursor: pointer;
  color: var(--color-muted);
  min-height: 36px;
  display: inline-flex; align-items: center; gap: 6px;
  transition: background 120ms, color 120ms;
}
.explore-tab[aria-selected="true"] {
  background: var(--color-accent); color: var(--color-accent-foreground);
}
.explore-tab .tab-count {
  font-size: var(--font-size-caption2); font-weight: 700;
  padding: 1px 6px; border-radius: 999px;
  background: rgba(0,0,0,0.08);
}
.explore-tab[aria-selected="true"] .tab-count {
  background: rgba(255,255,255,0.18); color: inherit;
}

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

.explore-poi-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;
}
.explore-poi-card {
  position: relative;
  background: var(--color-background); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); padding: 14px 16px;
  display: flex; flex-direction: column; gap: 6px;
  transition: border-color 120ms;
}
.explore-poi-card.is-selected { border-color: var(--color-accent); box-shadow: 0 0 0 1px var(--color-accent); }
.explore-poi-card .poi-category {
  font-size: var(--font-size-eyebrow); font-weight: 700; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--color-muted);
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

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
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
      <div className="explore-wrap" data-testid="explore-page">
        <ToastContainer />
        <PageHeader
          title="探索"
          meta="搜尋 POI、儲存到池裡，再一鍵把選中的點丟進你的行程。"
        />

        <div className="explore-tabs" role="tablist" aria-label="探索分頁">
          <button
            type="button"
            role="tab"
            className="explore-tab"
            aria-selected={tab === 'search'}
            onClick={() => setTab('search')}
            data-testid="explore-tab-search"
          >
            <span>搜尋</span>
            {results.length > 0 && <span className="tab-count">{results.length}</span>}
          </button>
          <button
            type="button"
            role="tab"
            className="explore-tab"
            aria-selected={tab === 'saved'}
            onClick={() => setTab('saved')}
            data-testid="explore-tab-saved"
          >
            <span>儲存池</span>
            <span className="tab-count">{saved.length}</span>
          </button>
        </div>

        {tab === 'search' && (
          <>
            <form className="explore-search" onSubmit={handleSearch}>
              <span className="search-icon"><Icon name="search" /></span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋 POI（例：沖繩水族館、首爾燒肉）"
                data-testid="explore-search-input"
              />
              <button type="submit" disabled={searching} data-testid="explore-search-submit">
                {searching ? '搜尋中...' : '搜尋'}
              </button>
            </form>

            {results.length > 0 && (
              <section className="explore-section" data-testid="explore-results">
                <h2>搜尋結果</h2>
                <p className="section-meta">{results.length} 個 POI · 點「+ 儲存」加入儲存池</p>
                <div className="explore-poi-grid">
                  {results.map((poi) => {
                    const key = `${poi.category || 'poi'}::${poi.name}`;
                    const isSaved = savedKeySet.has(key);
                    const isSaving = savingIds.has(poi.osm_id);
                    return (
                      <article className="explore-poi-card" key={poi.osm_id}>
                        <div className="poi-category">{poi.category || 'POI'}</div>
                        <div className="poi-name">{poi.name}</div>
                        <div className="poi-address">{poi.address}</div>
                        <div className="poi-actions">
                          <button
                            type="button"
                            className={isSaved ? 'saved' : ''}
                            onClick={() => !isSaved && handleSave(poi)}
                            disabled={isSaving || isSaved}
                            data-testid={`explore-save-btn-${poi.osm_id}`}
                          >
                            {isSaved ? '✓ 已儲存' : isSaving ? '儲存中...' : '+ 儲存'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {results.length === 0 && query && !searching && (
              <div className="explore-empty">沒有找到「{query}」的結果。換個關鍵字試試？</div>
            )}
          </>
        )}

        {tab === 'saved' && (
          <section className="explore-section" data-testid="explore-saved">
            <h2>儲存池</h2>
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
