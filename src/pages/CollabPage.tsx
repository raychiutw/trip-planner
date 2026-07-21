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
import { useCurrentUser } from '../hooks/useCurrentUser';
import { apiFetch } from '../lib/apiClient';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import OperationShell from '../components/shell/OperationShell';
import CollabPanel from '../components/trip/CollabPanel';
import ToastContainer from '../components/shared/Toast';

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
@media (min-width: 768px) {
  .tp-collab-page-title { font-size: var(--font-size-title1); padding: 32px 24px 0; }
}
`;

interface TripMeta {
  title?: string | null;
  name?: string | null;
}

export default function CollabPage() {
  const auth = useRequireAuth();
  const { user } = useCurrentUser();
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();

  const [tripMeta, setTripMeta] = useState<TripMeta | null>(null);

  useEffect(() => {
    if (!auth.user || !tripId) return;
    let cancelled = false;
    apiFetch<TripMeta>(`/trips/${tripId}`)
      .then((data) => { if (!cancelled) setTripMeta(data); })
      .catch(() => { /* 載入失敗不擋 panel — panel 內 fetch /permissions 仍可獨立顯示 */ });
    return () => { cancelled = true; };
  }, [auth.user, tripId]);

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
        bottomNav={<GlobalBottomNav authed={user !== null} />}
      >
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)' }}>
          無效的行程 ID
        </div>
      </OperationShell>
    );
  }

  const tripName = tripMeta?.title || tripMeta?.name || '行程';

  return (
    <>
      <ToastContainer />
      <OperationShell
        shellClassName="tp-collab-shell"
        testId="collab-page"
        title="共編設定"
        back={handleBack}
        bottomNav={<GlobalBottomNav authed={user !== null} />}
      >
        <style>{SCOPED_STYLES}</style>
        <h2 className="tp-collab-page-title">{tripName}</h2>
        <CollabPanel tripId={tripId} />
      </OperationShell>
    </>
  );
}
