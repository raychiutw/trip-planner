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
/* 底部 4-tab **浮動玻璃膠囊**（HIG iOS 26 floating capsule 形制）。不滿版 → 左右露出
 * 內容、玻璃才有東西透。定位（fixed 置中）由 AppShell .app-shell-bottom-nav 負責。
 *
 * 材質沿革：owner 2026-07-20「我不要白底」→ 當時把材質**整個刪掉**（transparent +
 * 給 icon/label 補黑色投影代償），結果是一排浮空 icon、讀不出這是一組導覽。真正的根因不是
 * 「有底」而是底被**品牌奶油色**染色（secondary 62% 疊奶油頁 = cream-on-cream），
 * 那違反 HIG「glass 不上 tint，顏色留給 content layer」。改中性 --glass-tint 後
 * 材質可以回歸，膠囊重新是一個容器。SoT：
 * docs/design-sessions/2026-07-20-chrome-hig-regular-glass.html */
.tp-global-bottom-nav {
  display: flex;
  gap: 2px;
  padding: 6px;
  border-radius: var(--radius-full);
  background: var(--glass-tint);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  border: var(--glass-rim);
  box-shadow: var(--glass-specular), var(--glass-shadow);
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
  /* inactive 用 foreground 而非 muted：膠囊可能浮在 satellite/hybrid 圖磚上
   * （MapFabs MapTileStyle），合成底 #A8A8A8 配 muted 只有 2.76:1，而 11px bold
   * 不算 WCAG large text（門檻 4.5 非 3.0）。foreground 得 6.39:1。
   * active/inactive 的區分靠 accent 實心藥丸，不靠文字灰階 —— 用灰階換來的是 a11y 失敗。 */
  color: var(--color-foreground);
  font: inherit;
  transition: background 140ms, color 140ms;
}
.tp-global-bottom-nav-btn .svg-icon {
  width: 22px; height: 22px;
}
.tp-global-bottom-nav-btn span {
  /* HIG tab label 11px/700。DESIGN.md L58 本就寫 11px，是 code 漂移成 eyebrow(10px)；
   * --font-size-caption2(0.6875rem) 早就存在只是沒被用。line-height 13px 給 CJK 留空間。 */
  font-size: var(--font-size-caption2);
  line-height: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.tp-global-bottom-nav-btn:hover { background: var(--color-hover); }
.tp-global-bottom-nav-btn.is-active {
  background: var(--color-accent-fill);
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
