/**
 * DesktopSidebarConnected — auto-fetch current user + 我的行程清單（rev2）。
 *
 * Connected variant：useCurrentUser 填 `user`、useTripSelection 填 `trips` 與
 * ActiveTripContext 偏好；明確 URL（/trips?selected=<id> 或 /trip/:id）優先標示。
 *
 * Pure <DesktopSidebar/>（prop-driven）保留給測試 / explicit override。
 *
 * Loading state：user / trips 還沒 resolve 時 sidebar 保持 neutral skeleton，
 * 避免 login/account + 清單 flicker。
 */
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import DesktopSidebar, { type DesktopSidebarProps, type SidebarUser } from './DesktopSidebar';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useTripSelection } from '../../hooks/useMyTrips';

export type DesktopSidebarConnectedProps = Omit<DesktopSidebarProps, 'user' | 'trips' | 'tripsStatus' | 'activeTripId'>;

export default function DesktopSidebarConnected(props: DesktopSidebarConnectedProps) {
  const { user } = useCurrentUser();
  const { pathname, search } = useLocation();
  const { trips, status: tripsStatus, activeTripId: preferredTripId } = useTripSelection(user?.id, { fallback: false });

  const sidebarUser = useMemo<SidebarUser | null | undefined>(() => {
    if (user === undefined) return undefined;
    if (user === null) return null;
    return {
      // v2.33.121: 沒設 displayName 時用 email local-part（對齊 AccountPage / ChatPage）
      name: user.displayName ?? user.email.split('@')[0] ?? user.email,
      email: user.email,
    };
  }, [user]);

  const activeTripId = useMemo(() => {
    const sel = new URLSearchParams(search).get('selected');
    if (sel) return sel;
    const m = pathname.match(/^\/trip\/([^/]+)/);
    return m ? m[1] : preferredTripId;
  }, [pathname, search, preferredTripId]);

  return <DesktopSidebar {...props} user={sidebarUser} trips={trips} tripsStatus={tripsStatus} activeTripId={activeTripId} />;
}
