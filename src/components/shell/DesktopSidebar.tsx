/**
 * DesktopSidebar — B-P2 §3
 *
 * 5 nav items（聊天 / 行程 / 地圖 / 探索 / 登入）+ user chip + New Trip CTA。
 * 視覺對應：docs/design-sessions/mockup-trip-v2.html sidebar 區塊（V2 Terracotta，filled dark active pill）。
 *
 * Active state route mapping：
 *   /chat 或 /chat/* → 聊天
 *   /manage 或 /manage/* 或 /trip/* → 行程（含 per-trip 所有 sub-route，例如 /trip/:id/map）
 *   /map → 地圖（cross-trip global，per-trip 的 /trip/:id/map 不算）
 *   /explore 或 /explore/* → 探索
 *   /login 或 /login/* → 登入
 *
 * 未登入：底部顯示「未登入」chip
 * 已登入：底部顯示 account card（avatar + name + email）+ 隱藏「未登入」chip
 */
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import Icon from '../shared/Icon';

interface NavItemConfig {
  key: 'chat' | 'trips' | 'map' | 'explore' | 'login';
  label: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: ReadonlyArray<NavItemConfig> = [
  { key: 'chat',    label: '聊天', href: '/chat',    icon: 'chat' },
  { key: 'trips',   label: '行程', href: '/manage',  icon: 'home' },
  { key: 'map',     label: '地圖', href: '/map',     icon: 'map' },
  { key: 'explore', label: '探索', href: '/explore', icon: 'search' },
  { key: 'login',   label: '登入', href: '/login',   icon: 'user' },
];

function isItemActive(pathname: string, key: NavItemConfig['key']): boolean {
  switch (key) {
    case 'chat':
      return pathname === '/chat' || pathname.startsWith('/chat/');
    case 'trips':
      return (
        pathname === '/manage' ||
        pathname.startsWith('/manage/') ||
        pathname.startsWith('/trip/')
      );
    case 'map':
      return pathname === '/map';
    case 'explore':
      return pathname === '/explore' || pathname.startsWith('/explore/');
    case 'login':
      return pathname === '/login' || pathname.startsWith('/login/');
  }
}

const SCOPED_STYLES = `
.tp-sidebar {
  background: var(--color-background);
  border-right: 1px solid var(--color-border);
  padding: 20px 12px 16px;
  display: flex; flex-direction: column;
  gap: 4px;
  height: 100%;
  overflow-y: auto;
}
.tp-sidebar-brand {
  padding: 6px 12px 20px;
  display: flex; align-items: center; gap: 8px;
  font-size: 18px; font-weight: 800; letter-spacing: -0.02em;
  color: var(--color-foreground);
}
.tp-sidebar-brand .accent-dot { color: var(--color-accent); }

.tp-sidebar-nav {
  display: flex; flex-direction: column; gap: 2px;
}
.tp-nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border-radius: 10px;
  color: var(--color-muted);
  font-size: 14px; font-weight: 500;
  cursor: pointer; text-decoration: none;
  transition: background 150ms var(--transition-timing-function-apple),
              color 150ms var(--transition-timing-function-apple);
  min-height: var(--spacing-tap-min);
}
.tp-nav-item:hover { background: var(--color-hover); color: var(--color-foreground); }
.tp-nav-item.is-active {
  background: var(--color-foreground);
  color: var(--color-background);
  font-weight: 600;
}
.tp-nav-item .svg-icon { width: 20px; height: 20px; flex-shrink: 0; }

.tp-sidebar-cta {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
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
.tp-new-trip-btn:hover { filter: brightness(0.92); }
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
  background: var(--color-accent-subtle);
  display: flex; align-items: center; gap: 10px;
}
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
  color: var(--color-foreground);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tp-account-card .tp-account-email {
  font-size: var(--font-size-caption2);
  color: var(--color-accent);
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
  /** New Trip CTA click handler — Phase 2 由 parent 觸發 toast；Phase 3 換 modal */
  onNewTrip?: () => void;
  /** Optional brand slot override — 預設 "Tripline." */
  brand?: ReactNode;
}

export default function DesktopSidebar({ user, onNewTrip, brand }: DesktopSidebarProps) {
  const { pathname } = useLocation();
  const initial = user?.name?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div className="tp-sidebar" data-testid="desktop-sidebar">
        <div className="tp-sidebar-brand">
          {brand ?? (<>Tripline<span className="accent-dot">.</span></>)}
        </div>

        <nav className="tp-sidebar-nav" aria-label="主要功能">
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(pathname, item.key);
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
          <button
            type="button"
            className="tp-new-trip-btn"
            data-testid="sidebar-new-trip-btn"
            onClick={onNewTrip}
          >
            <Icon name="plus" />
            <span>新增行程</span>
          </button>

          {user ? (
            <div className="tp-account-card" data-testid="sidebar-account-card">
              <div className="tp-avatar-md" aria-hidden="true">{initial}</div>
              <div className="tp-account-body">
                <div className="tp-account-name">{user.name}</div>
                <div className="tp-account-email">{user.email}</div>
              </div>
            </div>
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
