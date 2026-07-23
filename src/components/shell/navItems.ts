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
  key: 'chat' | 'trips' | 'map' | 'favorites';
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
  // 帳號不在 tab（HIG 4-tab，grill v2 owner 2026-07-23，supersede #1120 五-tab）：
  // 帳號入口＝手機 header 右上 <AccountCircle/> 圓圈 → Account sheet（W1）／桌機 sidebar 左下 chip。
  // 見 docs/plans/apple-hig-compliance/、DESIGN.md :247。
];

/**
 * tab reselect（spec §1）：點擊「已在該 branch 根」的 tab → 內容捲頂（不清篩選、不重載）。
 * scroll 容器＝`.app-shell-main`（AppShell 的 main 是 overflow scroller，桌機/手機共用）。
 * reduce-motion 時用 auto（不平滑）。GlobalBottomNav（手機）+ DesktopSidebar（桌機）共用。
 */
export function scrollBranchToTop(): void {
  if (typeof document === 'undefined') return;
  const main = document.querySelector<HTMLElement>('.app-shell-main');
  if (!main) return;
  const reduce =
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
  // 實際 scroller 因頁而異：`.app-shell-main` 有 overflow，但多數列表頁又自帶 inner scroll
  // 容器（如 .tp-trips-shell / .tp-account-shell overflow-y:auto，此時 main 本身不捲）。與其
  // 逐頁猜 selector，直接把 main 自己或其內任何「已捲動」（scrollTop>0）的元素捲頂 —— 通常
  // 只有一個在捲。click 才觸發、非熱路徑，querySelectorAll 成本可接受。
  const targets = [main, ...Array.from(main.querySelectorAll<HTMLElement>('*'))].filter(
    (el) => el.scrollTop > 0,
  );
  for (const el of targets) el.scrollTo({ top: 0, behavior });
}

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
