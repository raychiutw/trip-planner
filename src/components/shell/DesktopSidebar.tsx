/**
 * DesktopSidebar — app-level sidebar.
 *
 * Desktop primary nav matching terracotta-preview-v2 (v2.21.0):
 *   聊天 / 行程 / 地圖 / 我的收藏
 * 「探索」自 v2.21.0 起降為 /saved 頁右上 secondary action（ghost），不再是 primary nav。
 * Anonymous users also see 登入; authenticated account access lives in the
 * bottom account chip to avoid duplicating the Account entry on desktop.
 *
 * Settings (connected-apps, developer/apps, sessions) reach via direct URL
 * or future account-chip menu — they're admin/maintenance routes, not core
 * "produce/consume trips" actions.
 *
 * 「地圖」nav owns /map and in-trip map routes. Other trip-scoped routes stay
 * on 「行程」.
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
  key: 'chat' | 'trips' | 'map' | 'saved' | 'login';
  label: string;
  href: string;
  icon: string;
  /** Paths that keep this nav highlighted (exact match OR followed by `/`). */
  matchPrefixes: readonly string[];
  /** When true, match only the exact prefix — no nested sub-routes. */
  exactOnly?: boolean;
  /** Regex route families that should also activate this item. */
  additionalActivePatterns?: readonly RegExp[];
  /** When true, item only shows for logged-in users (Section 2 account-hub-page) */
  authOnly?: boolean;
  /** When true, item only shows for logged-out users */
  guestOnly?: boolean;
}

// 2026-04-29:User 拍板「桌機版 sidebar 不用帳號選項 避免重複」 — desktop 版
// 移除「帳號」 nav item。User 透過 sidebar 底部 user chip(.tp-account-card)
// 進 /account。Mobile GlobalBottomNav 維持 5 tab 含「帳號」(底部空間有限,
// 沒底部 user chip)。
const MAP_ACTIVE_PATTERNS = [/^\/trip\/[^/]+\/map\/?$/, /^\/trip\/[^/]+\/stop\/[^/]+\/map\/?$/];
const TRIP_ACTIVE_PATTERNS = [/^\/trip\/[^/]+(?:\/?$|\/(?!(?:map|stop\/[^/]+\/map)\/?$).*)/];

// v2.21.0 IA reshuffle: 4th slot 「探索」→「我的收藏」(saved POIs universal pool primary nav).
// /explore 仍 reachable via /saved TitleBar action; 走到 /explore 時 sidebar 仍 highlight
// 「我的收藏」(MF11 additionalActivePatterns).
const SAVED_ACTIVE_PATTERNS = [/^\/explore(?:\/|$)/, /^\/saved-pois\//];

const NAV_ITEMS: ReadonlyArray<NavItemConfig> = [
  { key: 'chat',    label: '聊天',     href: '/chat',    icon: 'sidebar-chat',    matchPrefixes: ['/chat'] },
  { key: 'trips',   label: '行程',     href: '/trips',   icon: 'sidebar-trip',    matchPrefixes: ['/trips'], additionalActivePatterns: TRIP_ACTIVE_PATTERNS },
  { key: 'map',     label: '地圖',     href: '/map',     icon: 'sidebar-map',     matchPrefixes: ['/map'], exactOnly: true, additionalActivePatterns: MAP_ACTIVE_PATTERNS },
  { key: 'saved',   label: '我的收藏', href: '/saved',   icon: 'heart',           matchPrefixes: ['/saved'], additionalActivePatterns: SAVED_ACTIVE_PATTERNS },
  { key: 'login',   label: '登入',     href: '/login',   icon: 'sidebar-user',    matchPrefixes: ['/login'], guestOnly: true },
];

function isItemActive(pathname: string, item: NavItemConfig): boolean {
  if (item.additionalActivePatterns) {
    for (const re of item.additionalActivePatterns) {
      if (re.test(pathname)) return true;
    }
  }
  for (const prefix of item.matchPrefixes) {
    if (pathname === prefix) return true;
    if (!item.exactOnly && pathname.startsWith(prefix + '/')) return true;
  }
  return false;
}

const SCOPED_STYLES = `
.tp-sidebar {
  /* Section 4.1 (terracotta-ui-parity-polish): mockup dark sidebar
   * (line 5126) — fixed deep-cocoa surface in both light and dark mode. */
  background: #2A1F18;
  border-right: 1px solid #2A1F18;
  padding: 20px 14px;
  display: flex; flex-direction: column;
  gap: 2px;
  height: 100%;
  overflow-y: auto;
}
body.dark .tp-sidebar {
  background: #0F0B08;
  border-right-color: #0F0B08;
}
.tp-sidebar-brand {
  padding: 0 8px;
  margin-bottom: 18px;
  display: flex; align-items: center; gap: 8px;
  font-size: 20px; font-weight: 700; letter-spacing: -0.01em;
  /* Dark sidebar 上文字反白 */
  color: #FFFBF5;
}
.tp-sidebar-brand .accent-dot { color: var(--color-accent); }

.tp-sidebar-nav {
  display: flex; flex-direction: column; gap: 2px;
}
.tp-nav-item {
  /* Section 4.1 (terracotta-ui-parity-polish): dark sidebar 上 inactive
   * 用半透明 white 替代 muted (muted 在深棕底對比不夠)。font-weight 600
   * 對齊 mockup line 5129。 */
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: var(--radius-md);
  color: rgba(255, 251, 245, 0.78);
  font-size: 14px; font-weight: 600;
  cursor: pointer; text-decoration: none;
  transition: background 150ms var(--transition-timing-function-apple),
              color 150ms var(--transition-timing-function-apple);
  min-height: 40px;
}
.tp-nav-item:hover {
  background: rgba(255, 251, 245, 0.06);
  color: #FFFBF5;
}
.tp-nav-item.is-active {
  /* mockup HIGH active 為 accent 實心 (line 5128) */
  background: var(--color-accent);
  color: var(--color-accent-foreground);
}
.tp-nav-item .svg-icon { width: 16px; height: 16px; flex-shrink: 0; }

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
  color: rgba(255, 251, 245, 0.78); font-size: 13px;
}
.tp-user-chip .tp-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  display: grid; place-items: center;
  font-size: 13px; font-weight: 700; flex-shrink: 0;
}
.tp-user-chip-loading {
  min-height: 52px;
}
.tp-user-chip-loading .tp-avatar {
  background: rgba(255, 251, 245, 0.12);
  color: transparent;
}
.tp-user-skeleton-stack {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 6px;
}
.tp-user-skeleton-line {
  display: block;
  height: 8px;
  border-radius: var(--radius-full);
  background: rgba(255, 251, 245, 0.14);
}
.tp-user-skeleton-line.is-primary { width: 76px; }
.tp-user-skeleton-line.is-secondary {
  width: 116px;
  background: rgba(255, 251, 245, 0.09);
}

.tp-account-card {
  padding: 10px;
  border-radius: var(--radius-md);
  /* Dark sidebar 上 account card 用半透明 white over dark 取代 accent-subtle */
  background: transparent;
  display: flex; align-items: center; gap: 10px;
  text-decoration: none;
  color: rgba(255, 251, 245, 0.78);
  transition: background 150ms var(--transition-timing-function-apple);
  min-height: 52px;
}
.tp-account-card:hover { background: rgba(255, 251, 245, 0.06); }
.tp-account-card:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.tp-account-card .tp-avatar-md {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  display: grid; place-items: center;
  font-size: 13px; font-weight: 700; flex-shrink: 0;
}
.tp-account-card .tp-account-body {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 2px;
}
.tp-account-card .tp-account-name {
  font-size: 13px; font-weight: 600;
  /* Dark sidebar：name 用 reverse foreground (cream on dark) */
  color: #FFFBF5;
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
  /** undefined = auth loading, null = confirmed unauthenticated */
  user?: SidebarUser | null | undefined;
  /** Optional brand slot override — 預設 "Tripline." */
  brand?: ReactNode;
}

export default function DesktopSidebar({ user, brand }: DesktopSidebarProps) {
  const { pathname } = useLocation();
  const initial = user?.name?.charAt(0)?.toUpperCase() ?? '?';
  const authResolved = user !== undefined;
  const isAuthed = !!user;

  // Section 2 (terracotta-account-hub-page): loading 不先猜 guest/auth，
  // 等 userinfo resolve 後才顯示「登入」或 account chip，避免 auth flicker。
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.authOnly) return isAuthed;
    if (item.guestOnly) return authResolved && !isAuthed;
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

          {user === undefined ? (
            <div
              className="tp-user-chip tp-user-chip-loading"
              data-testid="sidebar-user-loading"
              role="status"
              aria-label="正在確認登入狀態"
            >
              <div className="tp-avatar" aria-hidden="true" />
              <div className="tp-user-skeleton-stack" aria-hidden="true">
                <span className="tp-user-skeleton-line is-primary" />
                <span className="tp-user-skeleton-line is-secondary" />
              </div>
            </div>
          ) : user ? (
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
