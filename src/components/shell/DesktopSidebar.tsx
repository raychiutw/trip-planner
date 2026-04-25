/**
 * DesktopSidebar — 5-nav app-level sidebar (chat / trips / map / explore / login).
 *
 * 「行程」nav matches /manage AND /trip/* so per-trip sub-routes (e.g. /trip/:id/map)
 * stay highlighted on the trips nav, not the cross-trip /map global view.
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
  /** Paths that keep this nav highlighted (exact match OR followed by `/`). */
  matchPrefixes: readonly string[];
  /** When true, match only the exact prefix — no nested sub-routes. */
  exactOnly?: boolean;
}

const NAV_ITEMS: ReadonlyArray<NavItemConfig> = [
  { key: 'chat',    label: '聊天', href: '/chat',    icon: 'chat',   matchPrefixes: ['/chat'] },
  { key: 'trips',   label: '行程', href: '/manage',  icon: 'home',   matchPrefixes: ['/manage', '/trip'] },
  { key: 'map',     label: '地圖', href: '/map',     icon: 'map',    matchPrefixes: ['/map'], exactOnly: true },
  { key: 'explore', label: '探索', href: '/explore', icon: 'search', matchPrefixes: ['/explore'] },
  { key: 'login',   label: '登入', href: '/login',   icon: 'user',   matchPrefixes: ['/login'] },
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
.tp-account-logout {
  display: block;
  margin-top: 6px;
  padding: 8px;
  font: inherit;
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
  text-align: center;
  text-decoration: underline;
  text-underline-offset: 2px;
  min-height: var(--spacing-tap-min);
}
.tp-account-logout:hover { color: var(--color-foreground); }
.tp-account-logout:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
`;

export interface SidebarUser {
  name: string;
  email: string;
}

export interface DesktopSidebarProps {
  /** Current authenticated user — null = 未登入 */
  user?: SidebarUser | null;
  /** New Trip CTA click handler — parent decides how to respond (toast vs modal). */
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
            <>
              <div className="tp-account-card" data-testid="sidebar-account-card">
                <div className="tp-avatar-md" aria-hidden="true">{initial}</div>
                <div className="tp-account-body">
                  <div className="tp-account-name">{user.name}</div>
                  <div className="tp-account-email">{user.email}</div>
                </div>
              </div>
              <a
                className="tp-account-logout"
                href="/api/oauth/logout"
                data-testid="sidebar-logout"
              >
                登出
              </a>
            </>
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
