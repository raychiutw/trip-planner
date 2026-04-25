/**
 * TripsListPage — V2 design audit landing page
 *
 * Route: /trips
 * Shows the logged-in user's accessible trips as peach-gradient cards
 * (mockup-trip-v2.html "/trips" landing). Click → /trip/:tripId detail.
 *
 * Data:
 *   - GET /api/my-trips → tripIds the user has permission for
 *   - GET /api/trips     → all published trips with name + countries
 *   - Cross-ref so admins still see only what they can edit
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';

const SCOPED_STYLES = `
.tp-trips-shell {
  min-height: 100%;
  padding: 32px 24px 64px;
  background: var(--color-secondary);
}
.tp-trips-inner { max-width: 960px; margin: 0 auto; }
.tp-trips-heading {
  margin-bottom: 24px;
}
.tp-trips-heading-crumb {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--color-muted); margin-bottom: 8px;
}
.tp-trips-heading h1 {
  font-size: var(--font-size-title); font-weight: 800;
  letter-spacing: -0.02em; margin: 0 0 6px;
}
.tp-trips-heading p {
  color: var(--color-muted); font-size: var(--font-size-subheadline);
  margin: 0;
}

.tp-trips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 24px;
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
}
.tp-trip-card:hover {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}
.tp-trip-card-cover {
  aspect-ratio: 16/9;
  background: var(--color-tertiary);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
}
.tp-trip-cover-jp {
  background-image: linear-gradient(135deg, #D97848 0%, #F0935E 100%);
}
.tp-trip-cover-kr {
  background-image: linear-gradient(135deg, #B85C2E 0%, #EADFCF 100%);
}
.tp-trip-cover-tw {
  background-image: linear-gradient(135deg, #C88500 0%, #F7DFCB 100%);
}
.tp-trip-cover-other {
  background-image: linear-gradient(135deg, #6F5A47 0%, #C8B89F 100%);
}
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
}

.tp-trips-empty, .tp-trips-loading, .tp-trips-error {
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
}

function coverClass(countries: string | null | undefined): string {
  const c = (countries ?? '').toUpperCase().trim();
  if (c.includes('JP')) return 'tp-trip-cover-jp';
  if (c.includes('KR')) return 'tp-trip-cover-kr';
  if (c.includes('TW')) return 'tp-trip-cover-tw';
  return 'tp-trip-cover-other';
}

function eyebrowText(countries: string | null | undefined): string {
  const c = (countries ?? '').toUpperCase().trim();
  if (c.includes('JP')) return 'JAPAN';
  if (c.includes('KR')) return 'KOREA';
  if (c.includes('TW')) return 'TAIWAN';
  return c || 'TRIP';
}

export default function TripsListPage() {
  useRequireAuth();
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
          if (myRes.status === 401 || myRes.status === 403) return; // useRequireAuth handles redirect
          setError('無法載入你的行程清單。');
          return;
        }
        const myJson = (await myRes.json()) as MyTripRow[];
        const ids = myJson.map((r) => r.tripId);
        setMyIds(ids);
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
    const idSet = new Set(myIds);
    const map = new Map<string, TripInfo>();
    for (const t of allTrips) map.set(t.tripId, t);
    return myIds
      .map((id) => map.get(id) ?? { tripId: id, name: id })
      .filter((t) => idSet.has(t.tripId));
  }, [myIds, allTrips]);

  const loading = myIds === null && !error;

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={<>
        <style>{SCOPED_STYLES}</style>
        <div className="tp-trips-shell" data-testid="trips-list-page">
          <div className="tp-trips-inner">
            <div className="tp-trips-heading">
              <div className="tp-trips-heading-crumb">我的行程</div>
              <h1>行程</h1>
              <p>挑一個進去繼續編輯，或從上方建立新的旅程。</p>
            </div>

            {loading && (
              <div className="tp-trips-loading" data-testid="trips-list-loading">載入中…</div>
            )}

            {error && (
              <div className="tp-trips-error" role="alert" data-testid="trips-list-error">{error}</div>
            )}

            {!loading && !error && visibleTrips.length === 0 && (
              <div className="tp-trips-empty" data-testid="trips-list-empty">
                你目前沒有可編輯的行程。請聯繫管理者邀請你加入。
              </div>
            )}

            {visibleTrips.length > 0 && (
              <div className="tp-trips-grid">
                {visibleTrips.map((t) => (
                  <Link
                    to={`/trip/${encodeURIComponent(t.tripId)}`}
                    className="tp-trip-card"
                    key={t.tripId}
                    data-testid={`trips-list-card-${t.tripId}`}
                  >
                    <div className={`tp-trip-card-cover ${coverClass(t.countries)}`} aria-hidden="true" />
                    <div className="tp-trip-card-eyebrow">{eyebrowText(t.countries)}</div>
                    <h2 className="tp-trip-card-title">{t.title || t.name}</h2>
                    <div className="tp-trip-card-meta">{t.tripId}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </>}
    />
  );
}
