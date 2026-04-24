import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import Icon from '../components/shared/Icon';
import ToastContainer, { showToast } from '../components/shared/Toast';

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

const SCOPED_STYLES = `
.explore-wrap {
  padding: 24px 24px 48px;
  max-width: 960px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 24px;
  color: var(--color-foreground);
}
.explore-header h1 {
  font-size: var(--font-size-title); font-weight: 800;
  letter-spacing: -0.02em; margin-bottom: 8px;
}
.explore-header p { color: var(--color-muted); font-size: var(--font-size-callout); }

.explore-search {
  display: flex; align-items: center; gap: 8px;
  background: var(--color-background);
  border: 1px solid var(--color-border); border-radius: var(--radius-full);
  padding: 8px 16px; min-height: 48px;
  box-shadow: var(--shadow-sm);
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
.explore-search button:hover { filter: brightness(var(--hover-brightness)); }
.explore-search button:disabled { opacity: 0.5; cursor: not-allowed; }

.explore-section h2 {
  font-size: var(--font-size-title3); font-weight: 700;
  letter-spacing: -0.01em; margin-bottom: 12px;
}
.explore-section .section-meta {
  font-size: var(--font-size-footnote); color: var(--color-muted); margin-bottom: 12px;
}

.explore-poi-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;
}
.explore-poi-card {
  background: var(--color-background); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); padding: 14px 16px;
  display: flex; flex-direction: column; gap: 6px;
}
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
.explore-poi-card .poi-actions { display: flex; gap: 8px; margin-top: 6px; }
.explore-poi-card button {
  padding: 6px 12px; border-radius: var(--radius-full);
  border: 1px solid var(--color-border); background: var(--color-background);
  font: inherit; font-size: 12px; font-weight: 600;
  color: var(--color-foreground); cursor: pointer;
  min-height: 32px;
}
.explore-poi-card button:hover { border-color: var(--color-accent); color: var(--color-accent); }
.explore-poi-card button.saved { background: var(--color-accent); color: var(--color-accent-foreground); border-color: var(--color-accent); }
.explore-poi-card button:disabled { opacity: 0.6; cursor: not-allowed; }

.explore-empty {
  padding: 24px; text-align: center; color: var(--color-muted);
  background: var(--color-secondary); border-radius: var(--radius-md);
  font-size: var(--font-size-callout);
}
`;

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PoiSearchResult[]>([]);
  const [saved, setSaved] = useState<SavedPoiRow[]>([]);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

  const loadSaved = useCallback(async () => {
    try {
      const rows = await apiFetch<SavedPoiRow[]>('/saved-pois');
      setSaved(rows);
    } catch {
      // silent — could be 401 未登入
    }
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const savedOsmIds = new Set<string>(saved.map((r) => `${r.poiType}::${r.poiName}`));

  const handleSearch = async (e: React.FormEvent) => {
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
      const body = await resp.json() as { results: PoiSearchResult[] };
      setResults(body.results);
    } catch (err) {
      showToast('搜尋失敗（Nominatim 暫時無法連線）', 'error', 3000);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async (poi: PoiSearchResult) => {
    setSavingIds((s) => new Set(s).add(poi.osm_id));
    try {
      const createResp = await apiFetch<{ id: number }>('/pois/find-or-create', {
        method: 'POST',
        body: JSON.stringify({
          name: poi.name,
          type: poi.category || 'poi',
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
  };

  return (
    <div className="explore-wrap" data-testid="explore-page">
      <style>{SCOPED_STYLES}</style>
      <ToastContainer />
      <header className="explore-header">
        <h1>探索 POI</h1>
        <p>搜尋景點、餐廳、飯店（資料來源：OpenStreetMap Nominatim），儲存到池裡下次規劃 trip 一鍵加入。</p>
      </header>

      <form className="explore-search" onSubmit={handleSearch}>
        <span className="search-icon">
          <Icon name="search" />
        </span>
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
              const isSaved = savedOsmIds.has(key);
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

      <section className="explore-section" data-testid="explore-saved">
        <h2>儲存池</h2>
        <p className="section-meta">{saved.length} 個已儲存 POI</p>
        {saved.length === 0 ? (
          <div className="explore-empty">還沒有儲存任何 POI。搜尋上面的關鍵字試試。</div>
        ) : (
          <div className="explore-poi-grid">
            {saved.map((row) => (
              <article className="explore-poi-card" key={row.id}>
                <div className="poi-category">{row.poiType}</div>
                <div className="poi-name">{row.poiName}</div>
                {row.poiAddress && <div className="poi-address">{row.poiAddress}</div>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
