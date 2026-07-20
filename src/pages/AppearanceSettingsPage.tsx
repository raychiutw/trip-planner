/**
 * AppearanceSettingsPage — Section 2 (terracotta-account-hub-page) sub-page
 *
 * Route: /account/appearance
 * 既有 sidebar `<ThemeToggle>` 拆出來作 standalone page，Account hub「外觀設定」row 點進來。
 *
 * v2.30.10: 移除「主題色 / 選擇色票」card grid section — 跟「深淺模式」ThemeToggle
 * 操控同一個 colorMode state（淺/自動/深），功能重複。
 */
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import ThemeToggle from '../components/shared/ThemeToggle';

const SCOPED_STYLES = `
.tp-appearance-shell {
  min-height: 100%;
  /* height:100% 不可省（原本只有 min-height）。少了它這個 div 雖然宣告了
   * overflow-y:auto 卻永遠不會溢出 → 它是個「從不捲動的 scrollport」，於是
   * ① 內部的 position:sticky TitleBar 不會黏，被外層 .app-shell-main 整個帶走；
   * ② TitleBar 的 scroll edge effect 綁到它之後 scrollTop 恆 0，永不觸發。
   * 對齊 .explore-shell / .favorites-shell / .tp-trips-shell 等同類頁。 */
  height: 100%;
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
`;

export default function AppearanceSettingsPage() {
  useRequireAuth();
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
