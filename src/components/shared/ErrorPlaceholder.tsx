import type { ApiError } from '../../lib/errors';

interface ErrorPlaceholderProps {
  error: ApiError;
  tripId?: string;
}

/**
 * 原位錯誤提示 — 取代載入失敗的區塊內容。
 * 灰色背景，顯示錯誤原因 + 重新整理提示。
 */
export default function ErrorPlaceholder({ error, tripId }: ErrorPlaceholderProps) {
  return (
    <div
      className="rounded-lg bg-(--color-secondary) p-6 text-center text-muted"
      role="alert"
    >
      <p className="text-body font-medium text-foreground mb-2">{error.message}</p>
      <p className="text-footnote">請嘗試重新整理頁面</p>
      {tripId && (
        <ReportButton error={error} tripId={tripId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReportButton（內嵌於 ErrorPlaceholder）
// ---------------------------------------------------------------------------

const PENDING_KEY = 'pendingErrorReports';
const MAX_PENDING = 10;

interface PendingReport {
  tripId: string;
  url: string;
  errorCode: string;
  errorMessage: string;
  userAgent: string;
  context: string;
  timestamp: string;
}

function ReportButton({ error, tripId }: { error: ApiError; tripId: string }) {
  const handleReport = async () => {
    const report: PendingReport = {
      tripId,
      url: window.location.href,
      errorCode: error.code,
      errorMessage: error.message,
      userAgent: navigator.userAgent,
      context: JSON.stringify({ detail: error.detail, severity: error.severity }),
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      if (res.ok) {
        const { showToast } = await import('./Toast');
        showToast('已回報問題，感謝！', 'success', 2000);
      } else {
        throw new Error('report failed');
      }
    } catch {
      // 離線暫存
      savePendingReport(report);
      const { showToast } = await import('./Toast');
      showToast('目前離線，將在連線後自動回報', 'info', 3000);
    }
  };

  return (
    <button
      onClick={handleReport}
      className="mt-3 min-h-[44px] min-w-[44px] px-4 py-2 rounded-md bg-(--color-accent) text-white text-footnote font-medium"
    >
      回報問題
    </button>
  );
}

/** 離線暫存 + 上線自動送出 */
function savePendingReport(report: PendingReport) {
  try {
    const pending: PendingReport[] = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    if (pending.length >= MAX_PENDING) pending.shift();
    pending.push(report);
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch { /* localStorage 滿了就放棄 */ }
}

/** 上線後自動送出暫存報告（在 app 入口呼叫一次） */
export async function flushPendingReports() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const pending: PendingReport[] = JSON.parse(raw);
    if (pending.length === 0) return;

    const results = await Promise.allSettled(
      pending.map(r =>
        fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(r),
        })
      )
    );

    // 只保留失敗的
    const remaining = pending.filter((_, i) => results[i].status === 'rejected');
    if (remaining.length === 0) {
      localStorage.removeItem(PENDING_KEY);
    } else {
      localStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
    }
  } catch { /* 靜默失敗 */ }
}
