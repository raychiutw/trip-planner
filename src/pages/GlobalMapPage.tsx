/** Root map: route to the selected trip map, or guide an account with no trips. */
import { Navigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useTripSelection } from '../hooks/useMyTrips';
import { useNewTrip } from '../contexts/NewTripContext';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import Icon from '../components/shared/Icon';

const STYLES = `
.tp-global-map-shell { min-height: 100%; display: grid; place-items: center; background: linear-gradient(135deg, var(--color-accent-subtle), var(--color-tertiary)); padding: 32px 24px; }
.tp-global-map-empty-card { max-width: 480px; text-align: center; display: flex; flex-direction: column; gap: 16px; align-items: center; background: var(--color-background); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-md); padding: 36px 28px; }
.tp-global-map-empty-icon { width: 64px; height: 64px; border-radius: 50%; background: var(--color-accent-subtle); color: var(--color-accent); display: grid; place-items: center; }
.tp-global-map-empty-card h2 { font-size: var(--font-size-title2); font-weight: 800; letter-spacing: -0.01em; margin: 0; }
.tp-global-map-empty-card p { color: var(--color-muted); font-size: var(--font-size-callout); line-height: 1.55; margin: 0; }
.tp-global-map-empty-card .cta { display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px; border-radius: var(--radius-full); background: var(--color-accent-fill); color: var(--color-accent-foreground); border: none; cursor: pointer; font: inherit; font-weight: 700; font-size: var(--font-size-callout); min-height: var(--spacing-tap-min); }
.tp-global-map-empty-card .cta:hover { filter: brightness(var(--hover-brightness)); }
`;

export default function GlobalMapPage() {
  useRequireAuth();
  const { user } = useCurrentUser();
  const { openModal: openNewTrip } = useNewTrip();
  const { activeTripId, trips, status } = useTripSelection(user?.id);
  const targetId = activeTripId ?? (status === 'ready' ? trips?.[0]?.tripId : null);

  if (targetId) return <Navigate to={`/trip/${encodeURIComponent(targetId)}/map`} replace />;
  if (status === 'loading') return null;

  return <AppShell
    sidebar={<DesktopSidebarConnected />}
    bottomNav={<GlobalBottomNav authed={user !== null} />}
    main={<div className="tp-global-map-shell" data-testid="global-map-page">
      <style>{STYLES}</style>
      {status === 'error' ? <div className="tp-global-map-empty-card" role="alert">
        <h2>無法載入行程清單</h2>
        <button type="button" className="cta" onClick={() => window.location.reload()}>重試</button>
      </div> : trips?.length === 0 ? <div className="tp-global-map-empty-card" data-testid="global-map-empty">
        <div className="tp-global-map-empty-icon" aria-hidden="true"><Icon name="map" /></div>
        <h2>還沒有行程可以看</h2>
        <p>新增第一個行程後，這裡就會把所有景點點在地圖上、用真實導航路線連起來。</p>
        <button type="button" className="cta" onClick={openNewTrip} data-testid="global-map-new-trip">
          <span aria-hidden="true">+</span><span>新增行程</span>
        </button>
      </div> : null}
    </div>}
  />;
}
