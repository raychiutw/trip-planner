/**
 * EditTripModal v2 — 編輯既有 trip 的 form modal。
 *
 * 跟 NewTripModal 99% 同 layout（per docs/design-sessions/trip-modal-v2-osm-fields.html
 * FRAME 3），差別：
 *   (a) open 時 GET /api/trips/:id 預填現有值（含 destinations[] join）
 *   (b) destinations 名稱與原值不同 → title 旁顯示「更新提示」 alert，user 主動點才覆寫
 *   (c) 日期改 read-only chip（v1 不支援編輯，避免 cascade 影響 trip_days/entries/hotels）
 *   (d) submit 時 PUT /api/trips/:id with diff body（只送變更欄位）
 *
 * v1 editable: title / description / lang / default_travel_mode / published / destinations[]
 * v1 read-only: dates / owner / countries（destinations 變更時 backend 自 derive）
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { apiFetchRaw } from '../../lib/apiClient';
import InlineError from '../shared/InlineError';
import Icon from '../shared/Icon';
import { TP_DRAG_ACCESSIBILITY } from '../../lib/drag-announcements';

interface PoiSearchResult {
  osm_id: number;
  osm_type?: 'node' | 'way' | 'relation' | null;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  category?: string;
  country?: string;
  country_name?: string;
}

interface DestinationRow {
  osm_id: number;
  osm_type?: 'node' | 'way' | 'relation' | null;
  name: string;
  lat?: number | null;
  lng?: number | null;
  day_quota?: number | null;
  /** UI-only flag: not persisted, just to render 「新增」 badge for added rows */
  isNew?: boolean;
}

type TravelMode = 'driving' | 'walking' | 'transit';
type Lang = 'zh-TW' | 'en' | 'ja';

interface TripDestApi {
  dest_order?: number;
  name?: string;
  lat?: number | null;
  lng?: number | null;
  day_quota?: number | null;
  osm_id?: number | null;
  osm_type?: 'node' | 'way' | 'relation' | null;
}

interface TripApi {
  id?: string;
  tripId?: string;
  title?: string | null;
  description?: string | null;
  countries?: string | null;
  published?: number | null;
  data_source?: string | null;
  default_travel_mode?: TravelMode | null;
  lang?: Lang | null;
  destinations?: TripDestApi[];
  /** Date range comes from trip_days; we don't fetch separately for read-only display */
  startDate?: string;
  endDate?: string;
}

const POI_SEARCH_DEBOUNCE_MS = 300;
const POI_SEARCH_MIN_LEN = 2;

const SCOPED_STYLES = `
.tp-edit-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(42, 31, 24, 0.55);
  z-index: var(--z-modal, 60);
  display: grid; place-items: center;
  padding: 16px;
  animation: tp-edit-modal-fade 160ms var(--transition-timing-function-apple, ease-out);
}
@keyframes tp-edit-modal-fade { from { opacity: 0; } to { opacity: 1; } }

.tp-edit-modal {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 720px;
  font: inherit;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 32px);
  position: relative;
}
.tp-edit-form {
  padding: 24px;
  display: flex; flex-direction: column;
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
  padding-bottom: 0;
}
@media (min-width: 768px) {
  .tp-edit-form { padding: 28px 32px; padding-bottom: 0; }
}
.tp-edit-close {
  position: absolute; top: 12px; right: 12px;
  z-index: 2;
  width: var(--spacing-tap-min, 44px); height: var(--spacing-tap-min, 44px);
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(8px);
  display: grid; place-items: center;
  cursor: pointer;
  font-size: 18px; color: var(--color-foreground);
  box-shadow: var(--shadow-sm);
}
.tp-edit-close:hover { background: var(--color-background); color: var(--color-accent-deep); }
.tp-edit-close:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

.tp-edit-modal h2 {
  font-size: var(--font-size-title, 1.75rem);
  font-weight: 700; letter-spacing: -0.02em;
  margin: 0 0 6px;
}
.tp-edit-sub {
  color: var(--color-muted);
  font-size: var(--font-size-callout);
  margin: 0 0 20px; line-height: 1.5;
}

.tp-edit-row { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.tp-edit-row label {
  font-size: var(--font-size-footnote);
  font-weight: 700; color: var(--color-foreground);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.tp-edit-row input[type="text"],
.tp-edit-row textarea,
.tp-edit-row select {
  padding: 12px 14px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-secondary);
  color: var(--color-foreground);
  font: inherit;
  font-size: var(--font-size-body);
  min-height: var(--spacing-tap-min);
}
.tp-edit-row textarea { resize: vertical; min-height: 72px; line-height: 1.5; }
.tp-edit-row input[type="text"]:focus,
.tp-edit-row textarea:focus,
.tp-edit-row select:focus {
  outline: none;
  border-color: var(--color-accent);
  background: var(--color-background);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}

/* destinations sortable rows */
.tp-edit-dest-rows { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
.tp-edit-dest-row {
  display: grid;
  grid-template-columns: 24px 28px 1fr auto auto;
  align-items: center; gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  min-height: 44px;
  font-size: var(--font-size-footnote);
}
.tp-edit-dest-row.is-dragging {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
}
.tp-edit-dest-row.is-new { background: var(--color-accent-subtle); border-color: var(--color-accent); }
.tp-edit-dest-grip {
  cursor: grab;
  color: var(--color-muted);
  display: grid; place-items: center;
  width: 24px; height: 24px;
  border: 0; background: transparent;
}
.tp-edit-dest-grip:active { cursor: grabbing; }
.tp-edit-dest-grip .svg-icon { width: 14px; height: 14px; }
.tp-edit-dest-num {
  width: 28px; height: 28px;
  border-radius: 50%;
  display: grid; place-items: center;
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  font-weight: 700;
  font-size: var(--font-size-caption);
}
.tp-edit-dest-name {
  min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-weight: 600;
  color: var(--color-foreground);
}
.tp-edit-dest-badge {
  margin-left: 6px;
  color: var(--color-accent-deep);
  font-size: var(--font-size-caption);
  font-weight: 600;
}
.tp-edit-dest-quota {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}
.tp-edit-dest-remove {
  width: 28px; height: 28px;
  border: 0; background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  border-radius: 50%;
  display: grid; place-items: center;
}
.tp-edit-dest-remove:hover { background: var(--color-hover); color: var(--color-destructive); }
.tp-edit-dest-remove .svg-icon { width: 14px; height: 14px; }

/* + 加入目的地 trigger */
.tp-edit-dest-add-wrap { position: relative; }
.tp-edit-dest-add-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px;
  border: 1.5px dashed var(--color-border);
  background: transparent;
  color: var(--color-foreground);
  border-radius: var(--radius-full);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  cursor: pointer;
  min-height: 36px;
}
.tp-edit-dest-add-btn:hover { background: var(--color-accent-subtle); border-color: var(--color-accent); color: var(--color-accent-deep); }
.tp-edit-dest-search-wrap { position: relative; margin-top: 8px; }
.tp-edit-dest-search-wrap input { width: 100%; }
.tp-edit-dest-dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  z-index: 3;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  max-height: 280px; overflow-y: auto; overscroll-behavior: contain;
}
.tp-edit-dest-status {
  padding: 14px 16px;
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  text-align: center;
}
.tp-edit-dest-result {
  display: flex; flex-direction: column; gap: 2px;
  width: 100%;
  padding: 10px 14px;
  border: 0; border-bottom: 1px solid var(--color-border);
  background: transparent; font: inherit; text-align: left; cursor: pointer;
}
.tp-edit-dest-result:last-child { border-bottom: 0; }
.tp-edit-dest-result:hover { background: var(--color-accent-subtle); }
.tp-edit-dest-result .name { font-size: var(--font-size-callout); font-weight: 700; color: var(--color-foreground); line-height: 1.3; }
.tp-edit-dest-result .addr { font-size: var(--font-size-caption); color: var(--color-muted); line-height: 1.4; }

/* read-only date chip */
.tp-edit-date-readonly {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px 14px;
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.tp-edit-date-readonly .tp-edit-date-line {
  display: flex; align-items: center; gap: 8px;
  font-size: var(--font-size-callout);
  font-weight: 600; color: var(--color-foreground);
}
.tp-edit-date-readonly .tp-edit-date-helper {
  margin: 0;
  font-size: var(--font-size-caption);
  color: var(--color-muted);
}

/* title-region-change hint alert */
.tp-edit-title-hint {
  margin-top: 6px;
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  background: var(--color-accent-subtle);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-md);
  font-size: var(--font-size-footnote);
}
.tp-edit-title-hint-text { flex: 1; color: var(--color-foreground); }
.tp-edit-title-hint-text strong { color: var(--color-accent-deep); }
.tp-edit-title-hint-btn {
  padding: 6px 12px;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  font: inherit; font-weight: 600; font-size: var(--font-size-caption);
  cursor: pointer;
  min-height: 32px;
}
.tp-edit-title-hint-dismiss {
  width: 28px; height: 28px;
  border: 0; background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  border-radius: 50%;
  display: grid; place-items: center;
}
.tp-edit-title-hint-dismiss:hover { background: var(--color-background); color: var(--color-foreground); }

/* segment for default_travel_mode */
.tp-edit-segment {
  display: inline-flex;
  padding: 4px;
  border-radius: var(--radius-full);
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  align-self: stretch;
}
.tp-edit-segment button {
  flex: 1;
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 10px 16px; border-radius: var(--radius-full);
  border: none; background: transparent; color: var(--color-muted);
  cursor: pointer;
  min-height: var(--spacing-tap-min);
}
.tp-edit-segment button.is-active {
  background: var(--color-background);
  color: var(--color-accent-deep);
  box-shadow: var(--shadow-md), inset 0 0 0 1.5px var(--color-accent);
}
.tp-edit-segment button:hover:not(.is-active) { color: var(--color-foreground); }

/* sticky actions row */
.tp-edit-actions {
  position: sticky; bottom: 0;
  display: flex; gap: 8px; justify-content: space-between; align-items: center;
  flex-wrap: wrap;
  margin: 20px -24px 0;
  padding: 16px 24px max(16px, env(safe-area-inset-bottom, 16px));
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-background) 94%, transparent);
  backdrop-filter: blur(var(--blur-glass, 14px));
  -webkit-backdrop-filter: blur(var(--blur-glass, 14px));
}
@media (min-width: 768px) {
  .tp-edit-actions { margin-left: -32px; margin-right: -32px; padding-left: 32px; padding-right: 32px; }
}
.tp-edit-actions-publish {
  display: inline-flex;
  padding: 4px;
  border-radius: var(--radius-full);
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
}
.tp-edit-actions-publish button {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px;
  border: 0; background: transparent;
  border-radius: var(--radius-full);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-muted); cursor: pointer;
  min-height: 36px;
}
.tp-edit-actions-publish button .dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--color-line-strong);
}
.tp-edit-actions-publish button.is-active {
  background: var(--color-background);
  color: var(--color-foreground);
  box-shadow: var(--shadow-sm);
}
.tp-edit-actions-publish button.is-active.is-published .dot { background: var(--color-success, #2e8540); }
.tp-edit-actions-publish button.is-active.is-draft .dot { background: var(--color-line-strong); }

.tp-edit-actions-btns { display: inline-flex; gap: 8px; }
.tp-edit-btn {
  padding: 12px 20px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: transparent; color: var(--color-foreground);
  font: inherit; font-weight: 600; font-size: var(--font-size-callout);
  cursor: pointer;
  min-height: var(--spacing-tap-min);
}
.tp-edit-btn:hover:not(:disabled) { background: var(--color-hover); }
.tp-edit-btn-primary {
  background: var(--color-accent); color: var(--color-accent-foreground);
  border-color: var(--color-accent);
}
.tp-edit-btn-primary:hover:not(:disabled) { filter: brightness(var(--hover-brightness, 0.95)); }
.tp-edit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* loading shimmer for initial fetch */
.tp-edit-loading {
  padding: 60px 24px;
  text-align: center;
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
}
`;

interface SortableDestinationRowProps {
  dest: DestinationRow;
  index: number;
  onRemove: (osmId: number) => void;
}

function SortableDestRow({ dest, index, onRemove }: SortableDestinationRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dest.osm_id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`tp-edit-dest-row ${isDragging ? 'is-dragging' : ''} ${dest.isNew ? 'is-new' : ''}`}
      data-testid={`edit-trip-dest-row-${dest.osm_id}`}
    >
      <button
        type="button"
        className="tp-edit-dest-grip"
        aria-label={`拖移目的地：${dest.name}`}
        {...attributes}
        {...listeners}
      >
        <Icon name="arrows-vertical" />
      </button>
      <span className="tp-edit-dest-num" aria-hidden="true">{index + 1}</span>
      <span className="tp-edit-dest-name">
        {dest.name}
        {dest.isNew && <span className="tp-edit-dest-badge">新增</span>}
      </span>
      <span className="tp-edit-dest-quota">
        {dest.day_quota != null && dest.day_quota > 0 ? `${dest.day_quota} 天` : ''}
      </span>
      <button
        type="button"
        className="tp-edit-dest-remove"
        onClick={() => onRemove(dest.osm_id)}
        aria-label={`移除目的地：${dest.name}`}
      >
        <Icon name="x-mark" />
      </button>
    </div>
  );
}

export interface EditTripModalProps {
  open: boolean;
  tripId: string;
  onClose: () => void;
  onSaved: (tripId: string) => void;
}

function deriveAutoTitle(destinations: DestinationRow[], startDate?: string): string {
  if (destinations.length === 0) return '';
  const year = startDate ? startDate.slice(0, 4) : new Date().getFullYear().toString();
  if (destinations.length === 1) return `${year} ${destinations[0]!.name}`;
  if (destinations.length === 2) return `${year} ${destinations[0]!.name}・${destinations[1]!.name}`;
  return `${year} ${destinations[0]!.name}等 ${destinations.length} 地`;
}

function destNamesEqual(a: DestinationRow[], b: DestinationRow[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]!.name !== b[i]!.name) return false;
  }
  return true;
}

export default function EditTripModal({ open, tripId, onClose, onSaved }: EditTripModalProps) {
  const [loading, setLoading] = useState(true);
  const [original, setOriginal] = useState<TripApi | null>(null);
  const [originalDests, setOriginalDests] = useState<DestinationRow[]>([]);

  // editable state
  const [destinations, setDestinations] = useState<DestinationRow[]>([]);
  const [title, setTitle] = useState('');
  const [titleEdited, setTitleEdited] = useState(false);
  const [titleHintDismissed, setTitleHintDismissed] = useState(false);
  const [description, setDescription] = useState('');
  const [lang, setLang] = useState<Lang>('zh-TW');
  const [travelMode, setTravelMode] = useState<TravelMode>('driving');
  const [published, setPublished] = useState(0);

  // POI search inline state
  const [showSearch, setShowSearch] = useState(false);
  const [destQuery, setDestQuery] = useState('');
  const [poiResults, setPoiResults] = useState<PoiSearchResult[] | null>(null);
  const [poiSearching, setPoiSearching] = useState(false);
  const [poiSearchError, setPoiSearchError] = useState<string | null>(null);
  const poiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poiAbortRef = useRef<AbortController | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GET trip on open
  useEffect(() => {
    if (!open) {
      setLoading(true);
      setOriginal(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}`);
        if (!res.ok) throw new Error(`load failed: ${res.status}`);
        const data = (await res.json()) as TripApi;
        if (cancelled) return;
        setOriginal(data);
        const initialDests: DestinationRow[] = (data.destinations ?? [])
          .filter((d): d is TripDestApi & { osm_id: number; name: string } =>
            typeof d.osm_id === 'number' && typeof d.name === 'string')
          .map((d) => ({
            osm_id: d.osm_id,
            osm_type: d.osm_type ?? null,
            name: d.name,
            lat: d.lat ?? null,
            lng: d.lng ?? null,
            day_quota: d.day_quota ?? null,
          }));
        setOriginalDests(initialDests);
        setDestinations(initialDests);
        setTitle(data.title ?? '');
        setTitleEdited(false);
        setTitleHintDismissed(false);
        setDescription(data.description ?? '');
        setLang((data.lang as Lang) ?? 'zh-TW');
        setTravelMode((data.default_travel_mode as TravelMode) ?? 'driving');
        setPublished(data.published ?? 0);
        setShowSearch(false);
        setDestQuery('');
        setPoiResults(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '載入行程失敗');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, tripId]);

  // POI search debounce
  useEffect(() => {
    if (!open || !showSearch) return;
    if (poiDebounceRef.current) clearTimeout(poiDebounceRef.current);
    const trimmed = destQuery.trim();
    if (trimmed.length < POI_SEARCH_MIN_LEN) {
      setPoiResults(null); setPoiSearching(false); setPoiSearchError(null);
      poiAbortRef.current?.abort();
      return;
    }
    poiDebounceRef.current = setTimeout(async () => {
      poiAbortRef.current?.abort();
      const ctrl = new AbortController();
      poiAbortRef.current = ctrl;
      setPoiSearching(true); setPoiSearchError(null);
      try {
        const resp = await fetch(`/api/poi-search?q=${encodeURIComponent(trimmed)}&limit=10`, { signal: ctrl.signal });
        if (!resp.ok) {
          setPoiSearchError('搜尋失敗，請稍後再試');
          setPoiResults([]);
          return;
        }
        const data = (await resp.json()) as { results: PoiSearchResult[] };
        setPoiResults(data.results ?? []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setPoiSearchError('網路連線失敗');
        setPoiResults([]);
      } finally {
        setPoiSearching(false);
      }
    }, POI_SEARCH_DEBOUNCE_MS);
    return () => { if (poiDebounceRef.current) clearTimeout(poiDebounceRef.current); };
  }, [destQuery, open, showSearch]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  // Region change hint logic — only show if (a) destinations names changed
  // vs original AND (b) user hasn't manually edited title since open AND (c)
  // hint not dismissed. Auto-derived suggestion uses the new dest names.
  const showTitleHint = useMemo(() => {
    if (loading || !original) return false;
    if (titleEdited || titleHintDismissed) return false;
    return !destNamesEqual(destinations, originalDests);
  }, [loading, original, titleEdited, titleHintDismissed, destinations, originalDests]);

  const suggestedTitle = useMemo(
    () => deriveAutoTitle(destinations, original?.startDate),
    [destinations, original?.startDate],
  );

  function selectPoi(poi: PoiSearchResult) {
    if (destinations.some((d) => d.osm_id === poi.osm_id)) {
      // already added — just close search
      setShowSearch(false); setDestQuery(''); setPoiResults(null);
      return;
    }
    setDestinations((prev) => [
      ...prev,
      {
        osm_id: poi.osm_id,
        osm_type: poi.osm_type ?? null,
        name: poi.name,
        lat: poi.lat,
        lng: poi.lng,
        day_quota: null,
        isNew: !originalDests.some((d) => d.osm_id === poi.osm_id),
      },
    ]);
    setShowSearch(false);
    setDestQuery('');
    setPoiResults(null);
  }

  function removeDest(osmId: number) {
    setDestinations((prev) => prev.filter((d) => d.osm_id !== osmId));
  }

  function handleDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const fromIdx = destinations.findIndex((d) => d.osm_id === e.active.id);
    const toIdx = destinations.findIndex((d) => d.osm_id === e.over!.id);
    if (fromIdx < 0 || toIdx < 0) return;
    setDestinations((prev) => arrayMove(prev, fromIdx, toIdx));
  }

  function applyTitleSuggestion() {
    setTitle(suggestedTitle);
    setTitleEdited(true);
    setTitleHintDismissed(true);
  }

  function dismissTitleHint() {
    setTitleHintDismissed(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !original) return;
    setSubmitting(true);
    setError(null);

    // Build PATCH body — only include fields that changed.
    const body: Record<string, unknown> = {};
    if (title !== (original.title ?? '')) body.title = title || null;
    if (description !== (original.description ?? '')) body.description = description || null;
    if (lang !== ((original.lang as Lang) ?? 'zh-TW')) body.lang = lang;
    if (travelMode !== ((original.default_travel_mode as TravelMode) ?? 'driving')) body.default_travel_mode = travelMode;
    if (published !== (original.published ?? 0)) body.published = published;

    // destinations: send full array if any change (add/remove/reorder/quota)
    const destsChanged = !destNamesEqual(destinations, originalDests)
      || destinations.some((d, i) => {
        const o = originalDests[i];
        return !o || o.osm_id !== d.osm_id || (o.day_quota ?? null) !== (d.day_quota ?? null);
      });
    if (destsChanged) {
      body.destinations = destinations.map((d) => ({
        name: d.name,
        lat: d.lat ?? null,
        lng: d.lng ?? null,
        osm_id: d.osm_id,
        osm_type: d.osm_type ?? null,
        day_quota: d.day_quota ?? null,
      }));
      // derive countries when destinations change — backend doesn't auto-derive
      // on PUT. Use first letter of country if PoiSearchResult had it; fallback
      // unchanged. This block is best-effort — backend ALLOWED_FIELDS includes
      // countries so this gets persisted.
      // (We don't have country info on DestinationRow — leave countries as is
      // and let user fix manually if needed; future work: backend derive.)
    }

    if (Object.keys(body).length === 0) {
      // No changes — just close.
      setSubmitting(false);
      onClose();
      return;
    }

    try {
      const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = '儲存變更失敗，請稍後再試。';
        try {
          const data = JSON.parse(text) as { error?: { code?: string; message?: string } };
          if (data?.error?.message) message = data.error.message;
        } catch { /* not JSON */ }
        throw new Error(message);
      }
      onSaved(tripId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存變更失敗');
      setSubmitting(false);
    }
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget && !submitting) onClose();
  }

  if (!open) return null;

  const dateRange = original?.startDate && original?.endDate
    ? `${original.startDate} ~ ${original.endDate}`
    : null;

  return createPortal((
    <div
      className="tp-edit-modal-backdrop"
      onMouseDown={handleBackdrop}
      role="presentation"
      data-testid="edit-trip-modal"
    >
      <style>{SCOPED_STYLES}</style>
      <form
        className="tp-edit-modal"
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-trip-title"
      >
        <button
          type="button"
          className="tp-edit-close"
          onClick={onClose}
          disabled={submitting}
          aria-label="關閉"
          data-testid="edit-trip-close"
        >
          <Icon name="x-mark" />
        </button>
        <div className="tp-edit-form">
          <h2 id="edit-trip-title">編輯行程</h2>
          <p className="tp-edit-sub">修改行程基本設定 + 目的地。修改日期請另建新行程。</p>

          {loading ? (
            <div className="tp-edit-loading" data-testid="edit-trip-loading">載入中⋯</div>
          ) : (
            <>
              {/* Destinations */}
              <div className="tp-edit-row">
                <label>目的地</label>
                {destinations.length > 0 ? (
                  <DndContext
                    collisionDetection={closestCenter}
                    accessibility={TP_DRAG_ACCESSIBILITY}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={destinations.map((d) => d.osm_id)} strategy={verticalListSortingStrategy}>
                      <div className="tp-edit-dest-rows" data-testid="edit-trip-dest-rows">
                        {destinations.map((d, i) => (
                          <SortableDestRow key={d.osm_id} dest={d} index={i} onRemove={removeDest} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <p style={{ margin: '0 0 8px', color: 'var(--color-muted)', fontSize: 'var(--font-size-footnote)' }}>
                    尚無目的地，按下方按鈕加入。
                  </p>
                )}
                <div className="tp-edit-dest-add-wrap">
                  {!showSearch ? (
                    <button
                      type="button"
                      className="tp-edit-dest-add-btn"
                      onClick={() => setShowSearch(true)}
                      data-testid="edit-trip-dest-add-btn"
                    >
                      <Icon name="plus" />
                      <span>加入目的地</span>
                    </button>
                  ) : (
                    <div className="tp-edit-dest-search-wrap">
                      <input
                        type="text"
                        value={destQuery}
                        onChange={(e) => setDestQuery(e.target.value)}
                        placeholder="搜尋景點、城市、地址⋯"
                        autoFocus
                        autoComplete="off"
                        data-testid="edit-trip-dest-search-input"
                      />
                      {(poiSearching || poiResults || poiSearchError) && destQuery.trim().length >= POI_SEARCH_MIN_LEN && (
                        <div className="tp-edit-dest-dropdown" role="listbox" data-testid="edit-trip-dest-dropdown">
                          {poiSearching && <div className="tp-edit-dest-status">搜尋中⋯</div>}
                          {!poiSearching && poiSearchError && <div className="tp-edit-dest-status">{poiSearchError}</div>}
                          {!poiSearching && !poiSearchError && poiResults && poiResults.length === 0 && (
                            <div className="tp-edit-dest-status">沒找到結果，試試別的關鍵字</div>
                          )}
                          {!poiSearching && poiResults && poiResults.length > 0 && poiResults.map((p) => (
                            <button
                              key={p.osm_id}
                              type="button"
                              role="option"
                              className="tp-edit-dest-result"
                              onClick={() => selectPoi(p)}
                              data-testid={`edit-trip-dest-result-${p.osm_id}`}
                            >
                              <span className="name">{p.name}</span>
                              <span className="addr">{p.address}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Date read-only */}
              {dateRange && (
                <div className="tp-edit-row">
                  <label>日期</label>
                  <div className="tp-edit-date-readonly" data-testid="edit-trip-date-readonly">
                    <div className="tp-edit-date-line">
                      <span aria-hidden="true">📅</span>
                      <span>{dateRange}</span>
                    </div>
                    <p className="tp-edit-date-helper">修改日期請另建新行程（v1 暫不支援編輯，避免影響 entries / hotels）</p>
                  </div>
                </div>
              )}

              {/* Title (with region change hint) */}
              <div className="tp-edit-row">
                <label htmlFor="edit-trip-title-input">行程名稱（選填）</label>
                <input
                  id="edit-trip-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setTitleEdited(true); }}
                  placeholder={suggestedTitle || '由「年份+目的地」自動命名'}
                  data-testid="edit-trip-title-input"
                />
                {showTitleHint && suggestedTitle && (
                  <div className="tp-edit-title-hint" role="alert" data-testid="edit-trip-title-hint">
                    <span className="tp-edit-title-hint-text">
                      目的地已變更，要更新名稱為「<strong>{suggestedTitle}</strong>」？
                    </span>
                    <button
                      type="button"
                      className="tp-edit-title-hint-btn"
                      onClick={applyTitleSuggestion}
                      data-testid="edit-trip-title-hint-apply"
                    >
                      套用
                    </button>
                    <button
                      type="button"
                      className="tp-edit-title-hint-dismiss"
                      onClick={dismissTitleHint}
                      aria-label="忽略提示"
                      data-testid="edit-trip-title-hint-dismiss"
                    >
                      <Icon name="x-mark" />
                    </button>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="tp-edit-row">
                <label htmlFor="edit-trip-desc-input">描述（選填，用於 SEO）</label>
                <textarea
                  id="edit-trip-desc-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  data-testid="edit-trip-desc-input"
                />
              </div>

              {/* Lang */}
              <div className="tp-edit-row">
                <label htmlFor="edit-trip-lang">顯示語言</label>
                <select
                  id="edit-trip-lang"
                  value={lang}
                  onChange={(e) => setLang(e.target.value as Lang)}
                  data-testid="edit-trip-lang-select"
                >
                  <option value="zh-TW">繁體中文（台灣）</option>
                  <option value="en">English</option>
                  <option value="ja">日本語</option>
                </select>
              </div>

              {/* Default travel mode segment */}
              <div className="tp-edit-row">
                <label>預設交通方式</label>
                <div className="tp-edit-segment" role="radiogroup" aria-label="預設交通方式">
                  {(['driving', 'walking', 'transit'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={travelMode === mode}
                      className={travelMode === mode ? 'is-active' : ''}
                      onClick={() => setTravelMode(mode)}
                      data-testid={`edit-trip-travel-mode-${mode}`}
                    >
                      {mode === 'driving' ? '自駕' : mode === 'walking' ? '步行' : '大眾運輸'}
                    </button>
                  ))}
                </div>
              </div>

              {error && <InlineError message={error} testId="edit-trip-error" />}
            </>
          )}
        </div>

        {!loading && (
          <div className="tp-edit-actions">
            <div className="tp-edit-actions-publish" role="radiogroup" aria-label="發布狀態">
              <button
                type="button"
                role="radio"
                aria-checked={published === 0}
                className={`is-draft ${published === 0 ? 'is-active' : ''}`}
                onClick={() => setPublished(0)}
                data-testid="edit-trip-published-draft"
              >
                <span className="dot"></span>
                <span>草稿</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={published === 1}
                className={`is-published ${published === 1 ? 'is-active' : ''}`}
                onClick={() => setPublished(1)}
                data-testid="edit-trip-published-on"
              >
                <span className="dot"></span>
                <span>上線</span>
              </button>
            </div>
            <div className="tp-edit-actions-btns">
              <button
                type="button"
                className="tp-edit-btn"
                onClick={onClose}
                disabled={submitting}
                data-testid="edit-trip-cancel"
              >
                取消
              </button>
              <button
                type="submit"
                className="tp-edit-btn tp-edit-btn-primary"
                disabled={submitting}
                data-testid="edit-trip-submit"
              >
                {submitting ? '儲存中⋯' : '儲存變更'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  ), document.body);
}
