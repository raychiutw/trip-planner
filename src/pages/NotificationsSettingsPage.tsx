/**
 * NotificationsSettingsPage — Section 2 (terracotta-account-hub-page) sub-page
 *
 * Route: /account/notifications
 * Stub page — mockup section 19 規範有此 row 但 backend 通知功能尚在開發中。
 * 初版顯示「即將推出」 + 預先 list 規劃中的通知類型。後續 polish 補實際 toggle。
 */
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import Icon from '../components/shared/Icon';

const SCOPED_STYLES = `
.tp-notif-shell {
  min-height: 100%;
  background: var(--color-secondary);
  overflow-y: auto;
}
.tp-notif-inner {
  max-width: 720px; margin: 0 auto;
  padding: 24px 16px 64px;
  display: flex; flex-direction: column; gap: 16px;
}
@media (min-width: 768px) {
  .tp-notif-inner { padding: 40px 24px 80px; gap: 24px; }
}
.tp-notif-stub {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 32px 20px;
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.tp-notif-stub-icon {
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  display: grid; place-items: center;
}
.tp-notif-stub-icon .svg-icon { width: 28px; height: 28px; }
.tp-notif-stub-title {
  font-size: var(--font-size-title3); font-weight: 800;
  color: var(--color-foreground);
  margin: 0;
}
.tp-notif-stub-copy {
  font-size: var(--font-size-callout);
  color: var(--color-muted);
  max-width: 360px;
}
.tp-notif-list {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.tp-notif-row {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  opacity: 0.55;
  cursor: not-allowed;
}
.tp-notif-row:last-child { border-bottom: none; }
.tp-notif-row-icon {
  width: 36px; height: 36px; border-radius: var(--radius-md);
  background: var(--color-secondary);
  color: var(--color-muted);
  display: grid; place-items: center;
  flex-shrink: 0;
}
.tp-notif-row-icon .svg-icon { width: 18px; height: 18px; }
.tp-notif-row-body { flex: 1; }
.tp-notif-row-title {
  font-size: var(--font-size-callout); font-weight: 600;
  color: var(--color-foreground);
}
.tp-notif-row-helper {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
}
.tp-notif-row-status {
  font-size: var(--font-size-caption2); font-weight: 700;
  color: var(--color-muted);
  letter-spacing: 0.1em; text-transform: uppercase;
}
`;

const PLANNED_TYPES = [
  { key: 'trip-update', icon: 'home', title: '行程更新通知', helper: '旅伴改了行程、AI 排程完成' },
  { key: 'invitation', icon: 'group', title: '旅伴邀請', helper: '收到新的共編邀請' },
  { key: 'system', icon: 'info', title: '系統通知', helper: 'Tripline 維護、版本更新' },
];

export default function NotificationsSettingsPage() {
  useRequireAuth();
  const navigate = useNavigate();

  const sidebar = <DesktopSidebarConnected />;
  const main = (
    <div className="tp-notif-shell" data-testid="notifications-page">
      <TitleBar title="通知設定" back={() => navigate('/account')} />
      <div className="tp-notif-inner">
        <section className="tp-notif-stub">
          <div className="tp-notif-stub-icon" aria-hidden="true"><Icon name="lightbulb" /></div>
          <h2 className="tp-notif-stub-title">即將推出</h2>
          <p className="tp-notif-stub-copy">
            通知功能還在開發中。下面列的是規劃中的通知類型，未來開放後可以分別 opt-in/opt-out。
          </p>
        </section>

        <section className="tp-notif-list">
          {PLANNED_TYPES.map((t) => (
            <div key={t.key} className="tp-notif-row" data-testid={`notif-row-${t.key}`}>
              <div className="tp-notif-row-icon" aria-hidden="true"><Icon name={t.icon} /></div>
              <div className="tp-notif-row-body">
                <div className="tp-notif-row-title">{t.title}</div>
                <div className="tp-notif-row-helper">{t.helper}</div>
              </div>
              <div className="tp-notif-row-status">即將推出</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <AppShell sidebar={sidebar} main={main} bottomNav={<GlobalBottomNav authed={true} />} />
    </>
  );
}
