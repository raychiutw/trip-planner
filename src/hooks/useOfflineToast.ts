import { useRef, useEffect } from 'react';
import { showToast } from '../components/shared/Toast';

/**
 * 監控 online/offline 變化，自動觸發 Toast 通知。
 * 不再回傳 state — 由 ToastContainer 統一管理顯示。
 */
export function useOfflineToast(isOnline: boolean): void {
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      showToast('已離線 — 顯示快取資料', 'offline', 3000);
    } else if (wasOffline.current) {
      wasOffline.current = false;
      showToast('已恢復連線', 'online', 2000);
    }
  }, [isOnline]);
}
