/**
 * DesktopSidebarConnected — V2-P1 wrapper that auto-fetches current user
 *
 * Connected variant of <DesktopSidebar/> that uses useCurrentUser hook to
 * populate the `user` prop。Use this in pages where you want sidebar to
 * automatically show logged-in user (TripPage / ManagePage / etc.) without
 * manually wiring fetch in each caller。
 *
 * Pure DesktopSidebar (prop-driven) 仍保留 for testing / explicit override
 * use cases。
 *
 * Loading state：user 還沒 fetch 完時 sidebar 保持 neutral skeleton，不先渲染
 * 「登入」或「未登入」。只有 userinfo resolve 後才切 authenticated /
 * unauthenticated UI，避免 login/account flicker。
 */
import { useMemo } from 'react';
import DesktopSidebar, { type DesktopSidebarProps, type SidebarUser } from './DesktopSidebar';
import { useCurrentUser } from '../../hooks/useCurrentUser';

export type DesktopSidebarConnectedProps = Omit<DesktopSidebarProps, 'user'>;

export default function DesktopSidebarConnected(props: DesktopSidebarConnectedProps) {
  const { user } = useCurrentUser();

  const sidebarUser = useMemo<SidebarUser | null | undefined>(() => {
    if (user === undefined) return undefined;
    if (user === null) return null;
    return {
      name: user.displayName ?? user.email,
      email: user.email,
    };
  }, [user]);

  return <DesktopSidebar {...props} user={sidebarUser} />;
}
