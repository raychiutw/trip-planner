/**
 * GlobalBottomNav — 4-tab 底部浮動玻璃導航（rev2；手機 + 桌機共用同元件）。
 *
 * 4-tab global IA(聊天 / 行程 / 地圖 / 收藏),所有 page 共用,包含 trip-scoped
 * /trip/:id。帳號已移出 tab slot(手機 header 右上 AccountCircle / 桌機 sidebar chip)。
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
// rev2 §10.1（2026-07-19）：primary IA（4-tab）+ active 判定抽到 navItems 單一來源，
// DesktopSidebar（桌機 sidebar 頂部）共用同一份，避免兩份路徑 pattern 漂移。
import { PRIMARY_NAV_ITEMS, isItemActive } from './navItems';

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
  /* rev2 iOS 26 Liquid Glass。原 cream 82% + 弱影在奶油頁面上 cream-on-cream 無對比 →
   * 看起來像色塊非浮動玻璃。修法靠「降透明度到 62%（底下內容透得出）＋亮 specular 上緣＋
   * 較強暖落影」讓膠囊浮起（非靠加重 blur）。blur 用 --blur-glass(14px) 與 titlebar/sheet
   * 三層一致（DESIGN.md L281 glass 一致性規則；saturate 僅 sheet 不加）。token 化 light/dark adapt。 */
  background: color-mix(in srgb, var(--color-secondary) 62%, transparent);
  backdrop-filter: blur(var(--blur-glass)) saturate(180%);
  -webkit-backdrop-filter: blur(var(--blur-glass)) saturate(180%);
  border: 1px solid color-mix(in srgb, var(--color-foreground) 14%, transparent);
  box-shadow:
    0 14px 34px rgba(42, 31, 24, .30),
    0 3px 10px rgba(42, 31, 24, .12),
    inset 0 1px 0 rgba(255, 255, 255, .45);
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
/* rev2 §10.1（2026-07-19）：桌機底部膠囊已隱藏（primary nav 搬進 sidebar，見
 * AppShell @≥1024 .app-shell-bottom-nav display:none）。原桌機 row-layout 覆蓋已移除。
 * 此元件現只在手機（<1024）顯示。 */
`;

export interface GlobalBottomNavProps {
  /**
   * True when user is signed in. 目前 4-tab IA 不依 auth 分歧（帳號/登入已移出 tab
   * slot → header 圓圈），故此 prop 現無作用；保留於 API 供未來 auth-gated tab，
   * 呼叫端仍傳當前登入狀態。
   */
  authed: boolean;
}

export default function GlobalBottomNav({ authed }: GlobalBottomNavProps) {
  void authed; // 保留 prop（見 interface 註解）；目前 IA auth-independent。
  const { pathname } = useLocation();

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div className="tp-global-bottom-nav" data-testid="global-bottom-nav">
        {PRIMARY_NAV_ITEMS.map((item) => {
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
