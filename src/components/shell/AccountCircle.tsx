/**
 * AccountCircle — rev2 手機統一 header 右上帳號圓圈（owner 2026-07-17 mockup `.ph-avatar`）。
 *
 * 手機四個根 tab 頁（聊天/行程/地圖/收藏）的 header 右上顯示帳號圓圈（首字母）→ /account；
 * 匿名 → 登入 icon → /login。桌機帳號入口是 sidebar 左下 chip → 本元件 CSS 桌機隱藏
 * （≥1024）。搭配底部 nav 由 5-tab 降 4-tab（帳號移出 tab slot）。
 */
import { Link } from 'react-router-dom';
import Icon from '../shared/Icon';
import { useCurrentUser } from '../../hooks/useCurrentUser';

export const ACCOUNT_CIRCLE_STYLES = `
.tp-account-circle {
  width: 30px; height: 30px; border-radius: var(--radius-full);
  display: none; place-items: center; flex-shrink: 0;
  background: var(--color-accent-fill); color: var(--color-accent-foreground);
  font-size: 13px; font-weight: 800; line-height: 1;
  text-decoration: none; cursor: pointer;
}
.tp-account-circle .svg-icon { width: 17px; height: 17px; }
.tp-account-circle:focus-visible { outline: none; box-shadow: var(--shadow-ring); }
/* 桌機帳號在 sidebar 左下 chip → header 圓圈只手機顯示。 */
@media (max-width: 1023px) {
  .tp-account-circle { display: grid; }
}
`;

export default function AccountCircle() {
  const { user } = useCurrentUser();

  // 載入中（undefined）先不佔位，避免閃爍；解析後才顯示。
  if (user === undefined) return null;

  if (!user) {
    return (
      <>
        <style>{ACCOUNT_CIRCLE_STYLES}</style>
        <Link
          to="/login"
          className="tp-account-circle"
          aria-label="登入"
          data-testid="titlebar-account"
        >
          <Icon name="user" />
        </Link>
      </>
    );
  }

  const source = (user.displayName || user.email || '?').trim();
  const letter = (source[0] || '?').toUpperCase();
  return (
    <>
      <style>{ACCOUNT_CIRCLE_STYLES}</style>
      <Link
        to="/account"
        className="tp-account-circle"
        aria-label="帳號"
        data-testid="titlebar-account"
      >
        {letter}
      </Link>
    </>
  );
}
