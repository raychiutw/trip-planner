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

const EMPTY_STATE_CLASSES = 'grid min-h-0 flex-1 place-items-center bg-[linear-gradient(135deg,var(--color-accent-subtle)_0%,var(--color-tertiary)_100%)] px-6 py-8';

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
    <div className="relative flex h-full w-full flex-col bg-secondary" data-testid="global-map-page">
      {isEmpty ? (
        <div className={EMPTY_STATE_CLASSES} data-testid="global-map-empty">
          <div className="flex max-w-[480px] flex-col items-center gap-4 rounded-lg border border-border bg-background px-7 py-9 text-center shadow-md">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-accent-subtle text-accent" aria-hidden="true"><Icon name="map" /></div>
            <h2 className="m-0 text-title2 font-extrabold tracking-[-0.01em]">還沒有行程可以看</h2>
            <p className="m-0 text-callout leading-[1.55] text-muted">新增第一個行程後，這裡就會把所有景點點在地圖上、用真實導航路線連起來。</p>
            <button type="button" className="inline-flex min-h-[var(--spacing-tap-min)] cursor-pointer items-center gap-2 rounded-full border-0 bg-accent-fill px-[22px] py-3 text-callout font-bold leading-[var(--line-height-normal)] text-accent-foreground hover:brightness-[var(--hover-brightness)]" onClick={openNewTrip} data-testid="global-map-new-trip">
              <span aria-hidden="true">+</span><span>新增行程</span>
            </button>
          </div>
        </div>
      ) : (
        <div className={EMPTY_STATE_CLASSES} role="alert">載入行程失敗，請稍後再試</div>
      )}
    </div>
  );

  return <AppShell sidebar={<DesktopSidebarConnected />} main={main} bottomNav={<GlobalBottomNav authed={user !== null} />} />;
}
