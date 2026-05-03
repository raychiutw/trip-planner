/**
 * NewTripPage — 新增行程的全頁 form (取代 NewTripModal)。
 *
 * Route: `/trips/new`
 * 對應 DESIGN.md「Trip Form Pages」規範 (2026-05-03)：
 *   AppShell + sticky TitleBar(返回 + 標題 + 建立 action) + content + bottom sticky
 *   actions row。修改邏輯沿用原 NewTripModal v2.19.0。
 *
 * Layout:
 *   AppShell
 *     sidebar: DesktopSidebarConnected (行程 active)
 *     main:
 *       TitleBar(新增行程)  ← back / 「建立」 action button
 *       content: form (含目的地 sortable + popular/recent dest chips +
 *                date mode segment + flex stepper + month carousel +
 *                day quota stepper + preferences textarea)
 *       bottom: sticky actions row(summary + 取消 + 建立)
 *     bottomNav: GlobalBottomNav (行程 active)
 *
 * 進入路徑:
 *   - DesktopSidebar「+ 新增行程」 → useNewTrip().openModal() → navigate('/trips/new')
 *   - TripsListPage 空狀態 hero CTA → 同上
 *   - TripsListPage 卡片列表「+ 新增」dashed card → 同上
 *
 * 跟舊 NewTripModal 差別:
 *   - 拿掉 portal / backdrop / close X button / ESC handler / cleanup-on-close effect
 *   - 從 props 收 ownerEmail 改成 useCurrentUser
 *   - 從 props 收 onClose/onCreated 改成 useNavigate + dispatch tp-trip-created
 *   - 取消改 navigate(-1)，建立後 navigate(`/trips?selected=:id`)
 *   - 「建立」 primary action 在 TitleBar (responsive icon+文字 / icon-only)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { routes } from '../lib/routes';
import { apiFetchRaw } from '../lib/apiClient';
import { lsGet, lsSet } from '../lib/localStorage';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import TitleBarPrimaryAction from '../components/shell/TitleBarPrimaryAction';
import InlineError from '../components/shared/InlineError';
import Icon from '../components/shared/Icon';
import ToastContainer from '../components/shared/Toast';
import { TP_DRAG_ACCESSIBILITY } from '../lib/drag-announcements';
import { TRIP_FORM_STYLES } from '../components/trip/_tripFormStyles';

interface PoiSearchResult {
  osm_id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  country?: string;
  country_name?: string;
}

const POI_SEARCH_DEBOUNCE_MS = 300;
const POI_SEARCH_MIN_LEN = 2;

const POPULAR_DESTINATIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'okinawa', label: '沖繩' },
  { key: 'tokyo', label: '東京' },
  { key: 'kyoto', label: '京都' },
  { key: 'seoul', label: '首爾' },
  { key: 'bangkok', label: '曼谷' },
  { key: 'taipei', label: '台北' },
];

const LS_KEY_RECENT_DESTS = 'tripline:newtrip:recent-dests';
const RECENT_DESTS_MAX = 5;

function loadRecentDests(): string[] {
  const raw = lsGet<string[]>(LS_KEY_RECENT_DESTS);
  if (!Array.isArray(raw)) return [];
  return raw.filter((s) => typeof s === 'string').slice(0, RECENT_DESTS_MAX);
}

function pushRecentDest(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const cur = loadRecentDests();
  const next = [trimmed, ...cur.filter((d) => d !== trimmed)].slice(0, RECENT_DESTS_MAX);
  lsSet(LS_KEY_RECENT_DESTS, next);
}

/**
 * SCOPED_STYLES for NewTripPage-specific rules:
 *   - .tp-new-page-shell — page background + scroll
 *   - .tp-new-page-form — content max-width form container
 *   - .tp-page-bottom-bar — sticky bottom actions row
 *   - All other form-row / dest-row / segment / btn styles 走 _tripFormStyles.ts
 *     共用 (.tp-new-* prefix 仍 work — comma-selector 含)
 *   - NewTripPage-only: flex-stepper / month carousel / quota / chip-groups
 */
const SCOPED_STYLES = `
.tp-new-page-shell {
  min-height: 100%;
  background: var(--color-secondary);
  height: 100%;
  overflow-y: auto;
}
.tp-new-page-form {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 120px;
  display: flex; flex-direction: column;
}
@media (min-width: 768px) {
  .tp-new-page-form { padding: 32px 24px 120px; }
}

.tp-new-page-sub {
  color: var(--color-muted);
  font-size: var(--font-size-callout);
  margin: 0 0 20px;
  line-height: 1.5;
}

.tp-new-form-row-spaced { margin-top: 16px; }
.tp-new-dest-wrap { position: relative; }
.tp-new-dest-wrap input { font-weight: 600; }

.tp-new-dest-rows { margin-bottom: 10px; }

.tp-new-dest-name .tp-new-dest-region {
  margin-left: 6px;
  color: var(--color-muted);
  font-weight: 500;
}
.tp-new-dest-helper {
  margin: 0 0 10px;
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
}

/* day quota stepper — multi-dest 分配天數 */
.tp-new-quota {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-secondary);
  display: flex; flex-direction: column; gap: 10px;
}
.tp-new-quota-header {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: var(--font-size-footnote);
}
.tp-new-quota-title { font-weight: 700; color: var(--color-foreground); }
.tp-new-quota-sum { color: var(--color-muted); font-variant-numeric: tabular-nums; }
.tp-new-quota-sum.is-mismatch { color: var(--color-priority-high-dot, #c0392b); font-weight: 700; }
.tp-new-quota-rows {
  display: flex; flex-direction: column; gap: 6px;
}
.tp-new-quota-row {
  display: grid; grid-template-columns: 24px 1fr auto; align-items: center;
  gap: 10px; padding: 6px 0;
  font-size: var(--font-size-footnote);
}
.tp-new-quota-num {
  width: 24px; height: 24px; border-radius: 50%;
  background: var(--color-accent); color: var(--color-accent-foreground);
  display: grid; place-items: center;
  font-weight: 700; font-size: var(--font-size-caption2);
}
.tp-new-quota-name { font-weight: 600; color: var(--color-foreground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-new-quota-stepper { display: inline-flex; align-items: center; gap: 6px; }
.tp-new-quota-step-btn {
  width: 28px; height: 28px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-foreground);
  border-radius: var(--radius-md);
  font: inherit; font-weight: 700;
  cursor: pointer;
}
.tp-new-quota-step-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
.tp-new-quota-step-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.tp-new-quota-value {
  min-width: 32px; text-align: center;
  font-weight: 700; font-variant-numeric: tabular-nums;
}

/* 「熱門 / 最近」 chip groups */
.tp-new-dest-chip-group {
  display: flex; flex-direction: column; gap: 6px;
  margin-bottom: 12px;
}
.tp-new-dest-chip-group-label {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
  font-weight: 600;
  letter-spacing: 0.04em;
}
.tp-new-dest-chip-group-list {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.tp-new-dest-chip-quick {
  border: 1px solid var(--color-border);
  background: var(--color-background);
  padding: 6px 12px;
  border-radius: var(--radius-full);
  font: inherit; font-size: var(--font-size-footnote);
  color: var(--color-foreground); cursor: pointer;
  min-height: 32px;
}
.tp-new-dest-chip-quick:hover {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  border-color: var(--color-accent);
}

.tp-new-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tp-new-modal-error {
  color: var(--color-destructive);
  font-size: var(--font-size-footnote);
  margin: 4px 0 0;
}

/* Numeric stepper (flexible mode) */
.tp-new-flex-stepper {
  display: flex; align-items: center; justify-content: center; gap: 16px;
  padding: 12px;
  background: var(--color-secondary); border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.tp-new-flex-step {
  width: 44px; height: 44px;
  border-radius: var(--radius-full);
  border: 1.5px solid var(--color-border);
  background: var(--color-background);
  cursor: pointer;
  display: grid; place-items: center;
  font-size: 22px; color: var(--color-foreground);
}
.tp-new-flex-step:hover:not(:disabled) {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent);
  color: var(--color-accent-deep);
}
.tp-new-flex-step:disabled { opacity: 0.4; cursor: not-allowed; }
.tp-new-flex-num {
  font-size: var(--font-size-large-title, 2.125rem); font-weight: 800;
  color: var(--color-foreground); min-width: 64px; text-align: center;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.tp-new-flex-unit { font-size: var(--font-size-callout); color: var(--color-muted); }

/* Month carousel */
.tp-new-flex-month-label {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  margin: 12px 0 6px; font-weight: 600;
}
.tp-new-flex-months {
  display: flex; gap: 8px; overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: thin;
  -webkit-mask-image: linear-gradient(to right, black calc(100% - 28px), transparent 100%);
  mask-image: linear-gradient(to right, black calc(100% - 28px), transparent 100%);
}
.tp-new-flex-months::-webkit-scrollbar { height: 4px; }
.tp-new-flex-months::-webkit-scrollbar-thumb { background: var(--color-line-strong); border-radius: 2px; }
.tp-new-flex-month {
  flex: 0 0 auto; min-width: 80px;
  font: inherit;
  background: var(--color-secondary);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 10px 8px;
  text-align: center;
  cursor: pointer;
  min-height: var(--spacing-tap-min, 44px);
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  color: var(--color-foreground);
}
.tp-new-flex-month:hover:not(.is-active) {
  border-color: var(--color-accent-bg);
  background: var(--color-accent-subtle);
}
.tp-new-flex-month.is-active {
  background: var(--color-accent);
  color: var(--color-accent-foreground, #fff);
  border-color: var(--color-accent);
}
.tp-new-flex-month .m { font-size: var(--font-size-callout); font-weight: 700; }
.tp-new-flex-month .y { font-size: var(--font-size-caption); opacity: 0.75; }

/* sticky bottom bar 已移到 css/tokens.css .tp-page-bottom-bar 共用。
 * NewTripPage 用 --end variant 把 actions 推到右側 (無 counter)。 */
.tp-new-page-bottom-summary {
  flex: 1;
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tp-new-page-bottom-summary b { color: var(--color-foreground); font-weight: 700; }
`;

const MONTHS_AHEAD = 6;
const DEFAULT_FLEX_DAYS = 5;
const MIN_FLEX_DAYS = 1;
const MAX_FLEX_DAYS = 30;

interface MonthChoice {
  key: string;
  label: string;
  year: number;
  month: number;
}

function buildMonthChoices(now: Date): MonthChoice[] {
  const out: MonthChoice[] = [];
  for (let i = 0; i < MONTHS_AHEAD; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    out.push({
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: `${month + 1} 月`,
      year,
      month,
    });
  }
  return out;
}

function flexDatesFromMonth(monthKey: string, days: number): { start: string; end: string } {
  const [y, m] = monthKey.split('-').map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, 1));
  const end = new Date(Date.UTC(y!, m! - 1, 1));
  end.setUTCDate(end.getUTCDate() + (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'trip'
  );
}

function genTripId(name: string): string {
  const slug = slugify(name);
  const suffix = Date.now().toString(36).slice(-4);
  return `${slug}-${suffix}`.slice(0, 100);
}

interface SortableDestinationRowProps {
  poi: PoiSearchResult;
  index: number;
  onRemove: (osmId: number) => void;
}

function SortableDestinationRow({ poi, index, onRemove }: SortableDestinationRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: poi.osm_id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`tp-new-dest-row ${isDragging ? 'is-dragging' : ''}`}
      data-testid={`new-trip-destination-row-${poi.osm_id}`}
    >
      <button
        type="button"
        className="tp-new-dest-grip"
        aria-label={`拖移目的地：${poi.name}`}
        {...attributes}
        {...listeners}
      >
        <Icon name="arrows-vertical" />
      </button>
      <span className="tp-new-dest-num" aria-hidden="true">{index + 1}</span>
      <span className="tp-new-dest-name">
        {poi.name}
        {poi.country && <span className="tp-new-dest-region">{poi.country}</span>}
      </span>
      <button
        type="button"
        className="tp-new-dest-remove"
        onClick={() => onRemove(poi.osm_id)}
        aria-label={`移除目的地：${poi.name}`}
      >
        <Icon name="x-mark" />
      </button>
    </div>
  );
}

interface SortableDestinationListProps {
  pois: PoiSearchResult[];
  onReorder: (fromIdx: number, toIdx: number) => void;
  onRemove: (osmId: number) => void;
}

function SortableDestinationList({ pois, onReorder, onRemove }: SortableDestinationListProps) {
  function handleDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const fromIdx = pois.findIndex((p) => p.osm_id === e.active.id);
    const toIdx = pois.findIndex((p) => p.osm_id === e.over!.id);
    if (fromIdx < 0 || toIdx < 0) return;
    onReorder(fromIdx, toIdx);
  }
  return (
    <DndContext
      collisionDetection={closestCenter}
      accessibility={TP_DRAG_ACCESSIBILITY}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={pois.map((p) => p.osm_id)} strategy={verticalListSortingStrategy}>
        <div className="tp-new-dest-rows" data-testid="new-trip-destination-rows">
          {pois.map((p, i) => (
            <SortableDestinationRow key={p.osm_id} poi={p} index={i} onRemove={onRemove} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

type DateMode = 'select' | 'flexible';

export default function NewTripPage() {
  const auth = useRequireAuth();
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const handleBack = useNavigateBack(routes.trips());
  const ownerEmail = user?.email ?? '';

  // Destination uses POI autocomplete. User can select multiple POIs.
  const [destQuery, setDestQuery] = useState('');
  const [selectedPois, setSelectedPois] = useState<PoiSearchResult[]>([]);
  const [poiResults, setPoiResults] = useState<PoiSearchResult[] | null>(null);
  const [poiSearching, setPoiSearching] = useState(false);
  const [poiSearchError, setPoiSearchError] = useState<string | null>(null);
  const poiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poiAbortRef = useRef<AbortController | null>(null);

  const [dateMode, setDateMode] = useState<DateMode>('select');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preferences, setPreferences] = useState('');
  const [flexDays, setFlexDays] = useState(DEFAULT_FLEX_DAYS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentDests, setRecentDests] = useState<string[]>([]);

  const [destDays, setDestDays] = useState<Record<number, number>>({});

  // monthChoices 一次計算 — page mount 時。
  const monthChoices = useMemo(() => buildMonthChoices(new Date()), []);
  const [flexMonth, setFlexMonth] = useState<string>(() => monthChoices[0]?.key ?? '');

  // mount 時 load recent dests + reset flex month。
  useEffect(() => {
    setFlexMonth(monthChoices[0]?.key ?? '');
    setRecentDests(loadRecentDests());
  }, [monthChoices]);

  const totalTripDays = useMemo(() => {
    if (dateMode === 'flexible') return flexDays;
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const diff = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    return Number.isFinite(diff) && diff > 0 ? diff : 0;
  }, [dateMode, startDate, endDate, flexDays]);

  useEffect(() => {
    if (selectedPois.length < 2 || totalTripDays <= 0) {
      setDestDays({});
      return;
    }
    const perDest = Math.floor(totalTripDays / selectedPois.length);
    const remainder = totalTripDays - perDest * selectedPois.length;
    const next: Record<number, number> = {};
    selectedPois.forEach((p, i) => {
      next[p.osm_id] = perDest + (i < remainder ? 1 : 0);
    });
    setDestDays(next);
  }, [selectedPois, totalTripDays]);

  const destDaysSum = useMemo(
    () => selectedPois.reduce((s, p) => s + (destDays[p.osm_id] ?? 0), 0),
    [selectedPois, destDays],
  );

  function bumpDestDays(osmId: number, delta: number) {
    setDestDays((prev) => {
      const cur = prev[osmId] ?? 0;
      const next = Math.max(0, cur + delta);
      return { ...prev, [osmId]: next };
    });
  }

  // POI search debounce
  useEffect(() => {
    if (poiDebounceRef.current) clearTimeout(poiDebounceRef.current);
    const trimmed = destQuery.trim();
    if (trimmed.length < POI_SEARCH_MIN_LEN) {
      setPoiResults(null);
      setPoiSearching(false);
      setPoiSearchError(null);
      poiAbortRef.current?.abort();
      return;
    }
    poiDebounceRef.current = setTimeout(async () => {
      poiAbortRef.current?.abort();
      const ctrl = new AbortController();
      poiAbortRef.current = ctrl;
      setPoiSearching(true);
      setPoiSearchError(null);
      try {
        const resp = await fetch(
          `/api/poi-search?q=${encodeURIComponent(trimmed)}&limit=10`,
          { signal: ctrl.signal },
        );
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
    return () => {
      if (poiDebounceRef.current) clearTimeout(poiDebounceRef.current);
    };
  }, [destQuery]);

  function selectPoi(poi: PoiSearchResult) {
    setSelectedPois((prev) => (
      prev.some((p) => p.osm_id === poi.osm_id) ? prev : [...prev, poi]
    ));
    setDestQuery('');
    setPoiResults(null);
    setPoiSearchError(null);
    pushRecentDest(poi.name);
    setRecentDests(loadRecentDests());
  }

  function reorderSelectedPois(fromIdx: number, toIdx: number) {
    setSelectedPois((prev) => arrayMove(prev, fromIdx, toIdx));
  }
  function removeSelectedPoi(osmId: number) {
    setSelectedPois((prev) => prev.filter((p) => p.osm_id !== osmId));
  }


  function adjustFlexDays(delta: number) {
    setFlexDays((d) => Math.min(MAX_FLEX_DAYS, Math.max(MIN_FLEX_DAYS, d + delta)));
  }

  const datesValid = dateMode === 'flexible' ? !!flexMonth && flexDays >= MIN_FLEX_DAYS : !!startDate && !!endDate;
  const canSubmit = selectedPois.length > 0 && datesValid && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || selectedPois.length === 0) return;
    setSubmitting(true);
    setError(null);
    const tripName = selectedPois.map((poi) => poi.name).join('、');
    const tripId = genTripId(tripName);
    const dates = dateMode === 'flexible'
      ? flexDatesFromMonth(flexMonth, flexDays)
      : { start: startDate, end: endDate };
    const countries = Array.from(new Set(selectedPois.map((poi) => poi.country || 'JP'))).join(',');
    let combinedDescription = preferences.trim();
    if (selectedPois.length >= 2 && totalTripDays > 0 && destDaysSum === totalTripDays) {
      const allocation = selectedPois
        .map((p) => `${p.name} ${destDays[p.osm_id] ?? 0} 天`)
        .join(' / ');
      const note = `目的地天數分配：${allocation}`;
      combinedDescription = combinedDescription ? `${combinedDescription}\n\n${note}` : note;
    }
    const destinationsPayload = selectedPois.map((poi) => ({
      name: poi.name,
      lat: poi.lat,
      lng: poi.lng,
      osm_id: poi.osm_id,
      day_quota: selectedPois.length >= 2 ? destDays[poi.osm_id] ?? null : null,
    }));
    try {
      const res = await apiFetchRaw('/trips', {
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({
          id: tripId,
          name: tripName,
          owner: ownerEmail,
          startDate: dates.start,
          endDate: dates.end,
          countries,
          description: combinedDescription || undefined,
          published: 1,
          destinations: destinationsPayload,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = '建立行程失敗，請稍後再試。';
        try {
          const data = JSON.parse(text) as { error?: { code?: string; message?: string } };
          const errMsg = data?.error?.message;
          if (errMsg) message = errMsg;
        } catch { /* not JSON */ }
        throw new Error(message);
      }
      const data = (await res.json()) as { tripId: string };
      // 廣播 tp-trip-created event 讓 TripsListPage refresh list
      window.dispatchEvent(new CustomEvent('tp-trip-created', { detail: { tripId: data.tripId } }));
      navigate(`/trips?selected=${encodeURIComponent(data.tripId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立行程失敗。');
      setSubmitting(false);
    }
  }

  if (!auth.user) return null;

  const destShown = selectedPois.map((poi) => poi.name).join('、');
  const summaryText = dateMode === 'flexible'
    ? destShown
      ? `${destShown} · ${flexDays} 天 · ${flexMonth ? monthChoices.find((m) => m.key === flexMonth)?.label : ''}`
      : '請先選擇目的地'
    : destShown
      ? `${destShown}${startDate && endDate ? ` · ${startDate} – ${endDate}` : ''}`
      : '請先選擇目的地';

  const titleBarActions = (
    <TitleBarPrimaryAction
      label="建立行程"
      busyLabel="建立中⋯"
      busy={submitting}
      disabled={!canSubmit}
      onClick={() => {
        const form = document.getElementById('new-trip-form') as HTMLFormElement | null;
        if (form) form.requestSubmit();
      }}
      testId="new-trip-titlebar-create"
    />
  );

  return (
    <>
      <ToastContainer />
      <AppShell
        sidebar={<DesktopSidebarConnected />}
        main={
          <div className="tp-new-page-shell" data-testid="new-trip-page">
            <style>{TRIP_FORM_STYLES}</style>
            <style>{SCOPED_STYLES}</style>
            <TitleBar
              title="新增行程"
              back={handleBack}
              backLabel="返回前頁"
              actions={titleBarActions}
            />

            <form id="new-trip-form" onSubmit={handleSubmit} className="tp-new-page-form">

              <div className="tp-new-form-row">
                <label htmlFor="new-trip-destination">目的地（可加多筆，拖拉排序）</label>
                <div className="tp-new-dest-wrap">
                  {selectedPois.length > 0 && (
                    <SortableDestinationList
                      pois={selectedPois}
                      onReorder={reorderSelectedPois}
                      onRemove={removeSelectedPoi}
                    />
                  )}
                  {selectedPois.length >= 2 && (
                    <p className="tp-new-dest-helper" data-testid="new-trip-destination-helper">
                      行程跨 {selectedPois.length} 個目的地 · 順序決定地圖 polyline 串接方向
                    </p>
                  )}
                  {selectedPois.length >= 2 && totalTripDays > 0 && (
                    <div className="tp-new-quota" data-testid="new-trip-quota">
                      <div className="tp-new-quota-header">
                        <span className="tp-new-quota-title">分配天數</span>
                        <span
                          className={`tp-new-quota-sum ${destDaysSum !== totalTripDays ? 'is-mismatch' : ''}`}
                          data-testid="new-trip-quota-sum"
                        >
                          已分配 {destDaysSum} / {totalTripDays} 天
                        </span>
                      </div>
                      <div className="tp-new-quota-rows">
                        {selectedPois.map((p, i) => (
                          <div key={p.osm_id} className="tp-new-quota-row" data-testid={`new-trip-quota-row-${p.osm_id}`}>
                            <span className="tp-new-quota-num" aria-hidden="true">{i + 1}</span>
                            <span className="tp-new-quota-name">{p.name}</span>
                            <div className="tp-new-quota-stepper">
                              <button
                                type="button"
                                className="tp-new-quota-step-btn"
                                onClick={() => bumpDestDays(p.osm_id, -1)}
                                disabled={(destDays[p.osm_id] ?? 0) <= 0}
                                aria-label={`${p.name} 減 1 天`}
                                data-testid={`new-trip-quota-minus-${p.osm_id}`}
                              >
                                −
                              </button>
                              <span className="tp-new-quota-value" data-testid={`new-trip-quota-value-${p.osm_id}`}>
                                {destDays[p.osm_id] ?? 0}
                              </span>
                              <button
                                type="button"
                                className="tp-new-quota-step-btn"
                                onClick={() => bumpDestDays(p.osm_id, +1)}
                                aria-label={`${p.name} 加 1 天`}
                                data-testid={`new-trip-quota-plus-${p.osm_id}`}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <input
                    id="new-trip-destination"
                    type="text"
                    value={destQuery}
                    onChange={(e) => setDestQuery(e.target.value)}
                    placeholder={selectedPois.length > 0 ? '繼續搜尋下一個目的地⋯' : '搜尋景點、城市、地址⋯'}
                    required={selectedPois.length === 0}
                    autoFocus
                    autoComplete="off"
                    data-testid="new-trip-destination-input"
                  />
                  {(poiSearching || poiResults || poiSearchError) && destQuery.trim().length >= POI_SEARCH_MIN_LEN && (
                    <div className="tp-new-dest-dropdown" role="listbox" data-testid="new-trip-dest-dropdown">
                      {poiSearching && <div className="tp-new-dest-status">搜尋中⋯</div>}
                      {!poiSearching && poiSearchError && <div className="tp-new-dest-status">{poiSearchError}</div>}
                      {!poiSearching && !poiSearchError && poiResults && poiResults.length === 0 && (
                        <div className="tp-new-dest-status">沒找到結果，試試別的關鍵字</div>
                      )}
                      {!poiSearching && poiResults && poiResults.length > 0 && poiResults.map((p) => (
                        <button
                          key={p.osm_id}
                          type="button"
                          role="option"
                          className="tp-new-dest-result"
                          onClick={() => selectPoi(p)}
                          data-testid={`new-trip-dest-result-${p.osm_id}`}
                        >
                          <span className="name">{p.name}</span>
                          <span className="addr">{p.address}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {destQuery.trim().length === 0 && (
                  <>
                    <div className="tp-new-dest-chip-group" data-testid="new-trip-popular-dests">
                      <div className="tp-new-dest-chip-group-label">熱門目的地</div>
                      <div className="tp-new-dest-chip-group-list">
                        {POPULAR_DESTINATIONS.map((d) => (
                          <button
                            key={d.key}
                            type="button"
                            className="tp-new-dest-chip-quick"
                            onClick={() => setDestQuery(d.label)}
                            data-testid={`new-trip-popular-dest-${d.key}`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {recentDests.length > 0 && (
                      <div className="tp-new-dest-chip-group" data-testid="new-trip-recent-dests">
                        <div className="tp-new-dest-chip-group-label">最近搜尋</div>
                        <div className="tp-new-dest-chip-group-list">
                          {recentDests.map((name) => (
                            <button
                              key={name}
                              type="button"
                              className="tp-new-dest-chip-quick"
                              onClick={() => setDestQuery(name)}
                              data-testid={`new-trip-recent-dest-${name}`}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="tp-new-form-row">
                <label>日期</label>
                <div
                  className="tp-new-segmented"
                  role="tablist"
                  aria-label="日期模式"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={dateMode === 'select'}
                    className={dateMode === 'select' ? 'is-active' : ''}
                    onClick={() => setDateMode('select')}
                    data-testid="new-trip-date-mode-select"
                  >
                    固定日期
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={dateMode === 'flexible'}
                    className={dateMode === 'flexible' ? 'is-active' : ''}
                    onClick={() => setDateMode('flexible')}
                    data-testid="new-trip-date-mode-flexible"
                  >
                    大概時間
                  </button>
                </div>
              </div>

              {dateMode === 'select' ? (
                <div className="tp-new-form-grid">
                  <div className="tp-new-form-row">
                    <label htmlFor="new-trip-start">出發</label>
                    <input
                      id="new-trip-start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      data-testid="new-trip-start-input"
                    />
                  </div>
                  <div className="tp-new-form-row">
                    <label htmlFor="new-trip-end">回程</label>
                    <input
                      id="new-trip-end"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      min={startDate || undefined}
                      data-testid="new-trip-end-input"
                    />
                  </div>
                </div>
              ) : (
                <div data-testid="new-trip-flex-block">
                  <div className="tp-new-flex-stepper" data-testid="new-trip-flex-stepper">
                    <button
                      type="button"
                      className="tp-new-flex-step"
                      onClick={() => adjustFlexDays(-1)}
                      disabled={flexDays <= MIN_FLEX_DAYS}
                      aria-label="減少一天"
                      data-testid="new-trip-flex-day-minus"
                    >
                      −
                    </button>
                    <div className="tp-new-flex-num" data-testid="new-trip-flex-days">{flexDays}</div>
                    <span className="tp-new-flex-unit">天</span>
                    <button
                      type="button"
                      className="tp-new-flex-step"
                      onClick={() => adjustFlexDays(+1)}
                      disabled={flexDays >= MAX_FLEX_DAYS}
                      aria-label="增加一天"
                      data-testid="new-trip-flex-day-plus"
                    >
                      +
                    </button>
                  </div>

                  <div className="tp-new-flex-month-label">大概什麼時候出發？</div>
                  <div className="tp-new-flex-months" data-testid="new-trip-flex-months" role="radiogroup" aria-label="出發月份">
                    {monthChoices.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        role="radio"
                        aria-pressed={flexMonth === m.key}
                        aria-checked={flexMonth === m.key}
                        className={`tp-new-flex-month${flexMonth === m.key ? ' is-active' : ''}`}
                        onClick={() => setFlexMonth(m.key)}
                        data-testid={`new-trip-flex-month-${m.key}`}
                      >
                        <span className="m">{m.label}</span>
                        <span className="y">{m.year}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="tp-new-form-row tp-new-form-row-spaced">
                <label htmlFor="new-trip-preferences">想做什麼？（選填）</label>
                <textarea
                  id="new-trip-preferences"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  placeholder="想去溫泉、別太累、預算 5 萬 / 兩人..."
                  rows={3}
                  maxLength={2000}
                  data-testid="new-trip-preferences-input"
                />
              </div>

              {error && <InlineError message={error} testId="new-trip-error" />}
            </form>

            <div className="tp-page-bottom-bar tp-page-bottom-bar--end">
              <div className="tp-new-page-bottom-summary"><b>{summaryText}</b></div>
              <button
                type="button"
                className="tp-new-modal-btn"
                onClick={handleBack}
                disabled={submitting}
                data-testid="new-trip-cancel"
              >
                取消
              </button>
              <button
                type="submit"
                form="new-trip-form"
                className="tp-new-modal-btn tp-new-modal-btn-primary"
                disabled={!canSubmit}
                data-testid="new-trip-submit"
              >
                {submitting ? '建立中⋯' : '建立行程'}
              </button>
            </div>
          </div>
        }
        bottomNav={<GlobalBottomNav authed={!!user} />}
      />
    </>
  );
}
