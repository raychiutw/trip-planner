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
import { useLocation, useNavigate } from 'react-router-dom';
import DesktopSidebar, { type DesktopSidebarProps, type SidebarTripMenu, type SidebarUser } from './DesktopSidebar';
import { useTripLifecycleConfirm } from '../../hooks/useTripLifecycleConfirm';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useTripSelection, isTripOwner } from '../../hooks/useMyTrips';

export type DesktopSidebarConnectedProps = Omit<DesktopSidebarProps, 'user' | 'trips' | 'tripsStatus' | 'activeTripId' | 'tripMenu'>;

export default function DesktopSidebarConnected(props: DesktopSidebarConnectedProps) {
  const { user } = useCurrentUser();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
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

  // 刪掉正在看的行程 → 離開已不存在的詳情
  const { requestDelete, requestArchive, dialog } = useTripLifecycleConfirm((kind, tripId) => {
    if (kind === 'delete' && activeTripId === tripId && new URLSearchParams(search).get('selected') === tripId) navigate('/trips', { replace: true });
  });

  // #1695：行程列右鍵選單 = 行程卡 ⋯ 同一個 TripCardMenu；刪除 / 歸檔 owner-only（沒傳＝選單項與 Delete 鍵都沒有）。
  const tripMenu = useMemo<SidebarTripMenu>(() => (t) => {
    const owner = isTripOwner(t, user?.id);
    const label = t.title || t.name || t.tripId;
    const go = (suffix: string) => (id: string) => navigate(`/trip/${encodeURIComponent(id)}/${suffix}`);
    const del = owner ? () => requestDelete(t.tripId, label) : undefined;
    return {
      onEdit: go('edit'),
      onCollab: go('collab'),
      onHealthCheck: go('health'),
      onNotes: go('notes'),
      onArchive: owner ? () => requestArchive(t.tripId, label, t.archivedAt != null) : undefined,
      archived: t.archivedAt != null,
      onDelete: del,
      onDeleteKey: del,
    };
  }, [navigate, user?.id, requestDelete, requestArchive]);

  return (
    <>
      {dialog}
      <DesktopSidebar {...props} user={sidebarUser} trips={trips} tripsStatus={tripsStatus} activeTripId={activeTripId} tripMenu={tripMenu} />
    </>
  );
}
