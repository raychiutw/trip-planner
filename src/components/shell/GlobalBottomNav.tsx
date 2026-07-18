/**
 * GlobalBottomNav — 5-tab mobile bottom nav (mockup section 02 align).
 *
 * 5-tab global IA(聊天 / 行程 / 地圖 / 收藏 / 帳號 | 登入),所有 page 共用,
 * 包含 trip-scoped /trip/:id。
 *
 * v2.21.0 IA reshuffle: 4th slot 「探索」→「收藏」 (heart icon, asymmetric label vs
 * DesktopSidebar「我的收藏」 — bottom-nav 緊密用 2-char + heart icon 補語意)。
 * /explore 仍是 valid route，via /favorites TitleBar action 進入；走到 /explore 時
 * bottom nav 仍 highlight「收藏」(SAVED_ACTIVE_PATTERNS).
 *
 * Logged-in users「帳號」 entry → /account。
 */
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import Icon from '../shared/Icon';

interface NavItem {
  key: 'chat' | 'trips' | 'map' | 'favorites' | 'login' | 'account';
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
// Canonical patterns mirror DesktopSidebar:55-56 so mobile + desktop light the
// same tab. MAP owns /trip/:id/map AND /trip/:id/stop/:id/map; 行程 owns /trip/:id
// and every non-map sub-route (edit/notes/health/...).
const MAP_ACTIVE_PATTERNS = [/^\/trip\/[^/]+\/map\/?$/, /^\/trip\/[^/]+\/stop\/[^/]+\/map\/?$/];
// 「行程」 tab — /trips + /trip/:id + 子路由 active，但 /trip/:id/map 與 stop/:id/map 算地圖
const TRIPS_ACTIVE_PATTERNS = [/^\/trip\/[^/]+(?:\/?$|\/(?!(?:map|stop\/[^/]+\/map)\/?$).*)/];
// poi-favorites-rename:「收藏」 tab — /favorites primary + /favorites/* 子路由 + /explore (secondary entry)
const FAVORITES_ACTIVE_PATTERNS = [/^\/explore(?:\/|$)/, /^\/favorites\//];

// rev2 owner 2026-07-18「手機也做」：底部 nav 由 5-tab 降 **4-tab**（聊天/行程/地圖/收藏）。
// 帳號/登入移出 tab slot → 手機統一 header 右上帳號圓圈（<AccountCircle/> → /account 或
// /login）、桌機為 sidebar 左下 chip。對齊 mockup「4 格：帳號移到 titlebar 右上」。
const NAV_ITEMS_ANON: ReadonlyArray<NavItem> = [
  { key: 'chat',      label: '聊天', href: '/chat',      icon: 'nav-chat',  matchPrefixes: ['/chat'] },
  { key: 'trips',     label: '行程', href: '/trips',     icon: 'nav-trips',  matchPrefixes: ['/trips'], additionalActivePatterns: TRIPS_ACTIVE_PATTERNS },
  { key: 'map',       label: '地圖', href: '/map',       icon: 'nav-map',   matchPrefixes: ['/map'], exactOnly: true, additionalActivePatterns: MAP_ACTIVE_PATTERNS },
  { key: 'favorites', label: '收藏', href: '/favorites', icon: 'nav-fav', matchPrefixes: ['/favorites'], additionalActivePatterns: FAVORITES_ACTIVE_PATTERNS },
];

const NAV_ITEMS_AUTH: ReadonlyArray<NavItem> = [
  { key: 'chat',      label: '聊天', href: '/chat',      icon: 'nav-chat',  matchPrefixes: ['/chat'] },
  { key: 'trips',     label: '行程', href: '/trips',     icon: 'nav-trips',  matchPrefixes: ['/trips'], additionalActivePatterns: TRIPS_ACTIVE_PATTERNS },
  { key: 'map',       label: '地圖', href: '/map',       icon: 'nav-map',   matchPrefixes: ['/map'], exactOnly: true, additionalActivePatterns: MAP_ACTIVE_PATTERNS },
  { key: 'favorites', label: '收藏', href: '/favorites', icon: 'nav-fav', matchPrefixes: ['/favorites'], additionalActivePatterns: FAVORITES_ACTIVE_PATTERNS },
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
/* rev2 owner 2026-07-18「手機也做」：底部**浮動玻璃膠囊**（iOS 26 Apple Music
 * .ph-tabs 形制）— 桌機+手機共用同一玻璃膠囊：圓角 pill + glass blur + rim +
 * box-shadow。不滿版 → 左右露出內容、玻璃才有東西透。定位（fixed 置中；手機置中
 * 浮動、桌機置中中欄+右欄）由 AppShell .app-shell-bottom-nav 負責。 */
.tp-global-bottom-nav {
  display: flex;
  gap: 2px;
  padding: 6px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-secondary) 82%, transparent);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--color-border);
  box-shadow: 0 10px 30px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.14);
}
.tp-global-bottom-nav-btn {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 2px;
  width: 62px; min-height: 46px;
  border-radius: var(--radius-full);
  background: transparent;
  border: none;
  text-decoration: none;
  cursor: pointer;
  color: var(--color-muted);
  font: inherit;
  transition: background 140ms, color 140ms;
}
.tp-global-bottom-nav-btn .svg-icon {
  width: 22px; height: 22px;
}
.tp-global-bottom-nav-btn span {
  /* mockup .ph-tab：10px/700（膠囊窄，字級降至 10px 對齊 iOS 26 tab 形制）。
   * 10px = var(--font-size-eyebrow)（token gate 要求，見 pr2-tokens 測）。 */
  font-size: var(--font-size-eyebrow);
  line-height: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.tp-global-bottom-nav-btn:hover { color: var(--color-foreground); background: var(--color-hover); }
.tp-global-bottom-nav-btn.is-active {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
}
.tp-global-bottom-nav-btn.is-active span { font-weight: 700; }

/* 桌機：膠囊 tabs 改 row layout（icon+label 橫排、較寬、字級回 caption2）。 */
@media (min-width: 1024px) {
  .tp-global-bottom-nav-btn {
    flex-direction: row;
    gap: 7px;
    width: auto;
    padding: 8px 16px;
    min-height: 40px;
  }
  .tp-global-bottom-nav-btn span {
    font-size: var(--font-size-caption2);
    line-height: 14px;
  }
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
