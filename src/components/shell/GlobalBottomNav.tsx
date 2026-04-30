/**
 * GlobalBottomNav — 5-tab mobile bottom nav (mockup section 02 align).
 *
 * 5-tab global IA(聊天 / 行程 / 地圖 / 探索 / 帳號 | 登入),所有 page 共用,
 * 包含 trip-scoped /trip/:id。
 *
 * Logged-in users「帳號」 entry → /account。
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
  /** Section 5 (E4)：額外的 path 正則 — 對應 /trip/:id/map 也算「地圖」active */
  additionalActivePatterns?: readonly RegExp[];
}

// Section 5 (E4)：「地圖」 tab — `/map` exact + `/trip/:id/map` 也視為 active
// （in-trip map view），但 `/manage/map-xxx` 不誤觸（純文字 prefix 不夠精確）
const MAP_ACTIVE_PATTERNS = [/^\/trip\/[^/]+\/map$/];
// 「行程」 tab — /trips + /trip/:id 都 active，但 /trip/:id/map 視為地圖不算行程
const TRIPS_ACTIVE_PATTERNS = [/^\/trip\/[^/]+$/];

const NAV_ITEMS_ANON: ReadonlyArray<NavItem> = [
  { key: 'chat',    label: '聊天', href: '/chat',    icon: 'chat',   matchPrefixes: ['/chat'] },
  { key: 'trips',   label: '行程', href: '/trips',   icon: 'home',   matchPrefixes: ['/trips'], additionalActivePatterns: TRIPS_ACTIVE_PATTERNS },
  { key: 'map',     label: '地圖', href: '/map',     icon: 'map',    matchPrefixes: ['/map'], exactOnly: true, additionalActivePatterns: MAP_ACTIVE_PATTERNS },
  { key: 'explore', label: '探索', href: '/explore', icon: 'search', matchPrefixes: ['/explore'] },
  { key: 'login',   label: '登入', href: '/login',   icon: 'user',   matchPrefixes: ['/login'] },
];

const NAV_ITEMS_AUTH: ReadonlyArray<NavItem> = [
  { key: 'chat',    label: '聊天', href: '/chat',    icon: 'chat',   matchPrefixes: ['/chat'] },
  { key: 'trips',   label: '行程', href: '/trips',   icon: 'home',   matchPrefixes: ['/trips'], additionalActivePatterns: TRIPS_ACTIVE_PATTERNS },
  { key: 'map',     label: '地圖', href: '/map',     icon: 'map',    matchPrefixes: ['/map'], exactOnly: true, additionalActivePatterns: MAP_ACTIVE_PATTERNS },
  { key: 'explore', label: '探索', href: '/explore', icon: 'search', matchPrefixes: ['/explore'] },
  // Section 2 (terracotta-account-hub-page) + E4：帳號 entry 改 /account hub
  { key: 'account', label: '帳號', href: '/account', icon: 'user',   matchPrefixes: ['/account', '/settings'] },
];

function isItemActive(pathname: string, item: NavItem): boolean {
  // additionalActivePatterns 優先（更精確的 regex match）
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
  /* mockup-parity-qa-fixes: mockup section 02:5227 規範 11/14/700
   * （曾為 11/normal/500，2026-04-29 對齊 mockup 升 weight + 鎖 line-height） */
  font-size: var(--font-size-caption2);
  line-height: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.tp-global-bottom-nav-btn:hover { color: var(--color-foreground); }
.tp-global-bottom-nav-btn.is-active {
  color: var(--color-accent);
  /* Section 5 (E4)：mockup section 02 active state — accent-subtle 底 + 2px
   * top indicator */
  background: var(--color-accent-subtle);
  position: relative;
}
.tp-global-bottom-nav-btn.is-active::before {
  content: '';
  position: absolute;
  top: 0; left: 50%;
  transform: translateX(-50%);
  width: 32px; height: 2px;
  border-radius: 0 0 2px 2px;
  background: var(--color-accent);
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
