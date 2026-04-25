/**
 * TripsPreviewSheet — read-only preview rail for /trips landing page.
 *
 * Lifts the mockup-trip-v2.html `.day-strip` + `.rail-*` patterns verbatim
 * (per user spec: desktop preview AND mobile day-switcher should share the
 * same horizontal scrollable day-chip format).
 *
 * Layout:
 *   header (chrome ✕ ⇤ ↗ ⋯)
 *   title row (trip name)
 *   meta chips (country, date range, member count)
 *   day-strip (sticky, horizontal scroll, click → setActiveDay)
 *   stop list (filtered by active day, time + name + kind icon)
 *
 * Data: GET /api/trips/:id (metadata) + GET /api/trips/:id/days?all=1
 * (full days + entries). Falls back to empty state when fetch fails or
 * tripId is null (no trips yet).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const SCOPED_STYLES = `
.tp-trips-sheet {
  display: flex; flex-direction: column;
  height: 100%;
  background: var(--color-background);
  border-left: 1px solid var(--color-border);
  overflow: hidden;
}

.tp-trips-sheet-empty {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center;
  padding: 32px 24px;
  color: var(--color-muted);
}
.tp-trips-sheet-empty .tp-empty-icon {
  width: 56px; height: 56px;
  border-radius: 50%;
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  display: grid; place-items: center;
  margin-bottom: 16px;
}
.tp-trips-sheet-empty h3 {
  font-size: var(--font-size-headline);
  font-weight: 700;
  color: var(--color-foreground);
  margin: 0 0 6px;
}
.tp-trips-sheet-empty p {
  font-size: var(--font-size-footnote);
  margin: 0 0 16px;
  max-width: 280px;
  line-height: 1.5;
}
.tp-trips-sheet-empty .tp-empty-cta {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: #fff;
  font-size: var(--font-size-footnote);
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  border: none;
  font-family: inherit;
}
.tp-trips-sheet-empty .tp-empty-cta:hover { filter: brightness(0.92); }

.tp-sheet-header {
  display: flex; align-items: center;
  gap: 4px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
}
.tp-sheet-icon-btn {
  width: 32px; height: 32px;
  border-radius: var(--radius-md);
  background: transparent;
  border: 1px solid transparent;
  display: grid; place-items: center;
  cursor: pointer;
  color: var(--color-muted);
  font-family: inherit;
  font-size: 14px;
}
.tp-sheet-icon-btn:hover {
  background: var(--color-hover);
  color: var(--color-foreground);
}
.tp-sheet-spacer { flex: 1; }

.tp-sheet-title-row {
  padding: 16px 24px 8px;
}
.tp-sheet-title {
  font-size: var(--font-size-title3);
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--color-foreground);
  margin: 0;
}

.tp-sheet-meta {
  padding: 0 24px 12px;
  display: flex; gap: 8px; flex-wrap: wrap;
  font-size: var(--font-size-caption);
  color: var(--color-muted);
}
.tp-sheet-meta .tp-chip {
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: var(--color-tertiary);
}
.tp-sheet-meta .tp-chip.is-accent {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep, #B85C2E);
  font-weight: 600;
}

/* Day strip — mockup-trip-v2.html .mobile-day-strip pill pattern.
 * Per user spec: desktop sheet AND mobile day-nav share THIS pattern. */
.tp-day-strip {
  display: flex; gap: 6px;
  overflow-x: auto;
  padding: 8px 16px;
  position: sticky; top: 0;
  background: color-mix(in srgb, var(--color-background) 92%, transparent);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--color-border);
  z-index: 5;
  scrollbar-width: none;
}
.tp-day-strip::-webkit-scrollbar { display: none; }
.tp-day-strip-btn {
  flex: 0 0 auto;
  padding: 7px 10px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: transparent;
  cursor: pointer; font-family: inherit;
  color: var(--color-foreground);
  display: inline-flex; flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-height: 44px;
  transition: background 150ms, border-color 150ms, color 150ms;
}
.tp-day-strip-btn:hover:not(.is-active) {
  border-color: var(--color-accent);
}
.tp-day-strip-btn.is-active {
  background: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}
.tp-day-strip-btn .tp-dn-head { display: inline-flex; align-items: center; gap: 4px; }
.tp-day-strip-btn .tp-dn-eyebrow {
  font-size: var(--font-size-eyebrow);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.6;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.tp-day-strip-btn.is-active .tp-dn-eyebrow { opacity: 0.85; }
.tp-day-strip-btn .tp-dn-today {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep, #B85C2E);
}
.tp-day-strip-btn.is-active .tp-dn-today {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
.tp-day-strip-btn .tp-dn-date {
  font-size: 13px; font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.005em;
  line-height: 1;
  color: var(--color-foreground);
}
.tp-day-strip-btn.is-active .tp-dn-date { color: #fff; }
.tp-day-strip-btn .tp-dn-dow {
  font-size: var(--font-size-caption2);
  font-weight: 500;
  opacity: 0.55;
  margin-left: 4px;
}
.tp-day-strip-btn.is-active .tp-dn-dow { opacity: 0.85; }

.tp-sheet-body { flex: 1; overflow-y: auto; }
.tp-rail { padding: 16px 20px 20px; }
.tp-rail-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
}
.tp-rail-item {
  display: grid;
  grid-template-columns: 56px 24px 1fr;
  column-gap: 12px;
  align-items: center;
  padding: 12px 4px;
  border-bottom: 1px dashed var(--color-border);
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: background 120ms;
}
.tp-rail-item:hover { background: var(--color-hover); }
.tp-rail-item:last-child { border-bottom: none; }
.tp-rail-time {
  text-align: right;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--color-foreground);
  line-height: 1.2;
}
.tp-rail-dot {
  justify-self: center;
  width: 24px; height: 24px;
  border-radius: 50%;
  background: var(--color-background);
  border: 1.5px solid var(--color-border);
  display: grid; place-items: center;
  font-size: var(--font-size-caption2);
  font-weight: 700;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.tp-rail-name {
  font-size: var(--font-size-callout);
  font-weight: 600;
  color: var(--color-foreground);
  letter-spacing: -0.005em;
  line-height: 1.4;
}

.tp-sheet-loading {
  flex: 1;
  display: grid; place-items: center;
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
}

.tp-sheet-link {
  padding: 12px 24px;
  border-top: 1px solid var(--color-border);
  text-align: center;
  font-size: var(--font-size-footnote);
}
.tp-sheet-link a {
  color: var(--color-accent-deep, #B85C2E);
  font-weight: 600;
  text-decoration: none;
}
.tp-sheet-link a:hover { text-decoration: underline; }
`;

interface DayRow {
  id: number;
  day_num: number;
  date: string | null;
  day_of_week: string | null;
  label: string | null;
  timeline?: Array<{
    id: number;
    time: string | null;
    title: string;
    sort_order: number;
  }>;
}

interface TripMeta {
  tripId: string;
  name: string;
  title?: string | null;
  countries?: string | null;
  member_count?: number;
  start_date?: string | null;
  end_date?: string | null;
  day_count?: number;
}

export interface TripsPreviewSheetProps {
  tripId: string | null;
  /** Brief metadata from the cards list (avoids one extra fetch). */
  meta?: TripMeta | null;
  /** When tripId is null (user has 0 trips), CTA points here. */
  newTripHref?: string;
}

function formatDateChip(iso: string | null | undefined): string | null {
  if (!iso) return null;
  // YYYY-MM-DD → M/D
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(iso);
  if (!m) return iso;
  return `${parseInt(m[2]!, 10)}/${parseInt(m[3]!, 10)}`;
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined): string | null {
  const s = formatDateChip(start);
  const e = formatDateChip(end);
  if (s && e) return `${s} – ${e}`;
  return s ?? e ?? null;
}

const ZH_DOW = ['日', '一', '二', '三', '四', '五', '六'];
const EN_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dowLabel(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(parseInt(m[1]!, 10), parseInt(m[2]!, 10) - 1, parseInt(m[3]!, 10)));
  if (isNaN(d.getTime())) return null;
  return EN_DOW[d.getUTCDay()] ?? ZH_DOW[d.getUTCDay()] ?? null;
}

export default function TripsPreviewSheet({ tripId, meta, newTripHref = '/manage' }: TripsPreviewSheetProps) {
  const [days, setDays] = useState<DayRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDayId, setActiveDayId] = useState<number | null>(null);

  useEffect(() => {
    if (!tripId) {
      setDays(null);
      return;
    }
    let cancelled = false;
    setDays(null);
    setError(null);
    fetch(`/api/trips/${encodeURIComponent(tripId)}/days?all=1`, { credentials: 'same-origin' })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setError('無法載入行程預覽');
          return;
        }
        const json = (await r.json()) as DayRow[];
        setDays(json);
        // Default active day: first day with entries, else first day.
        const dayWithEntries = json.find((d) => (d.timeline?.length ?? 0) > 0);
        setActiveDayId(dayWithEntries?.id ?? json[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setError('網路連線失敗');
      });
    return () => { cancelled = true; };
  }, [tripId]);

  const activeDay = useMemo(
    () => (days && activeDayId !== null ? days.find((d) => d.id === activeDayId) ?? null : null),
    [days, activeDayId],
  );

  const todayStr = new Date().toISOString().slice(0, 10);

  // Empty state — no trip selected (user has zero trips)
  if (!tripId) {
    return (
      <div className="tp-trips-sheet" data-testid="trips-preview-sheet">
        <style>{SCOPED_STYLES}</style>
        <div className="tp-trips-sheet-empty" data-testid="trips-preview-empty">
          <div className="tp-empty-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="6" width="18" height="14" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="8" y1="3" x2="8" y2="7" />
              <line x1="16" y1="3" x2="16" y2="7" />
            </svg>
          </div>
          <h3>還沒開始任何行程</h3>
          <p>建立第一個行程，AI 會幫你排日程、餐廳、住宿。</p>
          <Link to={newTripHref} className="tp-empty-cta" data-testid="trips-preview-new-trip">
            <span style={{ fontSize: 14 }}>+</span>
            <span>新增行程</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="tp-trips-sheet" data-testid="trips-preview-sheet">
      <style>{SCOPED_STYLES}</style>

      <div className="tp-sheet-header">
        <button type="button" className="tp-sheet-icon-btn" aria-label="收合" disabled>⇤</button>
        <div className="tp-sheet-spacer" />
        <Link
          to={`/trip/${encodeURIComponent(tripId)}`}
          className="tp-sheet-icon-btn"
          aria-label="開啟完整行程"
          data-testid="trips-preview-open"
          style={{ textDecoration: 'none' }}
        >↗</Link>
      </div>

      <div className="tp-sheet-title-row">
        <h2 className="tp-sheet-title" data-testid="trips-preview-title">
          {meta?.title ?? meta?.name ?? tripId}
        </h2>
      </div>

      <div className="tp-sheet-meta">
        {meta?.countries && (
          <span className="tp-chip is-accent" data-testid="trips-preview-country">
            {meta.countries.toUpperCase()}
          </span>
        )}
        {(() => {
          const range = formatDateRange(meta?.start_date, meta?.end_date);
          return range ? <span className="tp-chip" data-testid="trips-preview-daterange">{range}</span> : null;
        })()}
        {typeof meta?.member_count === 'number' && meta.member_count > 0 && (
          <span className="tp-chip" data-testid="trips-preview-members">
            {meta.member_count} 旅伴
          </span>
        )}
      </div>

      {days === null && !error && (
        <div className="tp-sheet-loading" data-testid="trips-preview-loading">載入中…</div>
      )}

      {error && (
        <div className="tp-sheet-loading" role="alert" data-testid="trips-preview-error">
          {error}
        </div>
      )}

      {days !== null && days.length > 0 && (
        <>
          <div className="tp-day-strip" role="tablist" aria-label="行程日期">
            {days.map((d) => {
              const isActive = d.id === activeDayId;
              const isToday = d.date === todayStr;
              return (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`tp-day-strip-btn ${isActive ? 'is-active' : ''}`}
                  onClick={() => setActiveDayId(d.id)}
                  data-testid={`trips-preview-day-${d.day_num}`}
                >
                  <span className="tp-dn-head">
                    <span className="tp-dn-eyebrow">DAY {String(d.day_num).padStart(2, '0')}</span>
                    {isToday && <span className="tp-dn-today">TODAY</span>}
                  </span>
                  <span className="tp-dn-date">
                    {formatDateChip(d.date) ?? '—'}
                    {dowLabel(d.date) && <span className="tp-dn-dow">{dowLabel(d.date)}</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="tp-sheet-body">
            <div className="tp-rail">
              {(() => {
                const timeline = activeDay?.timeline ?? [];
                if (timeline.length === 0) {
                  return <div className="tp-rail-empty">這天還沒安排任何景點。</div>;
                }
                return timeline.map((entry, i) => (
                  <Link
                    key={entry.id}
                    to={`/trip/${encodeURIComponent(tripId)}`}
                    className="tp-rail-item"
                    data-testid={`trips-preview-stop-${entry.id}`}
                  >
                    <span className="tp-rail-time">{entry.time ?? ''}</span>
                    <span className="tp-rail-dot" aria-hidden="true">{i + 1}</span>
                    <span className="tp-rail-name">{entry.title}</span>
                  </Link>
                ));
              })()}
            </div>
          </div>
        </>
      )}

      {days !== null && days.length === 0 && !error && (
        <div className="tp-rail-empty" style={{ padding: '32px 24px' }}>
          這個行程還沒新增任何天。
          <div style={{ marginTop: 12 }}>
            <Link
              to={`/trip/${encodeURIComponent(tripId)}`}
              style={{ color: 'var(--color-accent-deep, #B85C2E)', fontWeight: 600 }}
            >
              開始排行程 →
            </Link>
          </div>
        </div>
      )}

      <div className="tp-sheet-link">
        <Link to={`/trip/${encodeURIComponent(tripId)}`} data-testid="trips-preview-open-full">
          開啟完整行程 →
        </Link>
      </div>
    </div>
  );
}
