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
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function ServerStatusBanner(): React.JSX.Element | null {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div
      role="alert"
      data-testid="server-status-banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        background: 'var(--color-priority-high-bg, #fde2e2)',
        color: 'var(--color-priority-high-text, #8b2828)',
        padding: '8px 16px',
        fontSize: 14,
        textAlign: 'center',
        borderBottom: '1px solid var(--color-priority-high-dot, #c44545)',
      }}
    >
      連線中斷，等待恢復網路中。已輸入的資料會在連線後自動上傳。
    </div>
  );
}
