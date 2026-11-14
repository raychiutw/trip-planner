/**
 * useTripLifecycleConfirm — 刪除／歸檔行程的「確認對話框 → 呼叫 API → toast」流程（TripsListPage 與側欄共用）。
 * 回傳的 `dialog` 要渲染在呼叫端 JSX 內；`onDone` 讓呼叫端處理成功後的收尾（清 URL、移焦點等）。
 */
import { useCallback, useState, type ReactNode } from 'react';
import ConfirmModal from '../components/shared/ConfirmModal';
import { showToast } from '../components/shared/Toast';
import { archiveTrip, unarchiveTrip, deleteTrip } from '../lib/tripMutations';

type Pending = { kind: 'delete' | 'archive'; tripId: string; label: string; archived: boolean };

export function useTripLifecycleConfirm(
  onDone?: (kind: Pending['kind'], tripId: string) => void,
  /** 附在「歸檔」確認文案後的額外說明（行程清單頁旁邊可能開著詳情才需要）。 */
  archiveNote = '',
): {
  requestDelete: (tripId: string, label: string) => void;
  /** `archived` = 目前已歸檔（確認後是取消歸檔）。 */
  requestArchive: (tripId: string, label: string, archived: boolean) => void;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const requestDelete = useCallback((tripId: string, label: string) => setPending({ kind: 'delete', tripId, label, archived: false }), []);
  const requestArchive = useCallback((tripId: string, label: string, archived: boolean) => setPending({ kind: 'archive', tripId, label, archived }), []);

  const confirm = async () => {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const { kind, tripId, label, archived } = pending;
      const result = kind === 'delete' ? await deleteTrip(tripId) : archived ? await unarchiveTrip(tripId) : await archiveTrip(tripId);
      if (!result.ok) { showToast(result.message, 'error'); return; }
      showToast(kind === 'delete' ? `已刪除「${label}」` : `已${archived ? '取消歸檔' : '歸檔'}「${label}」`, 'success');
      setPending(null);
      onDone?.(kind, tripId);
    } finally {
      setBusy(false);
    }
  };

  const dialog = (
    <ConfirmModal
      open={pending !== null}
      title={pending?.kind === 'delete' ? '確定刪除行程？' : pending?.archived ? '取消歸檔行程？' : '歸檔行程？'}
      message={pending?.kind === 'delete'
        ? `即將刪除「${pending.label}」，此操作無法復原。`
        : pending?.archived
          ? `「${pending.label}」會回到所有旅伴的「全部」清單。`
          : `「${pending?.label ?? ''}」會移到所有旅伴的「已歸檔」；旅伴仍可開啟詳情。${archiveNote}`}
      confirmLabel={pending?.kind === 'delete' ? '刪除' : pending?.archived ? '取消歸檔' : '歸檔'}
      confirmTone={pending?.kind === 'delete' ? undefined : 'primary'}
      busy={busy}
      onConfirm={() => void confirm()}
      onCancel={() => { if (!busy) setPending(null); }}
    />
  );

  return { requestDelete, requestArchive, dialog };
}
