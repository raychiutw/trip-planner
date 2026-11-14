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
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DesktopSidebar, { type DesktopSidebarProps, type SidebarTripMenu, type SidebarUser } from './DesktopSidebar';
import ConfirmModal from '../shared/ConfirmModal';
import ToastContainer, { showToast } from '../shared/Toast';
import { archiveTrip, unarchiveTrip, deleteTrip } from '../../lib/tripMutations';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useTripSelection, isTripOwner } from '../../hooks/useMyTrips';

export type DesktopSidebarConnectedProps = Omit<DesktopSidebarProps, 'user' | 'trips' | 'tripsStatus' | 'activeTripId' | 'tripMenu'>;

type Pending = { kind: 'delete' | 'archive'; tripId: string; label: string; archived: boolean };

export default function DesktopSidebarConnected(props: DesktopSidebarConnectedProps) {
  const { user } = useCurrentUser();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
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

  // #1695：行程列右鍵選單 = 行程卡 ⋯ 同一個 TripCardMenu；刪除 / 歸檔 owner-only（沒傳＝選單項與 Delete 鍵都沒有）。
  const tripMenu = useMemo<SidebarTripMenu>(() => (t) => {
    const owner = isTripOwner(t, user?.id);
    const label = t.title || t.name || t.tripId;
    const go = (suffix: string) => (id: string) => navigate(`/trip/${encodeURIComponent(id)}/${suffix}`);
    return {
      onEdit: go('edit'),
      onCollab: go('collab'),
      onHealthCheck: go('health'),
      onNotes: go('notes'),
      onArchive: owner ? () => setPending({ kind: 'archive', tripId: t.tripId, label, archived: t.archivedAt != null }) : undefined,
      archived: t.archivedAt != null,
      onDelete: owner ? () => setPending({ kind: 'delete', tripId: t.tripId, label, archived: false }) : undefined,
    };
  }, [navigate, user?.id]);

  const confirmPending = async () => {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const { kind, tripId, label, archived } = pending;
      const result = kind === 'delete' ? await deleteTrip(tripId) : archived ? await unarchiveTrip(tripId) : await archiveTrip(tripId);
      if (!result.ok) { showToast(result.message, 'error'); return; }
      showToast(kind === 'delete' ? `已刪除「${label}」` : `已${archived ? '取消歸檔' : '歸檔'}「${label}」`, 'success');
      // 刪掉正在看的行程 → 離開已不存在的詳情
      if (kind === 'delete' && activeTripId === tripId && new URLSearchParams(search).get('selected') === tripId) navigate('/trips', { replace: true });
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ToastContainer />
      <ConfirmModal
        open={pending !== null}
        title={pending?.kind === 'delete' ? '確定刪除行程？' : pending?.archived ? '取消歸檔行程？' : '歸檔行程？'}
        message={pending?.kind === 'delete'
          ? `即將刪除「${pending.label}」，此操作無法復原。`
          : pending?.archived
            ? `「${pending.label}」會回到所有旅伴的「全部」清單。`
            : `「${pending?.label ?? ''}」會移到所有旅伴的「已歸檔」；旅伴仍可開啟詳情。`}
        confirmLabel={pending?.kind === 'delete' ? '刪除' : pending?.archived ? '取消歸檔' : '歸檔'}
        confirmTone={pending?.kind === 'delete' ? undefined : 'primary'}
        busy={busy}
        onConfirm={() => void confirmPending()}
        onCancel={() => { if (!busy) setPending(null); }}
      />
      <DesktopSidebar {...props} user={sidebarUser} trips={trips} tripsStatus={tripsStatus} activeTripId={activeTripId} tripMenu={tripMenu} />
    </>
  );
}
