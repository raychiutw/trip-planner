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
 * Loading state：user 還沒 fetch 完時 sidebar 渲染「未登入」chip — 跟
 * unauthenticated state 一致，避免 flicker。
 */
import { useMemo } from 'react';
import DesktopSidebar, { type DesktopSidebarProps, type SidebarUser } from './DesktopSidebar';
import { useCurrentUser } from '../../hooks/useCurrentUser';

export type DesktopSidebarConnectedProps = Omit<DesktopSidebarProps, 'user'>;

export default function DesktopSidebarConnected(props: DesktopSidebarConnectedProps) {
  const { user } = useCurrentUser();

  const sidebarUser = useMemo<SidebarUser | null>(() => {
    if (!user) return null; // undefined (loading) or null (unauthed) → 未登入 state
    return {
      name: user.displayName ?? user.email,
      email: user.email,
    };
  }, [user]);

  // Admin gate: matches getAuth() server logic — owner email exposes
  // legacy /manage editor + data tooling. Anyone else doesn't see it.
  const isAdmin = user?.email === 'lean.lean@gmail.com';

  return <DesktopSidebar {...props} user={sidebarUser} isAdmin={isAdmin} />;
}
