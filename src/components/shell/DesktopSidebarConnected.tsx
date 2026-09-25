/**
 * DesktopSidebarConnected — auto-fetch current user + 我的行程清單（rev2）。
 *
 * Connected variant：useCurrentUser 填 `user`、useMyTrips 填 `trips`；
 * active trip 由 ActiveTripContext 提供，與聊天的選擇保持一致。
 *
 * Pure <DesktopSidebar/>（prop-driven）保留給測試 / explicit override。
 *
 * Unknown identity shows loading/retry in the existing account area;
 * the trip list retains its loading skeleton until identity resolves.
 */
import AuthStatus from '../shared/AuthStatus';
import { useMemo } from 'react';
import DesktopSidebar, { type DesktopSidebarProps, type SidebarUser } from './DesktopSidebar';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useMyTrips } from '../../hooks/useMyTrips';
import { useActiveTrip } from '../../contexts/ActiveTripContext';

export type DesktopSidebarConnectedProps = Omit<DesktopSidebarProps, 'user' | 'userStatus' | 'trips' | 'tripsStatus' | 'activeTripId'>;

export default function DesktopSidebarConnected(props: DesktopSidebarConnectedProps) {
  const auth = useCurrentUser();
  const { user } = auth;
  const { activeTripId } = useActiveTrip();
  const { trips, status: tripsStatus } = useMyTrips(user?.id);

  const sidebarUser = useMemo<SidebarUser | null | undefined>(() => {
    if (user === undefined) return undefined;
    if (user === null) return null;
    return {
      // v2.33.121: 沒設 displayName 時用 email local-part（對齊 AccountPage / ChatPage）
      name: user.displayName ?? user.email.split('@')[0] ?? user.email,
      email: user.email,
    };
  }, [user]);

  return <DesktopSidebar {...props} user={sidebarUser} userStatus={<AuthStatus auth={auth} />} trips={trips} tripsStatus={tripsStatus} activeTripId={activeTripId} />;
}
