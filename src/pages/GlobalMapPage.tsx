/** Root map chooses an accessible trip; the trip map owns map data and controls. */
import { Navigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useNewTrip } from '../contexts/NewTripContext';
import { useAccessibleTripSelection } from '../hooks/useAccessibleTripSelection';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import Icon from '../components/shared/Icon';

const SCOPED_STYLES = `
.tp-global-map-shell {
  position: relative; height: 100%; width: 100%;
  background: var(--color-secondary);
  display: flex; flex-direction: column;
}
.tp-global-map-empty {
  flex: 1; min-height: 0;
  display: grid; place-items: center;
  padding: 32px 24px;
  background: linear-gradient(135deg, var(--color-accent-subtle) 0%, var(--color-tertiary) 100%);
}
.tp-global-map-empty-card {
  max-width: 480px; text-align: center;
  display: flex; flex-direction: column; gap: 16px; align-items: center;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 36px 28px;
}
.tp-global-map-empty-icon {
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  display: grid; place-items: center;
}
.tp-global-map-empty h2 {
  font-size: var(--font-size-title2); font-weight: 800;
  letter-spacing: -0.01em; margin: 0;
}
.tp-global-map-empty p {
  color: var(--color-muted); font-size: var(--font-size-callout);
  line-height: 1.55; margin: 0;
}
.tp-global-map-empty .cta {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 22px;
  border-radius: var(--radius-full);
  background: var(--color-accent-fill); color: var(--color-accent-foreground);
  border: none; cursor: pointer;
  font: inherit; font-weight: 700; font-size: var(--font-size-callout);
  min-height: var(--spacing-tap-min);
}
.tp-global-map-empty .cta:hover { filter: brightness(var(--hover-brightness)); }
`;

export default function GlobalMapPage() {
  useRequireAuth();
  const { user } = useCurrentUser();
  const { openModal: openNewTrip } = useNewTrip();
  const { trips, status, selectedTripId } = useAccessibleTripSelection(user?.id);

  if (status === 'loading') return null;
  if (selectedTripId) {
    return <Navigate to={`/trip/${encodeURIComponent(selectedTripId)}/map`} replace />;
  }

  const isEmpty = status === 'success' && trips?.length === 0;
  const main = (
    <div className="tp-global-map-shell" data-testid="global-map-page">
      <style>{SCOPED_STYLES}</style>
      {isEmpty ? (
        <div className="tp-global-map-empty" data-testid="global-map-empty">
          <div className="tp-global-map-empty-card">
            <div className="tp-global-map-empty-icon" aria-hidden="true"><Icon name="map" /></div>
            <h2>還沒有行程可以看</h2>
            <p>新增第一個行程後，這裡就會把所有景點點在地圖上、用真實導航路線連起來。</p>
            <button type="button" className="cta" onClick={openNewTrip} data-testid="global-map-new-trip">
              <span aria-hidden="true">+</span><span>新增行程</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="tp-global-map-empty" role="alert">載入行程失敗，請稍後再試</div>
      )}
    </div>
  );

  return <AppShell sidebar={<DesktopSidebarConnected />} main={main} bottomNav={<GlobalBottomNav authed={user !== null} />} />;
}
