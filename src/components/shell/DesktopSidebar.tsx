/**
 * DesktopSidebar — app-level sidebar.
 *
 * 5-item primary nav matching mockup-trip-v2 / mockup-shell-v2-terracotta:
 *   聊天 / 行程 / 地圖 / 探索 / 登入
 *
 * Settings (connected-apps, developer/apps, sessions) reach via direct URL
 * or future account-chip menu — they're admin/maintenance routes, not core
 * "produce/consume trips" actions.
 *
 * 「行程」nav matches /trips AND /manage AND /trip/* so per-trip sub-routes
 * stay highlighted on this nav, not the global /map view.
 *
 * 聊天 + 地圖 are placeholder pages (chat with LLM concierge / cross-trip
 * map). Visible in sidebar to set roadmap expectations even before full
 * implementation lands.
 *
 * /devex-review 2026-04-26：sidebar 拿掉「登出」link。登出走 account chip →
 * /settings/sessions 內的 device row revoke，避免 destructive action 跟主要
 * nav 同框，降低誤點機率。
 *
 * V2-P7 PR-O 2026-04-26：sidebar 拿掉「管理」 nav item。原 admin 共編管理
 * 功能搬進每個 trip 的 OverflowMenu →「共編設定」 sheet（CollabSheet），
 * 一般 user 也可管自己 owner 行程，不再侷限 admin。
 */
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import Icon from '../shared/Icon';
import ThemeToggle from '../shared/ThemeToggle';

interface NavItemConfig {
  key: 'chat' | 'trips' | 'map' | 'explore' | 'account' | 'login';
  label: string;
  href: string;
  icon: string;
  /** Paths that keep this nav highlighted (exact match OR followed by `/`). */
  matchPrefixes: readonly string[];
  /** When true, match only the exact prefix — no nested sub-routes. */
  exactOnly?: boolean;
  /** When true, item only shows for logged-in users (Section 2 account-hub-page) */
  authOnly?: boolean;
  /** When true, item only shows for logged-out users */
  guestOnly?: boolean;
}

// 2026-04-29:User 拍板「桌機版 sidebar 不用帳號選項 避免重複」 — desktop 版
// 移除「帳號」 nav item。User 透過 sidebar 底部 user chip(.tp-account-card)
// 進 /account。Mobile GlobalBottomNav 維持 5 tab 含「帳號」(底部空間有限,
// 沒底部 user chip)。
const NAV_ITEMS: ReadonlyArray<NavItemConfig> = [
  { key: 'chat',    label: '聊天', href: '/chat',    icon: 'chat',   matchPrefixes: ['/chat'] },
  { key: 'trips',   label: '行程', href: '/trips',   icon: 'home',   matchPrefixes: ['/trips', '/trip'] },
  { key: 'map',     label: '地圖', href: '/map',     icon: 'map',    matchPrefixes: ['/map'], exactOnly: true },
  { key: 'explore', label: '探索', href: '/explore', icon: 'search', matchPrefixes: ['/explore'] },
  { key: 'login',   label: '登入', href: '/login',   icon: 'user',   matchPrefixes: ['/login'], guestOnly: true },
];

function isItemActive(pathname: string, item: NavItemConfig): boolean {
  for (const prefix of item.matchPrefixes) {
    if (pathname === prefix) return true;
    if (!item.exactOnly && pathname.startsWith(prefix + '/')) return true;
  }
  return false;
}

const SCOPED_STYLES = `
.tp-sidebar {
  /* Section 4.1 (terracotta-ui-parity-polish): mockup dark sidebar
   * (line 5126) — color-foreground 深棕底 on cream page。 */
  background: var(--color-foreground);
  border-right: 1px solid var(--color-foreground);
  padding: 20px 14px 16px;
  display: flex; flex-direction: column;
  gap: 4px;
  height: 100%;
  overflow-y: auto;
}
.tp-sidebar-brand {
  padding: 6px 12px 20px;
  display: flex; align-items: center; gap: 8px;
  font-size: 18px; font-weight: 800; letter-spacing: -0.02em;
  /* Dark sidebar 上文字反白 */
  color: var(--color-background);
}
.tp-sidebar-brand .accent-dot { color: var(--color-accent); }

.tp-sidebar-nav {
  display: flex; flex-direction: column; gap: 2px;
}
.tp-nav-item {
  /* Section 4.1 (terracotta-ui-parity-polish): dark sidebar 上 inactive
   * 用半透明 white 替代 muted (muted 在深棕底對比不夠)。font-weight 600
   * 對齊 mockup line 5129。 */
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border-radius: 10px;
  color: rgba(255, 251, 245, 0.6);
  font-size: 14px; font-weight: 600;
  cursor: pointer; text-decoration: none;
  transition: background 150ms var(--transition-timing-function-apple),
              color 150ms var(--transition-timing-function-apple);
  min-height: var(--spacing-tap-min);
}
.tp-nav-item:hover {
  background: rgba(255, 251, 245, 0.08);
  color: var(--color-background);
}
.tp-nav-item.is-active {
  /* mockup HIGH active 為 accent 實心 (line 5128) */
  background: var(--color-accent);
  color: var(--color-accent-foreground);
}
.tp-nav-item .svg-icon { width: 20px; height: 20px; flex-shrink: 0; }

.tp-sidebar-cta {
  margin-top: auto;
  padding-top: 16px;
  /* Dark sidebar 上 border 用半透明 white */
  border-top: 1px solid rgba(255, 251, 245, 0.12);
  display: flex; flex-direction: column; gap: 8px;
}
.tp-new-trip-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px; border-radius: var(--radius-full);
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  border: none;
  font: inherit; font-size: 14px; font-weight: 600;
  cursor: pointer; min-height: var(--spacing-tap-min);
  transition: filter 150ms var(--transition-timing-function-apple);
}
.tp-new-trip-btn:hover { filter: brightness(var(--hover-brightness)); }
.tp-new-trip-btn:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

.tp-user-chip {
  display: flex; align-items: center; gap: 10px;
  padding: 8px; border-radius: var(--radius-md);
  color: var(--color-muted); font-size: 13px;
}
.tp-user-chip .tp-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--color-accent-bg);
  color: var(--color-accent);
  display: grid; place-items: center;
  font-size: 12px; font-weight: 700; flex-shrink: 0;
}

.tp-account-card {
  padding: 12px;
  border-radius: var(--radius-lg);
  /* Dark sidebar 上 account card 用半透明 white over dark 取代 accent-subtle */
  background: rgba(255, 251, 245, 0.08);
  display: flex; align-items: center; gap: 10px;
  text-decoration: none;
  color: var(--color-background);
  transition: filter 120ms;
  min-height: var(--spacing-tap-min);
}
.tp-account-card:hover { filter: brightness(var(--hover-brightness)); }
.tp-account-card:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.tp-account-card .tp-avatar-md {
  width: 40px; height: 40px; border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  display: grid; place-items: center;
  font-size: 14px; font-weight: 800; flex-shrink: 0;
}
.tp-account-card .tp-account-body {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 2px;
}
.tp-account-card .tp-account-name {
  font-size: 13px; font-weight: 700;
  /* Dark sidebar：name 用 reverse foreground (cream on dark) */
  color: var(--color-background);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tp-account-card .tp-account-email {
  font-size: var(--font-size-caption2);
  /* Dark sidebar：email 用半透明 cream */
  color: rgba(255, 251, 245, 0.6);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
`;

export interface SidebarUser {
  name: string;
  email: string;
}


export interface DesktopSidebarProps {
  /** Current authenticated user — null = 未登入 */
  user?: SidebarUser | null;
  /** @deprecated PR-O：管理 nav 已廢，admin 改走 trip-level CollabSheet。
   * Prop 保留以避免 ConnectedSidebar 端 break，但已無作用。 */
  isAdmin?: boolean;
  /** Optional brand slot override — 預設 "Tripline." */
  brand?: ReactNode;
}

export default function DesktopSidebar({ user, brand }: DesktopSidebarProps) {
  const { pathname } = useLocation();
  const initial = user?.name?.charAt(0)?.toUpperCase() ?? '?';

  // Section 2 (terracotta-account-hub-page): logged-in 顯示「帳號」隱藏「登入」；
  // logged-out 反之。
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.authOnly) return !!user;
    if (item.guestOnly) return !user;
    return true;
  });

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div className="tp-sidebar" data-testid="desktop-sidebar">
        <div className="tp-sidebar-brand">
          {brand ?? (<>Tripline<span className="accent-dot">.</span></>)}
        </div>

        <nav className="tp-sidebar-nav" aria-label="主要功能">
          {visibleNavItems.map((item) => {
            const active = isItemActive(pathname, item);
            return (
              <Link
                key={item.key}
                to={item.href}
                className={clsx('tp-nav-item', active && 'is-active')}
                aria-current={active ? 'page' : undefined}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="tp-sidebar-cta">
          <ThemeToggle testId="sidebar-theme" />

          {user ? (
            <Link
              to="/account"
              className="tp-account-card"
              data-testid="sidebar-account-card"
              aria-label={`帳號設定：${user.name}`}
            >
              <div className="tp-avatar-md" aria-hidden="true">{initial}</div>
              <div className="tp-account-body">
                {/* Section 4.1 (terracotta-ui-parity-polish): mockup line 5132
                 * 規定 name.length > 10 → slice(0,10)+'…' JS-level truncation。
                 * Sidebar nav 點 Account card 改 navigate /account（取代既有
                 * /settings/sessions直連）— Section 2 account-hub-page 對齊。 */}
                <div className="tp-account-name">
                  {user.name.length > 10 ? `${user.name.slice(0, 10)}…` : user.name}
                </div>
                <div className="tp-account-email">{user.email}</div>
              </div>
            </Link>
          ) : (
            <div className="tp-user-chip" data-testid="sidebar-user-chip">
              <div className="tp-avatar" aria-hidden="true">?</div>
              <span>未登入</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
