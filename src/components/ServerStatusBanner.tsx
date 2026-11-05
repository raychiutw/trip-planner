/**
 * ServerStatusBanner — 連線中斷 / server unreachable 即時告知 user (v2.33.129 G11)
 *
 * 之前 backend 5xx / 網路斷時 app 完全 silent：user 看 spinner 不知是慢還是壞。
 * 訂閱 `useOnlineStatus()`（同 useAutosave SaveStatus 用的同訊號來源），離線
 * 時 sticky banner top-of-page 提示。online 時不 render。
 *
 * 不檢 /api/health endpoint：useOnlineStatus 已 cover apiFetch 失敗 +
 * navigator.onLine + SW message 三個 signal source，再加 health ping 是
 * 重複 + 加 quota burn。Health endpoint 給外部 uptime monitor 用。
 */
import { useLayoutEffect, useRef } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { setOfflineBannerVisible } from '../lib/toastBus';

export function ServerStatusBanner(): React.JSX.Element | null {
  const isOnline = useOnlineStatus();
  const ref = useRef<HTMLDivElement>(null);

  // 橫幅在 100dvh 的 .app-shell 之外；把自己的高度發布成 --server-banner-h，
  // .app-shell 以 calc(100dvh - var(--server-banner-h)) 讓出空間，總高不變、整頁不出現捲軸。
  useLayoutEffect(() => {
    const el = ref.current;
    if (isOnline || !el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--server-banner-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    publish();
    setOfflineBannerVisible(true);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--server-banner-h');
      setOfflineBannerVisible(false);
    };
  }, [isOnline]);

  if (isOnline) return null;
  return (
    <div
      ref={ref}
      role="alert"
      data-testid="server-status-banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        background: 'var(--color-destructive-bg)',
        color: 'var(--color-destructive)',
        padding: '8px 16px',
        fontSize: 14,
        textAlign: 'center',
        borderBottom: '1px solid var(--color-destructive)',
      }}
    >
      連線中斷，等待恢復網路中。已輸入的資料會在連線後自動上傳。
    </div>
  );
}
