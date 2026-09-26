/**
 * CollabPage — 共編設定 `/trip/:tripId/collab`(v2.18.0)
 *
 * 取代 v2.17 的 CollabSheet bottom-sheet pattern。User 拍板「獨立頁面 + 共用 title +
 * back 回前頁,右側無 actions」。
 *
 * v2.57.x：遷入 TripStackLayout（owner 2026-07-21「桌機三欄 shell panel 化」）——
 *   桌機（TripStackLayout host，inStack=true）：OperationShell bare panel 塞右欄，
 *     中欄行程詳情（含新補的 TitleBar）保留，不再是獨立整頁。
 *   手機（inStack=false，無 host）：OperationShell 整頁 AppShell（既有行為，
 *     GlobalBottomNav 透過新增的 `bottomNav` prop 保留 — 遷移前手機版本來就有底部 tab）。
 * 詳見 docs/design-sessions/2026-07-21-desktop-third-column-panelization.html。
 *
 * 進入路徑:
 *   - TripsList card kebab menu 「共編」
 *   - TripsListPage embedded mode 的 EmbeddedActionMenu「共編設定」
 *   - TripCardMenu 「共編」
 */
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { apiFetch } from '../lib/apiClient';
import type { CollabRole } from '../types/api';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import OperationShell from '../components/shell/OperationShell';
import CollabPanel from '../components/trip/CollabPanel';
import ToastContainer from '../components/shared/Toast';
import PageErrorState from '../components/shared/PageErrorState';

const SCOPED_STYLES = `
.tp-collab-shell {
  min-height: 100%;
  background: var(--color-secondary);
  height: 100%;
  overflow-y: auto;
}
/* 2026-07-21 dark-mode elevation audit：桌機第三欄（TripStackLayout 右欄 bare panel）
 * 內比中欄內容再高一階 — 面板自己不透明背景需對齊 .app-shell-sheet 的
 * --color-tertiary，否則覆蓋掉那層 base（見 AppShell.tsx 註解）。手機整頁模式
 * （面板在 .app-shell-main 內）不受此 override 影響，維持原本 --color-secondary。 */
.app-shell-sheet .tp-collab-shell {
  background: var(--color-tertiary);
}
.tp-collab-page-title {
  /* page-title under TitleBar — DESIGN.md page-title token (28/36/700) */
  font-size: var(--font-size-title2);
  font-weight: 700;
  color: var(--color-foreground);
  letter-spacing: -0.01em;
  margin: 0;
  padding: 24px 16px 0;
  max-width: 720px;
  margin-left: auto; margin-right: auto;
}
.tp-collab-page-state {
  max-width: 720px;
  margin: 16px auto 0;
  padding: 20px 16px;
  color: var(--color-muted);
  line-height: 1.55;
}
.tp-collab-page-error {
  max-width: 720px;
  margin: 24px 16px;
  padding: 20px 16px;
  border: 1px solid var(--color-destructive);
  border-radius: var(--radius-md);
  background: var(--color-destructive-bg);
  color: var(--color-destructive);
}
.tp-collab-page-error-title { margin: 0 0 8px; font-weight: 700; }
.tp-collab-page-error-desc { margin: 0 0 16px; line-height: 1.55; }
.tp-collab-page-error-btn {
  min-height: var(--spacing-tap-min);
  padding: 0 16px;
  border: 1px solid var(--color-destructive);
  border-radius: var(--radius-full);
  background: var(--color-background);
  color: var(--color-destructive);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.tp-collab-page-error-btn:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
@media (min-width: 768px) {
  .tp-collab-page-title { font-size: var(--font-size-title); padding: 32px 24px 0; }
  .tp-collab-page-error { margin: 24px auto; }
}
`;

interface TripMeta {
  tripId: string;
  title?: string | null;
  name?: string | null;
  role: CollabRole;
}

export default function CollabPage() {
  const auth = useRequireAuth();
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();

  const [tripResult, setTripResult] = useState<{ tripId: string; trip?: TripMeta; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!auth.user || !tripId) return;
    let cancelled = false;
    setTripResult(null);
    // /my-trips contains both the trip's display name and this user's authoritative role.
    apiFetch<TripMeta[]>('/my-trips')
      .then((trips) => {
        if (cancelled) return;
        const trip = Array.isArray(trips) ? trips.find((item) => item.tripId === tripId) : undefined;
        setTripResult((trip?.role === 'owner' || trip?.role === 'member' || trip?.role === 'viewer') && (trip.title || trip.name)
          ? { tripId, trip }
          : { tripId, error: '無法確認此行程或你的權限，請返回行程清單後重試。' });
      })
      .catch(() => {
        if (!cancelled) setTripResult({ tripId, error: '無法確認要管理的行程，請重試。' });
      });
    return () => { cancelled = true; };
  }, [auth.user, tripId, retry]);

  // v2.33.139: 拔 history.back 改 explicit URL (對齊 useNavigateBack hook
  // 的新行為)。回 trip detail（/trips?selected=:id）或 /trips fallback。
  const handleBack = () => {
    if (tripId) {
      navigate(`/trips?selected=${encodeURIComponent(tripId)}`);
    } else {
      navigate('/trips');
    }
  };

  if (!auth.user) return null;
  if (!tripId) {
    return (
      <OperationShell
        shellClassName="tp-collab-shell"
        testId="collab-page"
        title="共編設定"
        back={() => navigate('/trips')}
        bottomNav={<GlobalBottomNav authed={auth.user !== null} />}
      >
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)' }}>
          無效的行程 ID
        </div>
      </OperationShell>
    );
  }

  const current = tripResult?.tripId === tripId ? tripResult : null;
  const trip = current?.trip;
  const tripName = trip?.title || trip?.name;

  return (
    <>
      <ToastContainer />
      <OperationShell
        shellClassName="tp-collab-shell"
        testId="collab-page"
        title="共編設定"
        back={handleBack}
        bottomNav={<GlobalBottomNav authed={auth.user !== null} />}
      >
        <style>{SCOPED_STYLES}</style>
        {tripName ? <h2 className="tp-collab-page-title">{tripName}</h2> : null}
        {!current && <div className="tp-collab-page-state">正在確認行程…</div>}
        {current?.error && (
          <PageErrorState
            className="tp-collab-page-error"
            title="無法確認行程"
            message={`${current.error}（ID：${tripId}）`}
            onRetry={() => setRetry((value) => value + 1)}
            testId="collab-page-error"
          />
        )}
        {trip?.role === 'owner' && (
          <>
            <div className="tp-collab-page-state">你是擁有者，可以邀請、變更角色與移除成員。</div>
            <CollabPanel tripId={tripId} />
          </>
        )}
        {trip?.role === 'member' && (
          <div className="tp-collab-page-state">你是共編成員，可以檢視與編輯此行程。只有擁有者能管理邀請與成員。</div>
        )}
        {trip?.role === 'viewer' && (
          <div className="tp-collab-page-state">你是檢視成員，只能檢視此行程。只有擁有者能管理邀請與成員。</div>
        )}
      </OperationShell>
    </>
  );
}
