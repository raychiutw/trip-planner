/**
 * navItems — rev2 primary IA（聊天 / 行程 / 地圖 / 收藏）單一來源。
 *
 * GlobalBottomNav（手機底部浮動玻璃膠囊）+ DesktopSidebar（桌機 macOS sidebar 頂部，
 * §10.1 owner 2026-07-19）共用同一份 items + active 判定，避免兩份路徑 pattern 漂移。
 * 帳號 / 登入已移出 tab slot（手機 header 右上圓圈 / 桌機 sidebar 左下 chip）。
 *
 * 純資料 + 純函式模組（無 React / JSX）→ 可被 mock GlobalBottomNav 的測試安全共用。
 */

export interface NavItem {
  key: 'chat' | 'trips' | 'map' | 'favorites' | 'account';
  label: string;
  href: string;
  icon: string;
  matchPrefixes: readonly string[];
  exactOnly?: boolean;
  /** 額外 path 正則（比 prefix 更精確，例：/trip/:id/map 也算「地圖」active） */
  additionalActivePatterns?: readonly RegExp[];
}

// 「地圖」 tab — /map exact + /trip/:id/map + /trip/:id/stop/:id/map（in-trip map view），
// 但 /manage/map-xxx 不誤觸（純文字 prefix 不夠精確）。
const MAP_ACTIVE_PATTERNS = [/^\/trip\/[^/]+\/map\/?$/, /^\/trip\/[^/]+\/stop\/[^/]+\/map\/?$/];
// 「行程」 tab — /trips + /trip/:id + 子路由 active，但 /trip/:id/map 與 stop/:id/map 算地圖。
const TRIPS_ACTIVE_PATTERNS = [/^\/trip\/[^/]+(?:\/?$|\/(?!(?:map|stop\/[^/]+\/map)\/?$).*)/];
// 「收藏」 tab — /favorites primary + /favorites/* 子路由 + /explore（secondary entry）。
const FAVORITES_ACTIVE_PATTERNS = [/^\/explore(?:\/|$)/, /^\/favorites\//];

export const PRIMARY_NAV_ITEMS: ReadonlyArray<NavItem> = [
  { key: 'chat',      label: '聊天', href: '/chat',      icon: 'nav-chat',  matchPrefixes: ['/chat'] },
  { key: 'trips',     label: '行程', href: '/trips',     icon: 'nav-trips', matchPrefixes: ['/trips'], additionalActivePatterns: TRIPS_ACTIVE_PATTERNS },
  { key: 'map',       label: '地圖', href: '/map',       icon: 'nav-map',   matchPrefixes: ['/map'], exactOnly: true, additionalActivePatterns: MAP_ACTIVE_PATTERNS },
  { key: 'favorites', label: '收藏', href: '/favorites', icon: 'nav-fav',   matchPrefixes: ['/favorites'], additionalActivePatterns: FAVORITES_ACTIVE_PATTERNS },
  // 2026-07-21：手機右上角的帳號圓圈移除後，帳號一度沒有任何入口。
  // 補成第五個 tab —— 底部列本來就是手機的主要導覽，帳號放這裡比藏在 header 角落合理。
  { key: 'account',   label: '帳號', href: '/account',   icon: 'nav-account', matchPrefixes: ['/account'] },
];

export function isItemActive(pathname: string, item: NavItem): boolean {
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
