/**
 * TripsListPage — V2 trip landing page (mockup-trip-v2.html parity)
 *
 * Route: /trips
 *
 * Layout:
 *   - Desktop ≥1024px: 3-pane via AppShell (sidebar | trip card grid | preview sheet)
 *   - Mobile <1024px: 2-pane (sidebar hidden, card grid stacked, no preview sheet)
 *
 * Interaction:
 *   - Card click (both viewports): setSearchParams('selected', tripId).
 *     Mobile renders embedded TripPage as full-screen main; desktop swaps the
 *     right sheet to that trip. No /trip/:id navigation.
 *   - Trailing card "+ 新增行程" / empty hero CTA / sidebar new-trip button:
 *     all open NewTripModal, which POSTs /api/trips and selects the new trip.
 *
 * Data:
 *   - GET /api/my-trips → tripIds the user has permission for
 *   - GET /api/trips?all=1 → trip metadata (name, countries, day_count,
 *     start_date, end_date, member_count)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useNewTrip } from '../contexts/NewTripContext';
import { apiFetchRaw } from '../lib/apiClient';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TripCardMenu from '../components/trip/TripCardMenu';
import ToastContainer, { showToast } from '../components/shared/Toast';
import ErrorBanner from '../components/shared/ErrorBanner';
import TripPage from './TripPage';

const SCOPED_STYLES = `
/* /trips landing uses a narrower sheet than the trip-detail page so the card
 * grid + browse area gets more room. Default 3-pane token is min(780px, 40vw)
 * which gives ~50/50 main/sheet at 1440 (too cramped for a list). Override
 * to min(420px, 32vw) — at 1440 → sheet=420, main=780, sidebar=240.
 *
 * Scoped to <main className="tp-trips-shell"> so other 3-pane pages
 * (TripPage with rich TripSheet) keep their wider sheet. */
@media (min-width: 1024px) {
  .app-shell:has(> main .tp-trips-shell)[data-layout="3pane"] {
    /* QA 2026-04-26 BUG-002/007/019：sheet 太窄（420 / 32vw）導致嵌入 TripPage
     * 的 day-strip + popover 全 overflow。bump 到 min(560, 38vw)：
     *   1440px → 547 sheet（原 420），main 653（原 780），緊但夠 3-col cards
     *   1280px → 486 sheet（原 410）
     *   1024px → 389 sheet（原 328），最低 viewport 仍 OK */
    grid-template-columns: 240px 1fr min(560px, 38vw);
  }
}
.tp-trips-shell {
  min-height: 100%;
  padding: 32px 24px 64px;
  background: var(--color-secondary);
  height: 100%;
  overflow-y: auto;
}
.tp-trips-inner { max-width: 960px; margin: 0 auto; }

.tp-trips-heading {
  display: flex; justify-content: space-between; align-items: flex-end;
  flex-wrap: wrap; gap: 16px;
  margin-bottom: 24px;
}
.tp-trips-heading-text { flex: 1 1 auto; }
.tp-trips-heading h1 {
  font-size: var(--font-size-title); font-weight: 800;
  letter-spacing: -0.02em; margin: 0 0 6px;
}
.tp-trips-heading-meta {
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
  font-variant-numeric: tabular-nums;
}

.tp-trips-grid {
  display: grid;
  /* Mobile default: 2 columns (per user spec). Desktop overrides to 3
   * columns below. Cards shrink/grow to fit available main width. */
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 24px;
}
@media (min-width: 1024px) {
  .tp-trips-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
/* PR-Q 2026-04-26：每張 trip card 加 ... menu。card 改 wrapper（position:
 * relative）裝 button + menu trigger 兩個 children，避免 button-in-button。 */
.tp-trip-card-wrap {
  position: relative;
}
.tp-trip-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px;
  text-decoration: none;
  color: inherit;
  transition: border-color 120ms, box-shadow 120ms, transform 120ms;
  display: block;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  width: 100%;
}
.tp-trip-card:hover {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}
.tp-trip-card.is-active {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
}
.tp-trip-card-cover {
  aspect-ratio: 16/9;
  background: var(--color-tertiary);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
}
.tp-trip-cover-jp { background-image: linear-gradient(135deg, var(--color-cover-jp-from) 0%, var(--color-cover-jp-to) 100%); }
.tp-trip-cover-kr { background-image: linear-gradient(135deg, var(--color-cover-kr-from) 0%, var(--color-cover-kr-to) 100%); }
.tp-trip-cover-tw { background-image: linear-gradient(135deg, var(--color-cover-tw-from) 0%, var(--color-cover-tw-to) 100%); }
.tp-trip-cover-other { background-image: linear-gradient(135deg, var(--color-cover-other-from) 0%, var(--color-cover-other-to) 100%); }

.tp-trip-card-eyebrow {
  font-size: var(--font-size-caption2);
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-muted);
  margin-bottom: 6px;
}
.tp-trip-card-title {
  font-size: var(--font-size-headline);
  font-weight: 700;
  letter-spacing: -0.005em;
  margin: 0 0 4px;
}
.tp-trip-card-meta {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

/* Trailing "新增行程" card — dashed outline, accent color */
.tp-trip-card-new {
  background: transparent;
  border: 2px dashed var(--color-border);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px;
  min-height: 200px;
  color: var(--color-muted);
  font-weight: 600;
  font-size: var(--font-size-callout);
  transition: border-color 120ms, color 120ms, background 120ms;
}
.tp-trip-card-new:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-subtle);
  transform: none;
  box-shadow: none;
}
.tp-trip-card-new .tp-new-icon {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  display: grid; place-items: center;
  font-size: 20px;
  font-weight: 700;
  transition: background 120ms;
}
.tp-trip-card-new:hover .tp-new-icon {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
}

/* Empty state hero — when user has 0 trips */
.tp-trips-empty-hero {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 64px 32px;
  text-align: center;
  margin-top: 24px;
}
.tp-trips-empty-hero .tp-hero-icon {
  width: 72px; height: 72px;
  margin: 0 auto 20px;
  border-radius: 50%;
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  display: grid; place-items: center;
}
.tp-trips-empty-hero h2 {
  font-size: var(--font-size-title2);
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--color-foreground);
  margin: 0 0 8px;
}
.tp-trips-empty-hero p {
  color: var(--color-muted);
  font-size: var(--font-size-callout);
  max-width: 420px;
  margin: 0 auto 24px;
  line-height: 1.5;
}
.tp-trips-empty-hero .tp-hero-cta {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 14px 28px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  font-weight: 700;
  font-size: var(--font-size-callout);
  text-decoration: none;
  cursor: pointer;
}
.tp-trips-empty-hero .tp-hero-cta:hover { filter: brightness(0.92); }

.tp-trips-loading, .tp-trips-error {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 48px 24px;
  text-align: center;
  color: var(--color-muted);
  margin-top: 24px;
}
.tp-trips-error { color: var(--color-destructive); }
`;

interface MyTripRow {
  tripId: string;
}

interface TripInfo {
  tripId: string;
  name: string;
  owner?: string;
  title?: string | null;
  countries?: string | null;
  published?: number | boolean;
  day_count?: number;
  start_date?: string | null;
  end_date?: string | null;
  member_count?: number;
}

function coverClass(countries: string | null | undefined): string {
  const c = (countries ?? '').toUpperCase().trim();
  if (c.includes('JP')) return 'tp-trip-cover-jp';
  if (c.includes('KR')) return 'tp-trip-cover-kr';
  if (c.includes('TW')) return 'tp-trip-cover-tw';
  return 'tp-trip-cover-other';
}

function eyebrow(countries: string | null | undefined, dayCount: number | undefined): string {
  const c = (countries ?? '').toUpperCase().trim();
  const country =
    c.includes('JP') ? 'JAPAN' :
    c.includes('KR') ? 'KOREA' :
    c.includes('TW') ? 'TAIWAN' :
    c || 'TRIP';
  if (typeof dayCount === 'number' && dayCount > 0) {
    return `${country} · ${dayCount} ${dayCount === 1 ? 'DAY' : 'DAYS'}`;
  }
  return country;
}

function dateRange(start: string | null | undefined, end: string | null | undefined): string | null {
  function fmt(iso: string): string {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(iso);
    if (!m) return iso;
    return `${parseInt(m[2]!, 10)}/${parseInt(m[3]!, 10)}`;
  }
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return fmt(start);
  if (end) return fmt(end);
  return null;
}

function cardMeta(trip: TripInfo): string {
  const range = dateRange(trip.start_date, trip.end_date);
  // member_count includes user's own row in trip_permissions; "N 旅伴" is total members.
  const members = typeof trip.member_count === 'number' && trip.member_count > 0
    ? `${trip.member_count} 旅伴`
    : null;
  if (range && members) return `${range} · ${members}`;
  if (range) return range;
  if (members) return members;
  return trip.tripId;
}

export default function TripsListPage() {
  useRequireAuth();
  const { user } = useCurrentUser();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFromUrl = searchParams.get('selected');
  const { openModal: openNewTrip } = useNewTrip();

  const [myIds, setMyIds] = useState<string[] | null>(null);
  const [allTrips, setAllTrips] = useState<TripInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/my-trips', { credentials: 'same-origin' }),
      fetch('/api/trips?all=1', { credentials: 'same-origin' }),
    ])
      .then(async ([myRes, allRes]) => {
        if (cancelled) return;
        if (!myRes.ok) {
          if (myRes.status === 401 || myRes.status === 403) return;
          setError('無法載入你的行程清單。');
          return;
        }
        const myJson = (await myRes.json()) as MyTripRow[];
        setMyIds(myJson.map((r) => r.tripId));
        if (allRes.ok) {
          const allJson = (await allRes.json()) as TripInfo[];
          setAllTrips(allJson);
        } else {
          setAllTrips([]);
        }
      })
      .catch(() => {
        if (!cancelled) setError('網路連線失敗，請稍後再試。');
      });
    return () => { cancelled = true; };
  }, []);

  const visibleTrips = useMemo<TripInfo[]>(() => {
    if (myIds === null || allTrips === null) return [];
    const map = new Map<string, TripInfo>();
    for (const t of allTrips) map.set(t.tripId, t);
    return myIds.map((id) => map.get(id) ?? { tripId: id, name: id });
  }, [myIds, allTrips]);

  // Effective selected: URL param > first visible trip > null
  const effectiveSelectedId = useMemo<string | null>(() => {
    if (selectedFromUrl && visibleTrips.some((t) => t.tripId === selectedFromUrl)) {
      return selectedFromUrl;
    }
    return visibleTrips[0]?.tripId ?? null;
  }, [selectedFromUrl, visibleTrips]);

  // Both viewports: clicking a card sets ?selected=tripId. Mobile then
  // renders the embedded TripPage as full-screen main; desktop swaps the
  // right sheet to that trip. Per user direction the unified URL pattern is
  // /trips?selected=X (no /trip/:id route navigation).
  function handleCardClick(tripId: string, e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    next.set('selected', tripId);
    setSearchParams(next, { replace: false });
  }

  // PR-Q：card kebab 「共編設定」→ navigate 到該 trip + ?sheet=collab。
  // TripPage 讀 ?sheet= 自動 setActiveSheet，user 一次到位。
  const navigate = useNavigate();
  const handleMenuCollab = useCallback(
    (tripId: string) => {
      navigate(`/trips?selected=${encodeURIComponent(tripId)}&sheet=collab`);
    },
    [navigate],
  );

  // PR-Q：card kebab 「刪除行程」 → confirm + DELETE /api/trips/:id +
  // optimistic remove from local list（避免 user 等待 reload）。
  const handleMenuDelete = useCallback(
    async (tripId: string) => {
      const trip = visibleTrips.find((t) => t.tripId === tripId);
      const label = trip?.title || trip?.name || tripId;
      if (!window.confirm(`確定刪除「${label}」？此操作無法復原。`)) return;
      try {
        const r = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}`, { method: 'DELETE' });
        if (r.status === 403) throw new Error('僅行程擁有者或管理者可刪除');
        if (r.status === 404) throw new Error('行程不存在');
        if (!r.ok) throw new Error('刪除失敗，請稍後再試');
        showToast(`已刪除「${label}」`, 'success');
        // Optimistic local removal
        setMyIds((prev) => prev?.filter((id) => id !== tripId) ?? null);
        setAllTrips((prev) => prev?.filter((t) => t.tripId !== tripId) ?? null);
        // Clear ?selected= if user just deleted the open trip
        if (selectedFromUrl === tripId) {
          const next = new URLSearchParams(searchParams);
          next.delete('selected');
          setSearchParams(next, { replace: true });
        }
      } catch (err) {
        showToast((err as Error).message, 'error');
      }
    },
    [visibleTrips, selectedFromUrl, searchParams, setSearchParams],
  );

  const loading = myIds === null && !error;

  // Heading meta: "N 個行程" — placeholder for future "進行中" / "最近更新"
  const headingMeta = visibleTrips.length > 0
    ? `${visibleTrips.length} 個行程`
    : null;

  // Mobile + ?selected → embedded TripPage IS the main content (full-screen
  // trip detail). Cards hide. Per user spec, /trips?selected=X is the unified
  // entry, no /trip/:id route navigation.
  const showEmbeddedTrip = !isDesktop && !!effectiveSelectedId && !!selectedFromUrl;

  const cardGridMain = (
    <>
      <style>{SCOPED_STYLES}</style>
      <ToastContainer />
      <div className="tp-trips-shell" data-testid="trips-list-page">
        <div className="tp-trips-inner">
          <div className="tp-trips-heading">
            <div className="tp-trips-heading-text">
              <h1>我的行程</h1>
              {headingMeta && <div className="tp-trips-heading-meta">{headingMeta}</div>}
            </div>
          </div>

          {loading && (
            <div className="tp-trips-loading" data-testid="trips-list-loading">載入中…</div>
          )}

          {error && <ErrorBanner message={error} testId="trips-list-error" />}

          {!loading && !error && visibleTrips.length === 0 && (
            <div className="tp-trips-empty-hero" data-testid="trips-list-empty">
              <div className="tp-hero-icon" aria-hidden="true">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="6" width="18" height="14" rx="2" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <line x1="8" y1="3" x2="8" y2="7" />
                  <line x1="16" y1="3" x2="16" y2="7" />
                </svg>
              </div>
              <h2>還沒開始任何行程</h2>
              <p>建立第一個行程，AI 會幫你排日程、餐廳、住宿。</p>
              <button
                type="button"
                onClick={openNewTrip}
                className="tp-hero-cta"
                data-testid="trips-list-new-trip-hero"
              >
                <span style={{ fontSize: 18 }}>+</span>
                <span>新增行程</span>
              </button>
            </div>
          )}

          {visibleTrips.length > 0 && (
            <div className="tp-trips-grid">
              {visibleTrips.map((t) => {
                const isActive = isDesktop && t.tripId === effectiveSelectedId;
                return (
                  <div key={t.tripId} className="tp-trip-card-wrap">
                    <button
                      type="button"
                      onClick={(e) => handleCardClick(t.tripId, e)}
                      className={`tp-trip-card ${isActive ? 'is-active' : ''}`}
                      data-testid={`trips-list-card-${t.tripId}`}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <div className={`tp-trip-card-cover ${coverClass(t.countries)}`} aria-hidden="true" />
                      <div className="tp-trip-card-eyebrow">{eyebrow(t.countries, t.day_count)}</div>
                      <h2 className="tp-trip-card-title">{t.title || t.name}</h2>
                      <div className="tp-trip-card-meta">{cardMeta(t)}</div>
                    </button>
                    <TripCardMenu
                      tripId={t.tripId}
                      onCollab={handleMenuCollab}
                      onDelete={handleMenuDelete}
                    />
                  </div>
                );
              })}
              <button
                type="button"
                onClick={openNewTrip}
                className="tp-trip-card tp-trip-card-new"
                data-testid="trips-list-new-trip-card"
              >
                <span className="tp-new-icon" aria-hidden="true">+</span>
                <span>新增行程</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  // Desktop sheet content = embedded TripPage (mobile-style timeline) for the
  // selected trip. Replaces the lightweight TripsPreviewSheet — sheet content
  // now mirrors mobile main exactly per user spec.
  const sheet = isDesktop && effectiveSelectedId ? (
    <TripPage tripId={effectiveSelectedId} noShell />
  ) : undefined;

  // Mobile route: when ?selected, render TripPage as main (replaces cards).
  // When no ?selected, render the card grid.
  const main = showEmbeddedTrip ? (
    <TripPage tripId={effectiveSelectedId!} noShell />
  ) : cardGridMain;

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      sheet={sheet}
      main={main}
      bottomNav={<GlobalBottomNav authed={!!user} />}
    />
  );
}
