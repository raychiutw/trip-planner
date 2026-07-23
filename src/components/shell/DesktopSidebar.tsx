/**
 * DesktopSidebar — app-level sidebar（rev2 owner 2026-07-17）。
 *
 * rev2：左欄由 primary-nav 改為「我的行程」清單（primary nav 移到底部浮動
 * 玻璃膠囊 GlobalBottomNav）。帳號 chip 維持左下（DESIGN.md:358）。
 *
 * prop-driven：清單資料由上層（DesktopSidebarConnected）經 useMyTrips 注入
 * `trips`，active trip 經 `activeTripId`；pure 版保留給測試 / explicit override。
 *
 * Loading state：user / trips 還沒 resolve 時保持 neutral skeleton，避免 flicker。
 */
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAccountSheet } from '../../contexts/AccountSheetContext';
import { getRememberedBranchLocation } from '../../lib/branchMemory';
import clsx from 'clsx';
import type { MyTrip } from '../../hooks/useMyTrips';
import Icon from '../shared/Icon';
import { PRIMARY_NAV_ITEMS, isItemActive, scrollBranchToTop } from './navItems';

const SCOPED_STYLES = `
.tp-sidebar {
  /* §10.3 vibrancy（owner 2026-07-19）：暖奶油半透明毛玻璃 — color-mix 主背景 + backdrop
   * blur。走主 app token（--color-background/foreground/muted/hover/border）→ 自動
   * light/dark adapt，取代舊固定深棕 --color-sidebar-* token（那組已無其他 consumer）。 */
  background: color-mix(in srgb, var(--color-background) 72%, transparent);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  border-right: 1px solid var(--color-border);
  padding: 16px 12px 12px;
  display: flex; flex-direction: column;
  gap: 2px;
  height: 100%;
  overflow: hidden;
}
.tp-sidebar-brand {
  padding: 2px 8px;
  margin-bottom: 16px;
  display: flex; align-items: center; gap: 8px;
  font-size: var(--font-size-title3); font-weight: 700; letter-spacing: -0.01em;
  color: var(--color-foreground);
  flex-shrink: 0;
}
.tp-sidebar-brand .accent-dot { color: var(--color-accent); }

/* §10.1 primary nav（macOS sidebar 頂部 4-tab；桌機膠囊隱藏後的主導覽，
 * 與 GlobalBottomNav 共用 PRIMARY_NAV_ITEMS + isItemActive）。
 *
 * owner 2026-07-21（第二輪回報 #4）：這裡跟手機 GlobalBottomNav 的玻璃膠囊
 * 視覺不一致（那邊 tint+blur+rim+shadow 四件套，這裡完全沒有材質、只是純色
 * list item）。owner 要求共用 —— 不是重做一個新元件，是套用同一組已存在的
 * --tabbar-* token（GlobalBottomNav 已在用，見該檔 .tp-global-bottom-nav）。
 * 垂直列表跟水平膠囊的排列不同，但材質（半透明 tint + 高斯模糊 + 邊框 + 陰影）
 * 是同一套語言，這樣桌機側欄頂部跟手機底部膠囊才讀作「同一種 chrome」。 */
.tp-sidebar-nav {
  display: flex; flex-direction: column; gap: 2px;
  flex-shrink: 0; margin-bottom: 4px;
  padding: 4px;
  border-radius: var(--radius-lg);
  background: var(--tabbar-tint);
  backdrop-filter: var(--tabbar-filter);
  -webkit-backdrop-filter: var(--tabbar-filter);
  border: var(--tabbar-rim);
  box-shadow: var(--tabbar-shadow);
}
.tp-sidebar-nav-item {
  display: flex; align-items: center; gap: 11px;
  padding: 8px 10px; border-radius: var(--radius-md);
  color: var(--color-muted);
  font-size: var(--font-size-footnote); font-weight: 600;
  text-decoration: none; cursor: pointer;
  min-height: 36px;
  transition: background 150ms var(--transition-timing-function-apple), color 150ms;
}
.tp-sidebar-nav-item .svg-icon { width: 20px; height: 20px; flex-shrink: 0; }
.tp-sidebar-nav-item:hover { background: var(--color-hover); color: var(--color-foreground); }
.tp-sidebar-nav-item:focus-visible { outline: none; box-shadow: var(--shadow-ring); }
.tp-sidebar-nav-item.is-active { background: var(--color-accent-fill); color: var(--color-accent-foreground); }
.tp-sidebar-nav-item.is-active .svg-icon { color: var(--color-accent-foreground); }

.tp-sidebar-divider {
  height: 1px; background: var(--color-border);
  margin: 10px 8px; flex-shrink: 0;
}

.tp-sidebar-section-label {
  padding: 0 8px; margin: 0 0 8px;
  font-size: var(--font-size-caption2); font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--color-muted);
  flex-shrink: 0;
}
.tp-sidebar-trips {
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto; flex: 1; min-height: 0;
}
.tp-trip-item {
  display: block; padding: 9px 12px; border-radius: var(--radius-md);
  color: var(--color-muted);
  font-size: var(--font-size-footnote); font-weight: 600;
  text-decoration: none; cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: background 150ms var(--transition-timing-function-apple), color 150ms;
}
.tp-trip-item:hover { background: var(--color-hover); color: var(--color-foreground); }
.tp-trip-item.is-active { background: var(--color-accent-fill); color: var(--color-accent-foreground); }
.tp-sidebar-trips-empty {
  padding: 12px 8px; color: var(--color-muted);
  font-size: var(--font-size-footnote);
}
.tp-sidebar-trips-loading { display: flex; flex-direction: column; gap: 10px; padding: 10px 12px; }
.tp-trip-skeleton {
  display: block; height: 12px; border-radius: var(--radius-full);
  background: var(--color-border);
}
.tp-trip-skeleton.is-a { width: 82%; }
.tp-trip-skeleton.is-b { width: 60%; }
.tp-trip-skeleton.is-c { width: 72%; }

.tp-sidebar-cta {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  display: flex; flex-direction: column; gap: 8px;
  flex-shrink: 0;
}
.tp-user-chip {
  display: flex; align-items: center; gap: 10px;
  padding: 8px; border-radius: var(--radius-md);
  color: var(--color-muted); font-size: var(--font-size-footnote);
}
.tp-user-chip .tp-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--color-accent-fill);
  color: var(--color-accent-foreground);
  display: grid; place-items: center;
  font-size: var(--font-size-footnote); font-weight: 700; flex-shrink: 0;
}
.tp-user-chip-loading {
  min-height: 52px;
}
.tp-user-chip-loading .tp-avatar {
  background: var(--color-border);
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
  background: var(--color-border);
}
.tp-user-skeleton-line.is-primary { width: 76px; }
.tp-user-skeleton-line.is-secondary {
  width: 116px;
  background: var(--color-secondary);
}

.tp-account-card {
  padding: 10px;
  border-radius: var(--radius-md);
  background: transparent;
  display: flex; align-items: center; gap: 10px;
  text-decoration: none;
  color: var(--color-muted);
  transition: background 150ms var(--transition-timing-function-apple);
  min-height: 52px;
}
.tp-account-card:hover { background: var(--color-hover); }
.tp-account-card:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.tp-account-card .tp-avatar-md {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--color-accent-fill);
  color: var(--color-accent-foreground);
  display: grid; place-items: center;
  font-size: var(--font-size-footnote); font-weight: 700; flex-shrink: 0;
}
.tp-account-card .tp-account-body {
  flex: 1; min-width: 0;
}
.tp-account-card .tp-account-name {
  font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-foreground);
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
  /** rev2：我的行程清單（undefined = 尚未 resolve → skeleton；[] = 無行程） */
  trips?: MyTrip[];
  /** 目前 active trip id（清單 highlight） */
  activeTripId?: string | null;
  /** Optional brand slot override — 預設 "Tripline." */
  brand?: ReactNode;
}

export default function DesktopSidebar({ user, trips, activeTripId, brand }: DesktopSidebarProps) {
  const initial = user?.name?.charAt(0)?.toUpperCase() ?? '?';
  const location = useLocation();
  const { pathname } = location;
  const navigate = useNavigate();
  const { openSheet } = useAccountSheet();

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div className="tp-sidebar" data-testid="desktop-sidebar">
        <div className="tp-sidebar-brand">
          {brand ?? (<>Tripline<span className="accent-dot">.</span></>)}
        </div>

        {/* §10.1 primary nav：macOS sidebar 頂部 4-tab（聊天/行程/地圖/收藏）。桌機膠囊隱藏後
            的主導覽；與 GlobalBottomNav 共用 items + active 邏輯，避免路徑 pattern 兩份漂移。 */}
        <nav className="tp-sidebar-nav" aria-label="主要導覽">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const active = isItemActive(pathname, item);
            return (
              <Link
                key={item.key}
                to={item.href}
                className={clsx('tp-sidebar-nav-item', active && 'is-active')}
                aria-current={active ? 'page' : undefined}
                data-testid={`sidebar-nav-${item.key}`}
                onClick={(e) => {
                  if (active && pathname === item.href) {
                    // reselect（spec §1）：已在該 branch 根 → 捲頂、不重複導覽。
                    e.preventDefault();
                    scrollBranchToTop();
                  } else if (!active) {
                    // per-branch stack：切到別的 tab → 回它記住的完整位置，非 bare href。
                    const remembered = getRememberedBranchLocation(item.key);
                    if (remembered && remembered !== item.href) {
                      e.preventDefault();
                      navigate(remembered);
                    }
                  }
                }}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="tp-sidebar-divider" />

        <div className="tp-sidebar-section-label">我的行程</div>
        <nav className="tp-sidebar-trips" aria-label="我的行程" data-testid="sidebar-trips">
          {trips === undefined ? (
            <div className="tp-sidebar-trips-loading" role="status" aria-label="載入行程中">
              <span className="tp-trip-skeleton is-a" />
              <span className="tp-trip-skeleton is-b" />
              <span className="tp-trip-skeleton is-c" />
            </div>
          ) : trips.length === 0 ? (
            <div className="tp-sidebar-trips-empty">尚無行程</div>
          ) : (
            trips.map((t) => {
              const active = t.tripId === activeTripId;
              return (
                <Link
                  key={t.tripId}
                  to={`/trips?selected=${encodeURIComponent(t.tripId)}`}
                  className={clsx('tp-trip-item', active && 'is-active')}
                  aria-current={active ? 'page' : undefined}
                  data-testid={`sidebar-trip-${t.tripId}`}
                >
                  {t.name}
                </Link>
              );
            })
          )}
        </nav>

        <div className="tp-sidebar-cta">
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
              onClick={() => openSheet(location)}
            >
              <div className="tp-avatar-md" aria-hidden="true">{initial}</div>
              <div className="tp-account-body">
                <div className="tp-account-name">
                  {/* v2.33.45 round 6b: Array.from CJK-safe slice */}
                  {(() => {
                    const chars = Array.from(user.name);
                    return chars.length > 10 ? `${chars.slice(0, 10).join('')}…` : user.name;
                  })()}
                </div>
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
