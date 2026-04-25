/**
 * GlobalBottomNav — 5-tab mobile bottom nav for non-trip pages.
 *
 * Lifts mockup-trip-v2.html `.bottom-nav` pattern verbatim. Mirrors
 * DesktopSidebar's 5-item primary nav (聊天 / 行程 / 地圖 / 探索 / 登入)
 * so mobile and desktop share the same IA.
 *
 * Logged-in users have 登入 swapped for 帳號 (account chip with logout).
 *
 * Trip-scoped pages (/trip/:id) keep using BottomNavBar with 4-tab
 * trip-context IA (行程/地圖/訊息/更多). This component is for /trips,
 * /explore, /manage, /chat, /map and similar global routes.
 */
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import Icon from '../shared/Icon';

interface NavItem {
  key: 'chat' | 'trips' | 'map' | 'explore' | 'login' | 'account';
  label: string;
  href: string;
  icon: string;
  matchPrefixes: readonly string[];
  exactOnly?: boolean;
}

const NAV_ITEMS_ANON: ReadonlyArray<NavItem> = [
  { key: 'chat',    label: '聊天', href: '/chat',    icon: 'chat',   matchPrefixes: ['/chat'] },
  { key: 'trips',   label: '行程', href: '/trips',   icon: 'home',   matchPrefixes: ['/trips', '/trip'] },
  { key: 'map',     label: '地圖', href: '/map',     icon: 'map',    matchPrefixes: ['/map'], exactOnly: true },
  { key: 'explore', label: '探索', href: '/explore', icon: 'search', matchPrefixes: ['/explore'] },
  { key: 'login',   label: '登入', href: '/login',   icon: 'user',   matchPrefixes: ['/login'] },
];

const NAV_ITEMS_AUTH: ReadonlyArray<NavItem> = [
  { key: 'chat',    label: '聊天', href: '/chat',    icon: 'chat',   matchPrefixes: ['/chat'] },
  { key: 'trips',   label: '行程', href: '/trips',   icon: 'home',   matchPrefixes: ['/trips', '/trip'] },
  { key: 'map',     label: '地圖', href: '/map',     icon: 'map',    matchPrefixes: ['/map'], exactOnly: true },
  { key: 'explore', label: '探索', href: '/explore', icon: 'search', matchPrefixes: ['/explore'] },
  { key: 'account', label: '帳號', href: '/settings/sessions', icon: 'user', matchPrefixes: ['/settings'] },
];

function isItemActive(pathname: string, item: NavItem): boolean {
  for (const prefix of item.matchPrefixes) {
    if (pathname === prefix) return true;
    if (!item.exactOnly && pathname.startsWith(prefix + '/')) return true;
  }
  return false;
}

const SCOPED_STYLES = `
.tp-global-bottom-nav {
  position: sticky;
  inset-block-end: 0;
  left: 0; right: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  height: var(--nav-height-mobile, 64px);
  background: color-mix(in srgb, var(--color-background) 97%, transparent);
  backdrop-filter: blur(14px);
  border-top: 1px solid var(--color-border);
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 10;
}
.tp-global-bottom-nav-btn {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 4px;
  background: transparent;
  border: none;
  text-decoration: none;
  cursor: pointer;
  color: var(--color-muted);
  font: inherit;
  min-height: var(--spacing-tap-min, 44px);
  transition: color 150ms;
}
.tp-global-bottom-nav-btn .svg-icon {
  width: 22px; height: 22px;
}
.tp-global-bottom-nav-btn span {
  font-size: var(--font-size-caption2);
  font-weight: 500;
  letter-spacing: 0.02em;
}
.tp-global-bottom-nav-btn:hover { color: var(--color-foreground); }
.tp-global-bottom-nav-btn.is-active {
  color: var(--color-accent);
}
.tp-global-bottom-nav-btn.is-active span {
  font-weight: 700;
}
`;

export interface GlobalBottomNavProps {
  /** True when user is signed in. Swaps 登入 → 帳號 in last slot. */
  authed: boolean;
}

export default function GlobalBottomNav({ authed }: GlobalBottomNavProps) {
  const { pathname } = useLocation();
  const items = authed ? NAV_ITEMS_AUTH : NAV_ITEMS_ANON;

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div className="tp-global-bottom-nav" data-testid="global-bottom-nav">
        {items.map((item) => {
          const active = isItemActive(pathname, item);
          return (
            <Link
              key={item.key}
              to={item.href}
              className={clsx('tp-global-bottom-nav-btn', active && 'is-active')}
              aria-current={active ? 'page' : undefined}
              data-testid={`global-bottom-nav-${item.key}`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
