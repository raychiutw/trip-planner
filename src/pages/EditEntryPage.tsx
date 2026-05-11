/**
 * EditEntryPage — v2.26.0 全頁編輯 entry（時間 + 從上一站移動方式 + 備註）。
 *
 * Route: `/trip/:tripId/stop/:entryId/edit`
 * 對應 mockup: `docs/design-sessions/2026-05-11-entry-time-segment-mode-edit.html`
 *
 * Layout（沿用 EditTripPage / ChangePoiPage pattern）:
 *   AppShell
 *     sidebar: DesktopSidebarConnected
 *     main:
 *       TitleBar(編輯景點)  ← 左 ← back / 右「儲存」TitleBarPrimaryAction
 *       content: 三 sections
 *         1. 時間 — startTime / endTime "HH:MM" inputs + 停留分鐘 chip
 *         2. 從上一站移動 — segmented control (driving/walking/transit) + lock + transit min
 *         3. 備註 — textarea (Markdown supported)
 *     bottomNav: GlobalBottomNav
 *
 * 進入路徑：TimelineRail expanded toolbar pencil icon → navigate.
 *
 * 儲存策略（並行 PATCH）：
 *   - dirty.entry → PATCH /trips/:id/entries/:eid { start_time, end_time, note }
 *   - dirty.segment → PATCH /trips/:id/segments/:sid { mode, min }
 *   - 兩者皆失敗 → 整體 error；單邊失敗 → 顯示警示但保留 dirty 值。
 *
 * 取消（左 ←）：dirty 跳 ConfirmModal「丟棄變更」 → confirm 才 navigate。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import TitleBarPrimaryAction from '../components/shell/TitleBarPrimaryAction';
import ConfirmModal from '../components/shared/ConfirmModal';
import Icon from '../components/shared/Icon';
import InlineError from '../components/shared/InlineError';
import ToastContainer, { showToast } from '../components/shared/Toast';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useTripSegments, type TripSegment } from '../hooks/useTripSegments';
import { apiFetch, apiFetchRaw } from '../lib/apiClient';

const SCOPED_STYLES = `
.tp-edit-entry {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 96px;
  display: flex; flex-direction: column;
}
@media (min-width: 768px) {
  .tp-edit-entry { padding: 32px 24px 96px; }
}

.tp-edit-entry-poi {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  background: var(--color-secondary);
  border-radius: var(--radius-lg);
  margin-bottom: 28px;
}
.tp-edit-entry-poi-icon {
  width: 44px; height: 44px;
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  border-radius: var(--radius-md);
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.tp-edit-entry-poi-icon .svg-icon { width: 20px; height: 20px; }
.tp-edit-entry-poi-meta { flex: 1; min-width: 0; }
.tp-edit-entry-poi-name {
  font-weight: 700; font-size: var(--font-size-headline);
  color: var(--color-foreground);
}
.tp-edit-entry-poi-sub {
  color: var(--color-muted); font-size: var(--font-size-footnote);
  margin-top: 2px;
}

.tp-edit-entry-section { margin-bottom: 28px; }
.tp-edit-entry-section-h {
  display: flex; align-items: center; gap: 8px;
  margin: 0 0 12px;
  font-size: var(--font-size-eyebrow, 0.75rem);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-muted);
}
.tp-edit-entry-section-h .svg-icon { width: 12px; height: 12px; }
.tp-edit-entry-section-aux {
  margin-left: auto;
  font-size: var(--font-size-caption);
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: var(--color-muted);
}
.tp-edit-entry-section-aux.is-lock {
  display: inline-flex; align-items: center; gap: 4px;
  color: var(--color-accent-deep);
  font-weight: 700;
}
.tp-edit-entry-section-aux.is-lock .svg-icon { width: 10px; height: 10px; }

/* Time row */
.tp-edit-entry-time-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  align-items: center;
}
.tp-edit-entry-time-card {
  display: flex; flex-direction: column; gap: 2px;
  background: var(--color-background);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  transition: all 120ms;
}
.tp-edit-entry-time-card:focus-within {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-edit-entry-time-card label {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  font-weight: 600;
}
.tp-edit-entry-time-card input {
  font: inherit;
  font-variant-numeric: tabular-nums;
  font-size: var(--font-size-title2);
  font-weight: 700;
  color: var(--color-foreground);
  border: 0; background: transparent; outline: none; padding: 0;
  width: 100%;
  min-height: 32px;
}
.tp-edit-entry-time-arrow {
  display: flex; align-items: center; justify-content: center;
  color: var(--color-muted);
}
.tp-edit-entry-time-arrow .svg-icon { width: 18px; height: 18px; }
.tp-edit-entry-duration {
  display: inline-flex; align-items: center; gap: 4px;
  margin: 10px 0 0;
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
  background: var(--color-secondary);
  padding: 4px 12px;
  border-radius: var(--radius-full);
}
.tp-edit-entry-duration .svg-icon { width: 12px; height: 12px; }

/* Mode segmented */
.tp-edit-entry-mode-segmented {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  background: var(--color-secondary);
  border-radius: var(--radius-md);
  padding: 4px;
}
.tp-edit-entry-mode-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  padding: 12px 6px;
  border: 0;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font: inherit;
  color: var(--color-muted);
  transition: all 120ms;
  min-height: 64px;
}
.tp-edit-entry-mode-btn:hover {
  background: var(--color-background);
  color: var(--color-foreground);
}
.tp-edit-entry-mode-btn.is-selected {
  background: var(--color-background);
  box-shadow: var(--shadow-md);
  color: var(--color-foreground);
}
.tp-edit-entry-mode-btn .svg-icon { width: 22px; height: 22px; color: var(--color-muted); }
.tp-edit-entry-mode-btn.is-selected .svg-icon { color: var(--color-accent); }
.tp-edit-entry-mode-lab { font-size: var(--font-size-footnote); font-weight: 600; }
.tp-edit-entry-mode-btn.is-selected .tp-edit-entry-mode-lab { font-weight: 700; }

.tp-edit-entry-mode-detail {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; flex-wrap: wrap;
  padding: 12px 16px;
  margin-top: 12px;
  background: var(--color-secondary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
}
.tp-edit-entry-mode-detail strong {
  color: var(--color-foreground); font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.tp-edit-entry-reset {
  font: inherit; font-size: var(--font-size-caption); font-weight: 600;
  color: var(--color-accent); background: transparent;
  border: 0; cursor: pointer;
  padding: 4px 8px; border-radius: var(--radius-sm);
}
.tp-edit-entry-reset:hover {
  background: var(--color-accent-subtle);
}

.tp-edit-entry-transit {
  margin-top: 12px;
  display: flex; align-items: center; gap: 8px;
  flex-wrap: wrap;
  background: var(--color-secondary);
  border-radius: var(--radius-md);
  padding: 12px 16px;
}
.tp-edit-entry-transit label {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  font-weight: 600;
}
.tp-edit-entry-transit input {
  font: inherit;
  font-variant-numeric: tabular-nums;
  font-size: var(--font-size-headline);
  font-weight: 700;
  color: var(--color-foreground);
  border: 1.5px solid var(--color-accent);
  background: var(--color-background);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  width: 90px;
  outline: none;
  text-align: center;
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-edit-entry-transit-unit {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
}

.tp-edit-entry-note {
  width: 100%;
  font: inherit;
  font-size: var(--font-size-callout);
  line-height: 1.55;
  background: var(--color-background);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  resize: vertical;
  min-height: 120px;
  color: var(--color-foreground);
  transition: all 120ms;
}
.tp-edit-entry-note:hover { border-color: var(--color-line-strong); }
.tp-edit-entry-note:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
  outline: none;
}
.tp-edit-entry-note-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 6px;
  font-size: var(--font-size-caption);
  color: var(--color-muted);
}
.tp-edit-entry-note-toolbar .markdown-hint { font-style: italic; }

.tp-edit-entry-error {
  margin-top: 12px;
}

/* discard-changes 用 shared <ConfirmModal>（沒額外樣式） */
`;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const POI_TYPE_ICON: Record<string, string> = {
  hotel: 'hotel',
  restaurant: 'utensils',
  shopping: 'shopping',
  attraction: 'location-pin',
  transport: 'car',
  parking: 'parking',
  activity: 'sparkle',
};
const POI_TYPE_LABEL: Record<string, string> = {
  hotel: '住宿',
  restaurant: '餐廳',
  shopping: '購物',
  attraction: '景點',
  transport: '交通',
  parking: '停車',
  activity: '活動',
};
const MODE_LABEL: Record<TripSegment['mode'], string> = {
  driving: '開車',
  walking: '步行',
  transit: '大眾運輸',
};
const MODE_ICON: Record<TripSegment['mode'], string> = {
  driving: 'car',
  walking: 'walking',
  transit: 'bus',
};

// API 走 json() 自動 deepCamel — 必須用 camelCase 讀，不是 DB snake_case。
// v2.26.0 ship 時 interface 寫成 snake_case → 全部讀回 undefined（time 空白、
// POI 卡 + 移動方式 section 全消失）。Regression test fixture 也跟著錯，CI 沒抓到。
interface EntryApi {
  id: number;
  dayId: number;
  title?: string | null;
  time?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  note?: string | null;
  poiId?: number | null;
}

interface DayApi {
  id?: number;
  dayNum?: number;
  timeline?: Array<{
    id?: number | null;
    title?: string | null;
    poiType?: string | null;
  }>;
}

function durationMinutes(start: string, end: string): number | null {
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return null;
  const sParts = start.split(':');
  const eParts = end.split(':');
  if (sParts.length < 2 || eParts.length < 2) return null;
  const sh = Number(sParts[0]); const sm = Number(sParts[1]);
  const eh = Number(eParts[0]); const em = Number(eParts[1]);
  if (!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(eh) || !Number.isFinite(em)) return null;
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff : null;
}

function formatKm(m: number | null): string | null {
  if (typeof m !== 'number' || m <= 0) return null;
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 50) * 50} m`;
}

export default function EditEntryPage() {
  const { tripId, entryId: entryIdParam } = useParams<{ tripId: string; entryId: string }>();
  const entryId = Number(entryIdParam);
  const navigate = useNavigate();
  const goBackHref = tripId ? `/trips?selected=${encodeURIComponent(tripId)}` : '/trips';
  const goBack = useNavigateBack(goBackHref);
  const { user } = useCurrentUser();

  const [entry, setEntry] = useState<EntryApi | null>(null);
  const [poiInfo, setPoiInfo] = useState<{ name: string; poiType: string | null } | null>(null);
  const [prevEntry, setPrevEntry] = useState<{ id: number; title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<TripSegment['mode'] | null>(null);
  const [transitMin, setTransitMin] = useState<string>('');

  // Original values for dirty-check + discard-modal
  const originalRef = useRef<{
    startTime: string; endTime: string; note: string;
    mode: TripSegment['mode'] | null; transitMin: string;
  }>({ startTime: '', endTime: '', note: '', mode: null, transitMin: '' });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const { segmentMap } = useTripSegments(tripId);

  // Load entry
  useEffect(() => {
    if (!tripId || !Number.isInteger(entryId) || entryId <= 0) {
      setLoadError('無效的 entry ID');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<EntryApi>(`/trips/${encodeURIComponent(tripId)}/entries/${entryId}`);
        if (cancelled) return;
        setEntry(data);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : '載入失敗');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tripId, entryId]);

  // Once entry is loaded, fetch the day for prev-entry context + POI meta
  useEffect(() => {
    if (!entry || !tripId) return;
    let cancelled = false;
    (async () => {
      try {
        // entry.dayId → dayNum — fetch via days endpoint pattern: GET /trips/:id/days
        const days = await apiFetch<Array<{ id: number; dayNum: number }>>(`/trips/${encodeURIComponent(tripId)}/days`);
        if (cancelled) return;
        const day = days.find((d) => d.id === entry.dayId);
        if (!day) return;
        const dayData = await apiFetch<DayApi & { timeline?: Array<{ id?: number | null; title?: string | null; poiType?: string | null }> }>(
          `/trips/${encodeURIComponent(tripId)}/days/${day.dayNum}`,
        );
        if (cancelled) return;
        const timeline = Array.isArray(dayData.timeline) ? dayData.timeline : [];
        const idx = timeline.findIndex((e) => e.id === entryId);
        const me = idx >= 0 ? timeline[idx] : null;
        if (me) {
          setPoiInfo({
            name: me.title ?? entry.title ?? '景點',
            poiType: me.poiType ?? null,
          });
        }
        const prev = idx > 0 ? timeline[idx - 1] : null;
        if (prev?.id != null && prev.title) {
          setPrevEntry({ id: prev.id, title: prev.title });
        }
      } catch {
        // graceful — don't block edit
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entry, tripId, entryId]);

  // Init form once entry + segmentMap available
  useEffect(() => {
    if (!entry) return;
    const initialStart = entry.startTime ?? '';
    const initialEnd = entry.endTime ?? '';
    setStartTime(initialStart);
    setEndTime(initialEnd);
    setNote(entry.note ?? '');
    originalRef.current = {
      ...originalRef.current,
      startTime: initialStart,
      endTime: initialEnd,
      note: entry.note ?? '',
    };
  }, [entry]);

  const segment = useMemo(() => {
    if (!prevEntry || !Number.isInteger(entryId)) return undefined;
    return segmentMap.get(`${prevEntry.id}-${entryId}`);
  }, [prevEntry, entryId, segmentMap]);

  useEffect(() => {
    if (!segment) return;
    setMode(segment.mode);
    setTransitMin(segment.mode === 'transit' && typeof segment.min === 'number' ? String(segment.min) : '');
    originalRef.current = {
      ...originalRef.current,
      mode: segment.mode,
      transitMin: segment.mode === 'transit' && typeof segment.min === 'number' ? String(segment.min) : '',
    };
  }, [segment]);

  const validation = useMemo(() => {
    if (startTime && !TIME_RE.test(startTime)) return '抵達時間格式錯誤（HH:MM）';
    if (endTime && !TIME_RE.test(endTime)) return '離開時間格式錯誤（HH:MM）';
    if (startTime && endTime && startTime >= endTime) return '抵達時間需早於離開時間';
    if (mode === 'transit') {
      const n = parseInt(transitMin, 10);
      if (!Number.isFinite(n) || n < 1 || n > 1440) return '大眾運輸需填 1–1440 分鐘';
    }
    return null;
  }, [startTime, endTime, mode, transitMin]);

  const dirty = useMemo(() => {
    const o = originalRef.current;
    const entryDirty = startTime !== o.startTime || endTime !== o.endTime || note !== o.note;
    const segmentDirty = mode !== o.mode || (mode === 'transit' && transitMin !== o.transitMin);
    return { entryDirty, segmentDirty, any: entryDirty || segmentDirty };
  }, [startTime, endTime, note, mode, transitMin]);

  const stayMinutes = useMemo(() => {
    if (!startTime || !endTime) return null;
    return durationMinutes(startTime, endTime);
  }, [startTime, endTime]);

  const handleSave = useCallback(async () => {
    if (!tripId || !entry || submitting) return;
    if (validation || !dirty.any) return;
    setSubmitting(true);
    setError(null);

    const requests: Promise<{ scope: 'entry' | 'segment'; ok: boolean; status: number; text?: string }>[] = [];

    if (dirty.entryDirty) {
      const body: Record<string, unknown> = {};
      if (startTime !== originalRef.current.startTime) body.start_time = startTime || null;
      if (endTime !== originalRef.current.endTime) body.end_time = endTime || null;
      if (note !== originalRef.current.note) body.note = note;
      requests.push(
        apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/entries/${entryId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        }).then(async (res) => ({ scope: 'entry', ok: res.ok, status: res.status, text: res.ok ? undefined : await res.text() })),
      );
    }

    if (dirty.segmentDirty && segment && mode) {
      const body: Record<string, unknown> = { mode };
      if (mode === 'transit') {
        body.min = parseInt(transitMin, 10);
      }
      requests.push(
        apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/segments/${segment.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        }).then(async (res) => ({ scope: 'segment', ok: res.ok, status: res.status, text: res.ok ? undefined : await res.text() })),
      );
    }

    try {
      const results = await Promise.all(requests);
      const failures = results.filter((r) => !r.ok);
      if (failures.length === 0) {
        // 通知 timeline + segments 重新 fetch
        window.dispatchEvent(new CustomEvent('tp-entry-updated', { detail: { tripId, entryId } }));
        if (dirty.segmentDirty) {
          window.dispatchEvent(new CustomEvent('tp-segment-updated', { detail: { tripId, segmentId: segment?.id } }));
        }
        showToast('已儲存', 'success');
        navigate(goBackHref, { replace: true });
        return;
      }
      const msg = failures
        .map((f) => `${f.scope === 'entry' ? '景點' : '移動方式'}儲存失敗 (${f.status})`)
        .join('；');
      setError(msg);
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗');
      setSubmitting(false);
    }
  }, [
    tripId, entry, entryId, submitting, validation, dirty,
    startTime, endTime, note, mode, transitMin, segment, navigate, goBackHref,
  ]);

  const handleCancel = useCallback(() => {
    if (dirty.any) {
      setShowDiscardModal(true);
    } else {
      goBack();
    }
  }, [dirty.any, goBack]);

  const resetMode = useCallback(() => {
    if (segment) {
      setMode(segment.modeSource === 'auto' ? segment.mode : null);
    }
    // mode='auto' 我們無法直接 PATCH; user 留 mode 不變相當於不送 segment PATCH
  }, [segment]);

  // ⌘+Enter / ⌘+S 儲存
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Enter' || e.key === 's')) {
        e.preventDefault();
        void handleSave();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave, handleCancel]);

  const titleBarActions = (
    <TitleBarPrimaryAction
      label="儲存"
      busyLabel="儲存中⋯"
      busy={submitting}
      disabled={!dirty.any || !!validation}
      onClick={() => void handleSave()}
      testId="edit-entry-titlebar-save"
    />
  );

  const main = (
    <div className="tp-app">
      <style>{SCOPED_STYLES}</style>
      <TitleBar
        title="編輯景點"
        back={handleCancel}
        backLabel="返回行程"
        actions={titleBarActions}
      />
      <main className="tp-page-content">
        <div className="tp-edit-entry">
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-muted)' }}>
              載入中…
            </div>
          ) : loadError ? (
            <InlineError message={loadError} />
          ) : entry ? (
            <>
              {poiInfo && (
                <div className="tp-edit-entry-poi" data-testid="edit-entry-poi-summary">
                  <span className="tp-edit-entry-poi-icon">
                    <Icon name={POI_TYPE_ICON[poiInfo.poiType ?? 'attraction'] ?? 'location-pin'} />
                  </span>
                  <div className="tp-edit-entry-poi-meta">
                    <div className="tp-edit-entry-poi-name">{poiInfo.name}</div>
                    <div className="tp-edit-entry-poi-sub">
                      {POI_TYPE_LABEL[poiInfo.poiType ?? 'attraction'] ?? '景點'}
                    </div>
                  </div>
                </div>
              )}

              {/* Time section */}
              <section className="tp-edit-entry-section" data-testid="edit-entry-time-section">
                <h2 className="tp-edit-entry-section-h">
                  <Icon name="clock" />
                  <span>時間</span>
                </h2>
                <div className="tp-edit-entry-time-row">
                  <label className="tp-edit-entry-time-card">
                    <span>抵達</span>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      placeholder="HH:MM"
                      data-testid="edit-entry-start-time"
                    />
                  </label>
                  <span className="tp-edit-entry-time-arrow" aria-hidden="true">
                    <Icon name="arrow-right" />
                  </span>
                  <label className="tp-edit-entry-time-card">
                    <span>離開</span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      placeholder="HH:MM"
                      data-testid="edit-entry-end-time"
                    />
                  </label>
                </div>
                {stayMinutes != null && (
                  <div className="tp-edit-entry-duration" data-testid="edit-entry-duration">
                    <Icon name="clock" />
                    停留 {stayMinutes} 分鐘
                  </div>
                )}
              </section>

              {/* Mode section — 只有當有 prev entry + 有 segment 才顯示 */}
              {prevEntry && (
                <section className="tp-edit-entry-section" data-testid="edit-entry-mode-section">
                  <h2 className="tp-edit-entry-section-h">
                    <Icon name="car" />
                    <span>從「{prevEntry.title}」移動</span>
                    {segment?.modeSource === 'user' && (
                      <span className="tp-edit-entry-section-aux is-lock">
                        <Icon name="lock" />
                        手動覆寫
                      </span>
                    )}
                  </h2>
                  {segment ? (
                    <>
                      <div className="tp-edit-entry-mode-segmented" role="radiogroup" aria-label="移動方式">
                        {(['driving', 'walking', 'transit'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            role="radio"
                            aria-checked={mode === m}
                            className={`tp-edit-entry-mode-btn ${mode === m ? 'is-selected' : ''}`}
                            onClick={() => setMode(m)}
                            data-testid={`edit-entry-mode-${m}`}
                          >
                            <Icon name={MODE_ICON[m]} />
                            <span className="tp-edit-entry-mode-lab">{MODE_LABEL[m]}</span>
                          </button>
                        ))}
                      </div>
                      {mode !== 'transit' && (
                        <div className="tp-edit-entry-mode-detail">
                          <span>
                            {typeof segment.min === 'number' && segment.min > 0 ? (
                              <><strong>{segment.min} min</strong>{segment.distanceM ? ` · ${formatKm(segment.distanceM)}` : ''}</>
                            ) : (
                              '系統估算'
                            )}
                          </span>
                          <span style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-caption)' }}>
                            {segment.source === 'google' ? 'Google Routes 自動' : segment.source ?? '系統估算'}
                          </span>
                        </div>
                      )}
                      {mode === 'transit' && (
                        <div className="tp-edit-entry-transit">
                          <label htmlFor="edit-entry-transit-min">分鐘</label>
                          <input
                            id="edit-entry-transit-min"
                            type="number"
                            min="1"
                            max="1440"
                            value={transitMin}
                            onChange={(e) => setTransitMin(e.target.value)}
                            data-testid="edit-entry-transit-min"
                          />
                          <span className="tp-edit-entry-transit-unit">
                            min · Japan Google Routes 沒 transit 資料，請手動填
                          </span>
                          {segment.modeSource === 'user' && segment.mode !== 'transit' && (
                            <button type="button" className="tp-edit-entry-reset" onClick={resetMode}>
                              重設為自動
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-footnote)', margin: 0 }}>
                      尚未有移動段資料（recompute travel 後將出現）
                    </p>
                  )}
                </section>
              )}

              {/* Note section */}
              <section className="tp-edit-entry-section" data-testid="edit-entry-note-section">
                <h2 className="tp-edit-entry-section-h">
                  <Icon name="pencil" />
                  <span>備註</span>
                </h2>
                <textarea
                  className="tp-edit-entry-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="加備註… (例：必點山苦瓜炒麵，週三休息)"
                  maxLength={1000}
                  data-testid="edit-entry-note"
                />
                <div className="tp-edit-entry-note-toolbar">
                  <span className="markdown-hint">支援 Markdown · ⌘+S 儲存</span>
                  <span data-testid="edit-entry-note-counter">{note.length} / 1000</span>
                </div>
              </section>

              {validation && (
                <div className="tp-edit-entry-error" data-testid="edit-entry-validation">
                  <InlineError message={validation} />
                </div>
              )}
              {error && (
                <div className="tp-edit-entry-error" data-testid="edit-entry-save-error">
                  <InlineError message={error} />
                </div>
              )}
            </>
          ) : null}
        </div>
      </main>

      {/* Discard confirm modal — shared <ConfirmModal> 取代 inline rolled-own */}
      <ConfirmModal
        open={showDiscardModal}
        title="丟棄變更？"
        message="未儲存的變更會遺失。"
        confirmLabel="丟棄變更"
        cancelLabel="繼續編輯"
        onConfirm={() => { setShowDiscardModal(false); goBack(); }}
        onCancel={() => setShowDiscardModal(false)}
      />
    </div>
  );

  return (
    <>
      <ToastContainer />
      <AppShell
        sidebar={<DesktopSidebarConnected />}
        main={main}
        bottomNav={<GlobalBottomNav authed={!!user} />}
      />
    </>
  );
}
