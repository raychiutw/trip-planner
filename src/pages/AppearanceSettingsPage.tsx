/**
 * AppearanceSettingsPage — Section 2 (terracotta-account-hub-page) sub-page
 *
 * Route: /account/appearance
 * 既有 sidebar `<ThemeToggle>` + 主題選擇 grid 拆出來作 standalone page，
 * Account hub「外觀設定」row 點進來。
 */
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useDarkMode } from '../hooks/useDarkMode';
import { COLOR_MODE_OPTIONS } from '../lib/appearance';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import ThemeToggle from '../components/shared/ThemeToggle';
import clsx from 'clsx';

const SCOPED_STYLES = `
.tp-appearance-shell {
  min-height: 100%;
  background: var(--color-secondary);
  overflow-y: auto;
}
.tp-appearance-inner {
  max-width: 720px; margin: 0 auto;
  padding: 24px 16px 64px;
  display: flex; flex-direction: column; gap: 24px;
}
@media (min-width: 768px) {
  .tp-appearance-inner { padding: 40px 24px 80px; gap: 32px; }
}
.tp-appearance-section {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px;
  display: flex; flex-direction: column; gap: 16px;
}
.tp-appearance-section-label {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--color-muted);
}
.tp-appearance-section h2 {
  font-size: var(--font-size-title3); font-weight: 800;
  color: var(--color-foreground);
  margin: 0;
}
.tp-appearance-helper {
  font-size: var(--font-size-callout);
  color: var(--color-muted);
}
.tp-appearance-modes-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
`;

export default function AppearanceSettingsPage() {
  useRequireAuth();
  const { colorMode, setColorMode } = useDarkMode();
  const navigate = useNavigate();

  const sidebar = <DesktopSidebarConnected />;
  const main = (
    <div className="tp-appearance-shell" data-testid="appearance-page">
      <TitleBar title="外觀設定" back={() => navigate('/account')} />
      <div className="tp-appearance-inner">
        <section className="tp-appearance-section">
          <div className="tp-appearance-section-label">深淺模式</div>
          <h2>跟系統 / 強制淺 / 強制深</h2>
          <p className="tp-appearance-helper">沒選的話走「自動」依系統喜好。</p>
          <ThemeToggle testId="appearance-theme" />
        </section>

        <section className="tp-appearance-section">
          <div className="tp-appearance-section-label">主題色</div>
          <h2>選擇色票</h2>
          <p className="tp-appearance-helper">每個主題對應不同的 accent 跟暖色比例。</p>
          <div className="tp-appearance-modes-grid">
            {COLOR_MODE_OPTIONS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={clsx('color-mode-card', m.key === colorMode && 'active')}
                onClick={() => setColorMode(m.key)}
                data-testid={`appearance-mode-${m.key}`}
              >
                <div className={`color-mode-preview color-mode-${m.key}`}>
                  <div className="cmp-top"></div>
                  <div className="cmp-bottom">
                    <div className="cmp-input"></div>
                    <div className="cmp-dot"></div>
                  </div>
                </div>
                <div className="text-caption text-muted mt-1">{m.label}</div>
              </button>
            ))}
          </div>
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
