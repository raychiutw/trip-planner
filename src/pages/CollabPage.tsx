/**
 * CollabPage — 共編設定獨立頁面 `/trip/:tripId/collab`(v2.18.0)
 *
 * 取代 v2.17 的 CollabSheet bottom-sheet pattern。User 拍板「獨立頁面 + 共用 title +
 * back 回前頁,右側無 actions」。
 *
 * Layout:
 *   AppShell
 *     sidebar:DesktopSidebarConnected(行程 active)
 *     main:
 *       TitleBar(共用 .tp-titlebar)
 *         ← back  共編設定                      ← 左 back / 右無 action
 *       <CollabPanel tripId={...} />
 *     bottomNav:GlobalBottomNav(行程 active)
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
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import CollabPanel from '../components/trip/CollabPanel';
import ToastContainer from '../components/shared/Toast';

const SCOPED_STYLES = `
.tp-collab-shell {
  min-height: 100%;
  background: var(--color-secondary);
  height: 100%;
  overflow-y: auto;
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

  const handleBack = () => {
    // 優先用 browser history(回到原進入頁面),否則 fallback /trips
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else if (tripId) {
      navigate(`/trips?selected=${encodeURIComponent(tripId)}`);
    } else {
      navigate('/trips');
    }
  };

  if (!auth.user) return null;
  if (!tripId) {
    return (
      <AppShell
        sidebar={<DesktopSidebarConnected />}
        main={
          <div className="tp-collab-shell" data-testid="collab-page">
            <TitleBar title="共編設定" back={() => navigate('/trips')} backLabel="返回行程列表" />
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)' }}>
              無效的行程 ID
            </div>
          </div>
        }
        bottomNav={<GlobalBottomNav authed={!!user} />}
      />
    );
  }

  const tripName = tripMeta?.title || tripMeta?.name || '行程';

  return (
    <>
      <ToastContainer />
      <AppShell
        sidebar={<DesktopSidebarConnected />}
        main={
          <div className="tp-collab-shell" data-testid="collab-page">
            <style>{SCOPED_STYLES}</style>
            <TitleBar
              title="共編設定"
              back={handleBack}
              backLabel="返回前頁"
            />
            <h2 className="tp-collab-page-title">{tripName}</h2>
            <CollabPanel tripId={tripId} />
          </div>
        }
        bottomNav={<GlobalBottomNav authed={!!user} />}
      />
    </>
  );
}
