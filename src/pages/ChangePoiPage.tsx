/**
 * ChangePoiPage — v2.23.8 變更 POI 全頁 form。
 *
 * Route: /trip/:id/stop/:eid/change-poi
 *
 * Use case：user 在 timeline row action 點「變更 POI」 → 進此頁，搜尋
 * + 選新 POI（search 或 favorites）→ submit 走 `PUT /api/trips/:id/entries/:eid/poi-id`
 * find-or-create mode（{name, lat, lng, source}）或 favorite mode (existing poi_id)。
 *
 * 完成後 fire-and-forget recompute travel + navigate 回 trip view。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import Icon from '../components/shared/Icon';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { usePoiSearch } from '../hooks/usePoiSearch';
import { apiFetch, apiFetchRaw } from '../lib/apiClient';
import { regionToApiParam } from '../lib/maps/region';
import type { PoiFavorite } from '../types/api';

const SCOPED_STYLES = `
.tp-change-poi {
  display: flex; flex-direction: column; gap: 16px;
  max-width: 720px; width: 100%; margin: 0 auto;
  padding: 16px;
}
.tp-change-poi .tp-change-poi-tabs {
  display: flex; gap: 4px; border-bottom: 1px solid var(--color-border);
}
.tp-change-poi .tp-change-poi-tab {
  padding: 10px 16px;
  background: none; border: none; cursor: pointer;
  font: inherit; font-size: 15px; font-weight: 600;
  color: var(--color-muted);
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.tp-change-poi .tp-change-poi-tab.is-active {
  color: var(--color-accent); border-color: var(--color-accent);
}
.tp-change-poi-search {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.tp-change-poi-search input {
  border: 0; flex: 1; outline: 0; font: inherit; font-size: 15px;
  background: transparent;
}
.tp-change-poi-list {
  display: flex; flex-direction: column; gap: 8px;
}
.tp-change-poi-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 10px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-md); background: var(--color-background);
  cursor: pointer; text-align: left;
}
.tp-change-poi-item:hover { border-color: var(--color-accent); }
.tp-change-poi-item.is-selected {
  border-color: var(--color-accent); background: var(--color-accent-subtle);
}
.tp-change-poi-item-name { font-weight: 600; color: var(--color-foreground); }
.tp-change-poi-item-addr {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tp-change-poi-actions {
  display: flex; justify-content: center;
}
.tp-change-poi-submit {
  font: inherit; font-weight: 700; font-size: 15px;
  padding: 12px 28px; border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-accent-foreground);
  border: 1px solid var(--color-accent);
  cursor: pointer; min-height: var(--spacing-tap-min);
  min-width: 200px;
}
.tp-change-poi-submit:disabled { opacity: 0.55; cursor: not-allowed; }
@media (max-width: 760px) {
  .tp-change-poi-submit { width: 100%; }
}
`;

type Tab = 'search' | 'favorites';

interface SelectedPoi {
  source: 'search' | 'favorite';
  /** for favorite mode: pre-existing poi_id */
  poiId?: number;
  /** for search mode: payload to send find-or-create */
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
}

export default function ChangePoiPage() {
  const { tripId, entryId: entryIdParam } = useParams<{ tripId: string; entryId: string }>();
  const entryId = Number(entryIdParam);
  const navigate = useNavigate();
  const goBack = useNavigateBack(tripId ? `/trips?selected=${tripId}` : '/trips');
  const { user } = useCurrentUser();

  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [region] = useState<string>('全部地區');
  const [selected, setSelected] = useState<SelectedPoi | null>(null);
  const [favorites, setFavorites] = useState<PoiFavorite[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { results: searchResults, searching } = usePoiSearch({
    enabled: tab === 'search',
    query: query.trim(),
    region: regionToApiParam(region),
    limit: 20,
  });

  useEffect(() => {
    if (tab !== 'favorites' || favorites !== null) return;
    let cancelled = false;
    apiFetch<PoiFavorite[]>('/poi-favorites')
      .then((data) => {
        if (cancelled) return;
        setFavorites(data);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [tab, favorites]);

  const handleSubmit = useCallback(async () => {
    if (!selected || !tripId || !Number.isInteger(entryId) || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = selected.source === 'favorite' && selected.poiId
        ? { poi_id: selected.poiId }
        : { name: selected.name, lat: selected.lat, lng: selected.lng, source: 'google' };
      const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/entries/${entryId}/poi-id`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`PUT 失敗 (${res.status}): ${text.slice(0, 200)}`);
      }
      // fire-and-forget recompute current day（user 換 POI 後 distance/min 應更新）
      void apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/recompute-travel`, {
        method: 'POST',
      }).catch(() => undefined);
      window.dispatchEvent(new CustomEvent('tp-entry-updated', { detail: { tripId } }));
      navigate(`/trips?selected=${encodeURIComponent(tripId)}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '變更 POI 失敗');
      setSubmitting(false);
    }
  }, [selected, tripId, entryId, submitting, navigate]);

  const main = useMemo(() => (
    <div className="tp-app">
      <style>{SCOPED_STYLES}</style>
      <TitleBar title="變更 POI" back={goBack} />
      <main className="tp-page-content">
        <div className="tp-change-poi">
          <div className="tp-change-poi-tabs">
            <button
              type="button"
              className={`tp-change-poi-tab ${tab === 'search' ? 'is-active' : ''}`}
              onClick={() => setTab('search')}
              data-testid="change-poi-tab-search"
            >
              搜尋
            </button>
            <button
              type="button"
              className={`tp-change-poi-tab ${tab === 'favorites' ? 'is-active' : ''}`}
              onClick={() => setTab('favorites')}
              data-testid="change-poi-tab-favorites"
            >
              收藏
            </button>
          </div>

          {tab === 'search' && (
            <>
              <div className="tp-change-poi-search">
                <Icon name="search" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="輸入景點名稱…"
                  data-testid="change-poi-search-input"
                />
              </div>
              <div className="tp-change-poi-list">
                {searching && <div>搜尋中…</div>}
                {!searching && searchResults.length === 0 && query.trim().length >= 2 && (
                  <div>無結果</div>
                )}
                {searchResults.map((r) => {
                  const isSel = selected?.source === 'search' && selected.name === r.name && selected.lat === r.lat;
                  return (
                    <button
                      key={r.place_id}
                      type="button"
                      className={`tp-change-poi-item ${isSel ? 'is-selected' : ''}`}
                      onClick={() => setSelected({
                        source: 'search',
                        name: r.name,
                        lat: r.lat,
                        lng: r.lng,
                        address: r.address,
                      })}
                      data-testid={`change-poi-search-item-${r.place_id}`}
                    >
                      <span className="tp-change-poi-item-name">{r.name}</span>
                      {r.address && <span className="tp-change-poi-item-addr">{r.address}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'favorites' && (
            <div className="tp-change-poi-list">
              {!favorites && <div>載入中…</div>}
              {favorites?.length === 0 && <div>還沒有收藏</div>}
              {favorites?.map((f) => {
                const isSel = selected?.source === 'favorite' && selected.poiId === f.poiId;
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={`tp-change-poi-item ${isSel ? 'is-selected' : ''}`}
                    onClick={() => setSelected({
                      source: 'favorite',
                      poiId: f.poiId,
                      name: f.poiName ?? '',
                      lat: f.poiLat ?? 0,
                      lng: f.poiLng ?? 0,
                      address: f.poiAddress,
                    })}
                    data-testid={`change-poi-favorite-item-${f.id}`}
                  >
                    <span className="tp-change-poi-item-name">{f.poiName}</span>
                    {f.poiAddress && <span className="tp-change-poi-item-addr">{f.poiAddress}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {error && <div className="tp-error" role="alert">{error}</div>}

          <div className="tp-change-poi-actions">
            <button
              type="button"
              className="tp-change-poi-submit"
              disabled={!selected || submitting}
              onClick={() => void handleSubmit()}
              data-testid="change-poi-submit"
            >
              {submitting ? '變更中…' : '確認變更'}
            </button>
          </div>
        </div>
      </main>
    </div>
  ), [tab, query, searching, searchResults, favorites, selected, error, submitting, goBack, handleSubmit]);

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={main}
      bottomNav={<GlobalBottomNav authed={!!user} />}
    />
  );
}
