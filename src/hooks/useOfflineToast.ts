import { useRef, useEffect } from 'react';
import { showToast } from '../components/shared/Toast';

/**
 * 恢復連線時跳 Toast。離線本身由全域 ServerStatusBanner 提示（唯一的離線提示，#1587 14），
 * 這裡不再另跳離線 Toast。不回傳 state — 由 ToastContainer 統一管理顯示。
 */
export function useOfflineToast(isOnline: boolean): void {
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
    } else if (wasOffline.current) {
      wasOffline.current = false;
      showToast('已恢復連線', 'online', 2000);
    }
  }, [isOnline]);
}
