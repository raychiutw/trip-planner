/**
 * InlineAddPoi — V3 inline + 加景點 affordance.
 *
 * v2.9 PR3：純 UI mockup with disabled search。
 * v2.11 Wave 2：search input 接真 Nominatim proxy （`GET /api/poi-search`），
 * 結果 click「+ 加入」 → POST `/api/trips/:id/days/:dayNum/entries`
 * （內部 findOrCreatePoi）→ dispatch `tp-entry-updated` → DaySection refetch。
 *
 * 「🤖 AI 幫我找」+「✏️ 自訂景點」 chip 仍 route 到 /chat 保留 fallback 出口。
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../shared/Icon';
import { apiFetchRaw } from '../../lib/apiClient';

const SCOPED_STYLES = `
.tp-inline-add-row { padding: 12px 16px; }

.tp-inline-add-trigger {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  border: 2px dashed var(--color-border);
  background: transparent;
  color: var(--color-muted);
  font: inherit; font-size: var(--font-size-callout); font-weight: 600;
  cursor: pointer;
  min-height: var(--spacing-tap-min);
  transition: border-color 120ms, color 120ms, background 120ms;
}
.tp-inline-add-trigger:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-subtle);
}
.tp-inline-add-trigger .svg-icon { width: 16px; height: 16px; }

.tp-inline-add-form {
  background: var(--color-accent-subtle);
  border: 1.5px solid var(--color-accent);
  border-radius: var(--radius-lg);
  padding: 16px;
  animation: tp-inline-add-in 160ms var(--transition-timing-function-apple, ease-out);
}
@keyframes tp-inline-add-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.tp-inline-add-head {
  display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
}
.tp-inline-add-head .badge {
  width: 32px; height: 32px;
  background: var(--color-accent); color: var(--color-accent-foreground);
  border-radius: var(--radius-full);
  display: grid; place-items: center; font-weight: 800;
}
.tp-inline-add-head .when {
  font-size: var(--font-size-footnote); font-weight: 700;
  color: var(--color-accent-deep);
  text-transform: uppercase; letter-spacing: 0.06em;
  flex: 1;
}
.tp-inline-add-close {
  width: 36px; height: 36px;
  border-radius: var(--radius-full);
  background: var(--color-background); border: 1px solid var(--color-border);
  cursor: pointer; font-size: 16px;
  display: grid; place-items: center;
  color: var(--color-muted);
}
.tp-inline-add-close:hover { background: var(--color-secondary); color: var(--color-foreground); }

.tp-inline-add-search {
  display: flex; gap: 8px;
  background: var(--color-background); border: 1.5px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 4px 4px 4px 16px;
  align-items: center;
  margin-bottom: 12px;
}
.tp-inline-add-search:focus-within {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-inline-add-search .ico { color: var(--color-muted); }
.tp-inline-add-search input {
  flex: 1; font: inherit; font-size: var(--font-size-callout);
  border: 0; padding: 10px 4px; background: transparent;
  min-height: 36px;
  color: var(--color-foreground);
}
.tp-inline-add-search input:focus { outline: none; }
.tp-inline-add-search input::placeholder { color: var(--color-muted); }
.tp-inline-add-search .spinner {
  width: 18px; height: 18px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: tp-inline-spin 0.8s linear infinite;
  margin-right: 8px;
}
@keyframes tp-inline-spin { to { transform: rotate(360deg); } }

.tp-inline-add-chips {
  display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;
}
.tp-inline-add-chip {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  background: var(--color-background); color: var(--color-foreground);
  padding: 8px 14px; border-radius: var(--radius-full);
  border: 1px solid var(--color-border); cursor: pointer;
  text-decoration: none;
  display: inline-flex; align-items: center; gap: 4px;
  min-height: 36px;
}
.tp-inline-add-chip:hover { background: var(--color-accent); color: var(--color-accent-foreground); border-color: var(--color-accent); }

.tp-inline-add-results {
  background: var(--color-background); border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  max-height: 360px; overflow-y: auto;
}
.tp-inline-add-result {
  display: flex; gap: 12px; padding: 12px;
  border-bottom: 1px solid var(--color-border);
  align-items: center;
}
.tp-inline-add-result:last-child { border-bottom: 0; }
.tp-inline-add-result .img {
  width: 48px; height: 48px; flex-shrink: 0; border-radius: var(--radius-md);
  background: var(--color-tertiary);
  display: grid; place-items: center; font-size: 22px;
}
.tp-inline-add-result .info { flex: 1; min-width: 0; }
.tp-inline-add-result .name {
  font-size: var(--font-size-callout); font-weight: 700; margin: 0; line-height: 1.3;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tp-inline-add-result .meta {
  font-size: var(--font-size-caption); color: var(--color-muted); margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tp-inline-add-result .add-btn {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 700;
  background: var(--color-accent); color: var(--color-accent-foreground);
  border: 0; padding: 8px 14px; border-radius: var(--radius-full);
  cursor: pointer; min-height: 36px;
}
.tp-inline-add-result .add-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tp-inline-add-result .add-btn.is-added { background: var(--color-success); }

.tp-inline-add-empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
}

.tp-inline-add-error {
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--color-destructive-bg);
  border: 1px solid var(--color-destructive);
  border-radius: var(--radius-md);
  font-size: var(--font-size-footnote);
  color: var(--color-destructive);
  line-height: 1.5;
}
`;

interface PoiSearchResult {
  osm_id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
}

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LEN = 2;

export interface InlineAddPoiProps {
  tripId: string;
  dayNum: number;
}

export default function InlineAddPoi({ tripId, dayNum }: InlineAddPoiProps) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PoiSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced search effect — fires SEARCH_DEBOUNCE_MS after query change.
  useEffect(() => {
    if (!expanded) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LEN) {
      setResults(null);
      setSearchError(null);
      setSearching(false);
      return;
    }
    debounceTimerRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSearching(true);
      setSearchError(null);
      try {
        const resp = await fetch(`/api/poi-search?q=${encodeURIComponent(trimmed)}&limit=10`, { signal: ctrl.signal });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const body = await resp.json() as { results: PoiSearchResult[] };
        setResults(body.results);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setSearchError('搜尋失敗（Nominatim 暫時無法連線）');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, expanded]);

  function reset() {
    setExpanded(false);
    setQuery('');
    setResults(null);
    setSearching(false);
    setSearchError(null);
    setAddError(null);
    setAddingIds(new Set());
    setAddedIds(new Set());
    abortRef.current?.abort();
  }

  async function handleAdd(poi: PoiSearchResult) {
    setAddingIds((prev) => new Set(prev).add(poi.osm_id));
    setAddError(null);
    try {
      const resp = await apiFetchRaw(`/trips/${tripId}/days/${dayNum}/entries`, {
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({
          title: poi.name,
          poi_type: mapNominatimCategory(poi.category),
          lat: poi.lat,
          lng: poi.lng,
          source: 'user-search',
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setAddedIds((prev) => new Set(prev).add(poi.osm_id));
      window.dispatchEvent(new CustomEvent('tp-entry-updated', {
        detail: { tripId, dayNum },
      }));
    } catch (err) {
      setAddError(err instanceof Error ? err.message : '加入失敗');
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(poi.osm_id);
        return next;
      });
    }
  }

  const aiHref = `/chat?tripId=${encodeURIComponent(tripId)}&prefill=${encodeURIComponent(`幫我找 Day ${dayNum} 適合加的景點：`)}`;
  const customHref = `/chat?tripId=${encodeURIComponent(tripId)}&prefill=${encodeURIComponent(`幫我加 Day ${dayNum} 的景點（自訂）：`)}`;

  if (!expanded) {
    return (
      <div className="tp-inline-add-row">
        <style>{SCOPED_STYLES}</style>
        <button
          type="button"
          className="tp-inline-add-trigger"
          onClick={() => setExpanded(true)}
          aria-label={`在 Day ${dayNum} 加景點`}
          data-testid="inline-add-poi-trigger"
        >
          <Icon name="plus" />
          <span>在 Day {dayNum} 加景點</span>
        </button>
      </div>
    );
  }

  return (
    <div className="tp-inline-add-row">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-inline-add-form" data-testid="inline-add-poi-form">
        <div className="tp-inline-add-head">
          <div className="badge">+</div>
          <div className="when">在 Day {dayNum} 加景點</div>
          <button
            type="button"
            className="tp-inline-add-close"
            onClick={reset}
            aria-label="收闔加景點"
            data-testid="inline-add-poi-close"
          >
            ✕
          </button>
        </div>

        <div className="tp-inline-add-search">
          <span className="ico" aria-hidden="true">🔍</span>
          <input
            type="text"
            placeholder="搜尋景點、餐廳、地址…（≥2 個字）"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            data-testid="inline-add-poi-search"
          />
          {searching && <span className="spinner" aria-label="搜尋中" data-testid="inline-add-poi-spinner" />}
        </div>

        <div className="tp-inline-add-chips">
          <Link to={aiHref} className="tp-inline-add-chip" data-testid="inline-add-poi-chip-ai">
            🤖 AI 幫我找
          </Link>
          <Link to={customHref} className="tp-inline-add-chip" data-testid="inline-add-poi-chip-custom">
            ✏️ 自訂景點
          </Link>
        </div>

        {results !== null && (
          <div className="tp-inline-add-results" data-testid="inline-add-poi-results">
            {results.length === 0 ? (
              <div className="tp-inline-add-empty">
                {searchError ?? `沒找到「${query}」的結果，試試別的關鍵字`}
              </div>
            ) : (
              results.map((poi) => {
                const isAdding = addingIds.has(poi.osm_id);
                const isAdded = addedIds.has(poi.osm_id);
                return (
                  <div className="tp-inline-add-result" key={poi.osm_id}>
                    <div className="img" aria-hidden="true">{categoryEmoji(poi.category)}</div>
                    <div className="info">
                      <div className="name" title={poi.name}>{poi.name}</div>
                      <div className="meta" title={poi.address}>{poi.address}</div>
                    </div>
                    <button
                      type="button"
                      className={`add-btn ${isAdded ? 'is-added' : ''}`}
                      onClick={() => handleAdd(poi)}
                      disabled={isAdding || isAdded}
                      data-testid={`inline-add-poi-result-add-${poi.osm_id}`}
                    >
                      {isAdded ? '✓ 已加' : isAdding ? '加入中…' : '+ 加入'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {addError && (
          <p className="tp-inline-add-error" role="alert" data-testid="inline-add-poi-error">
            {addError}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Nominatim category（OSM `class`）→ Tripline poi_type 白名單。
 * 白名單 source: functions/api/trips/[id]/days/[num]/entries.ts ALLOWED_POI_TYPES。
 */
function mapNominatimCategory(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('hotel') || c.includes('lodging') || c.includes('tourism')) return 'hotel';
  if (c.includes('restaurant') || c.includes('food') || c.includes('amenity')) return 'restaurant';
  if (c.includes('shop') || c.includes('mall') || c.includes('retail')) return 'shopping';
  if (c.includes('parking')) return 'parking';
  if (c.includes('transport') || c.includes('railway') || c.includes('airport')) return 'transport';
  if (c.includes('activity') || c.includes('leisure')) return 'activity';
  return 'attraction';
}

function categoryEmoji(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('hotel') || c.includes('lodging')) return '🏨';
  if (c.includes('restaurant') || c.includes('food')) return '🍴';
  if (c.includes('shop') || c.includes('mall')) return '🛍️';
  if (c.includes('parking')) return '🅿️';
  if (c.includes('transport') || c.includes('railway') || c.includes('airport')) return '🚉';
  if (c.includes('beach') || c.includes('coast')) return '🏖️';
  if (c.includes('park') || c.includes('garden')) return '🌳';
  return '📍';
}
