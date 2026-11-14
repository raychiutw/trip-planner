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
import { useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAccountSheet } from '../../contexts/AccountSheetContext';
import { getRememberedBranchLocation } from '../../lib/branchMemory';
import clsx from 'clsx';
import type { MyTrip, MyTripsState } from '../../hooks/useMyTrips';
import Icon from '../shared/Icon';
import SidebarToggle from './SidebarToggle';
import TripCardMenu, { type TripCardMenuProps } from '../trip/TripCardMenu';
import { PRIMARY_NAV_ITEMS, isItemActive, scrollBranchToTop, tripDestination } from './navItems';
import { useActiveTrip } from '../../contexts/ActiveTripContext';

const SCOPED_STYLES = `
.tp-sidebar {
  /* #1689（owner 2026-11-13 簽核 B）：macOS tint source list —— 實底 secondary（不半透明、
   * 不 tp-glass）+ 右側 1px 分隔線；走主 app token → 自動 light/dark adapt。 */
  background: var(--color-secondary);
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
.tp-sidebar-toggle {
  margin-left: auto; width: 32px; height: 32px; border-radius: 8px; border: 0; cursor: pointer;
  display: grid; place-items: center; background: transparent; color: var(--color-muted);
}
.tp-sidebar-toggle:hover { background: var(--color-hover); color: var(--color-foreground); }
.tp-sidebar-toggle:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }

/* §10.1 primary nav（macOS sidebar 頂部 4-tab，與 GlobalBottomNav 共用 PRIMARY_NAV_ITEMS +
 * isItemActive）。#1689：不再包浮動框線卡片（tabbar 玻璃材質只給手機底部膠囊）。 */
.tp-sidebar-nav {
  display: flex; flex-direction: column; gap: 2px;
  flex-shrink: 0; margin-bottom: 4px;
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
.tp-sidebar-nav-item .svg-icon { width: 20px; height: 20px; flex-shrink: 0; color: var(--color-muted); }
.tp-sidebar-nav-item:hover { background: var(--color-hover); color: var(--color-foreground); }
.tp-sidebar-nav-item:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--color-background); }
.tp-sidebar-nav-item.is-active { background: var(--color-accent-bg); color: var(--color-selected-fg); }
.tp-sidebar-nav-item.is-active .svg-icon { color: var(--color-selected-fg); }

.tp-sidebar-divider {
  height: 1px; background: var(--color-border);
  margin: 10px 8px; flex-shrink: 0;
}

.tp-sidebar-section-label {
  display: flex; align-items: center; gap: 4px; width: 100%;
  padding: 2px 8px; margin: 0 0 4px; min-height: 24px;
  border: 0; background: transparent; cursor: pointer; font-family: inherit;
  font-size: var(--font-size-caption); font-weight: 600;
  color: var(--color-muted);
  flex-shrink: 0;
}
.tp-sidebar-section-label:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--color-background); }
.tp-sidebar-section-label .svg-icon { width: 12px; height: 12px; transition: transform 150ms; transform: rotate(90deg); }
.tp-sidebar-section-label[aria-expanded="false"] .svg-icon { transform: none; }
.tp-sidebar-trips[hidden] { display: none; }
.tp-sidebar-trips {
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto; flex: 1; min-height: 0;
}
.tp-sidebar-trips-filter {
  flex-shrink: 0; width: 100%; box-sizing: border-box; margin: 0 0 4px;
  padding: 6px 10px; border-radius: var(--radius-md);
  border: 1px solid var(--color-border); background: var(--color-background);
  color: var(--color-foreground); font: inherit; font-size: var(--font-size-footnote);
}
.tp-sidebar-trips-filter:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
.tp-sidebar-past-toggle { margin-top: 6px; }
.tp-trip-item {
  flex-shrink: 0; /* #1704：列變高時不被 flex column 壓扁 */
  position: relative; display: block; padding: 9px 12px; border-radius: var(--radius-md);
  color: var(--color-muted);
  font-size: var(--font-size-footnote); font-weight: 600;
  text-decoration: none; cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: background 150ms var(--transition-timing-function-apple), color 150ms;
}
.tp-trip-item:hover { background: var(--color-hover); color: var(--color-foreground); }
/* #1707（#1703 B）：目前行程是脈絡、為次 —— 無底，只有字重 700 + 左側 3px 柔褐短條；主位是上面的 root tab 膠囊。 */
.tp-trip-item.is-active { color: var(--color-foreground); font-weight: 700; }
.tp-trip-item.is-active::before {
  content: ''; position: absolute; left: 2px; top: 8px; bottom: 8px; width: 3px;
  border-radius: var(--radius-full); background: var(--color-accent);
}
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
.tp-account-card:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--color-background); }
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
.tp-account-card .tp-account-email {
  font-size: var(--font-size-caption); color: var(--color-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
`;

/** 本機日期 YYYY-MM-DD（與 start/endDate 同格式，可直接字串比較）。 */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 已歸檔不列入；結束日（缺則起始日）早於今天 = 過去；沒日期的視為即將出發。 */
export function groupSidebarTrips(trips: MyTrip[], query: string, today = todayLocal()) {
  const q = query.trim().toLowerCase();
  const shown = trips.filter((t) => t.archivedAt == null && (!q || `${t.name} ${t.title ?? ''}`.toLowerCase().includes(q)));
  const isPast = (t: MyTrip) => { const end = t.endDate ?? t.startDate; return !!end && end < today; };
  return { current: shown.filter((t) => !isPast(t)), past: shown.filter(isPast) };
}

export interface SidebarUser {
  name: string;
  email: string;
}

/** 行程列右鍵選單的動作（和行程卡 ⋯ 同一個 TripCardMenu）；回 null＝這列不開選單。 */
export type SidebarTripMenu = (trip: MyTrip) => Omit<TripCardMenuProps, 'tripId' | 'contextTargetRef' | 'hideTrigger'> | null;

function SidebarTripRow({ trip, active, menu, to, onOpen }: { trip: MyTrip; active: boolean; menu: ReturnType<SidebarTripMenu>; to: string; onOpen: () => void }) {
  const ref = useRef<HTMLAnchorElement>(null);
  return (
    <>
      <Link
        ref={ref}
        to={to}
        className={clsx('tp-trip-item', active && 'is-active')}
        onClick={onOpen}
        aria-current={active ? 'page' : undefined}
        data-testid={`sidebar-trip-${trip.tripId}`}
      >
        {trip.name}
      </Link>
      {menu && <TripCardMenu tripId={trip.tripId} contextTargetRef={ref} hideTrigger {...menu} />}
    </>
  );
}

export interface DesktopSidebarProps {
  /** undefined = auth loading, null = confirmed unauthenticated */
  user?: SidebarUser | null | undefined;
  /** rev2：我的行程清單（undefined = 尚未 resolve → skeleton；[] = 無行程） */
  trips?: MyTrip[];
  tripsStatus?: MyTripsState['status'];
  /** 目前 active trip id（清單 highlight） */
  activeTripId?: string | null;
  /** Optional brand slot override — 預設 "Tripline." */
  brand?: ReactNode;
  /** 行程列的右鍵 / Shift+F10 / Delete 選單（#1695）；不傳＝純導覽列。 */
  tripMenu?: SidebarTripMenu;
}

export default function DesktopSidebar({ user, trips, tripsStatus, activeTripId, brand, tripMenu }: DesktopSidebarProps) {
  const initial = user?.name?.charAt(0)?.toUpperCase() ?? '?';
  // v2.33.45 round 6b: Array.from CJK-safe slice。顯示字串同時是無障礙名稱的開頭（WCAG 2.5.3 Label in Name）。
  const nameChars = user ? Array.from(user.name) : [];
  const displayName = nameChars.length > 10 ? `${nameChars.slice(0, 10).join('')}…` : (user?.name ?? '');
  const location = useLocation();
  const { pathname } = location;
  const navigate = useNavigate();
  const [tripsOpen, setTripsOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [pastOpen, setPastOpen] = useState(false);
  const { openSheet } = useAccountSheet();
  const { setActiveTrip } = useActiveTrip();

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div className="tp-sidebar" id="desktop-sidebar" data-testid="desktop-sidebar">
        <div className="tp-sidebar-brand">
          {brand ?? (<>Tripline<span className="accent-dot">.</span></>)}
          <SidebarToggle />
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
                <Icon name={active ? item.iconActive : item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="tp-sidebar-divider" />

        <button
          type="button"
          className="tp-sidebar-section-label"
          aria-expanded={tripsOpen}
          aria-controls="sidebar-trips"
          onClick={() => setTripsOpen((o) => !o)}
        >
          <Icon name="chevron-right" />
          我的行程
        </button>
        <nav className="tp-sidebar-trips" id="sidebar-trips" hidden={!tripsOpen} aria-label="我的行程" data-testid="sidebar-trips">
          {tripsStatus === 'error' && trips === undefined ? (
            <div className="tp-sidebar-trips-empty" role="alert">載入行程失敗，請稍後再試</div>
          ) : trips === undefined ? (
            <div className="tp-sidebar-trips-loading" role="status" aria-label="載入行程中">
              <span className="tp-trip-skeleton is-a" />
              <span className="tp-trip-skeleton is-b" />
              <span className="tp-trip-skeleton is-c" />
            </div>
          ) : (() => {
            const { current, past } = groupSidebarTrips(trips, query);
            const row = (t: MyTrip) => <SidebarTripRow key={t.tripId} trip={t} active={t.tripId === activeTripId} menu={tripMenu?.(t) ?? null} to={tripDestination(pathname, t.tripId)} onOpen={() => setActiveTrip(t.tripId)} />;
            const pastShown = pastOpen || (query.trim() !== '' && past.length > 0); // 過濾命中過去行程時自動展開
            return (
              <>
                <input
                  type="search" className="tp-sidebar-trips-filter" data-testid="sidebar-trips-filter"
                  placeholder="搜尋行程名稱" aria-label="搜尋行程名稱"
                  value={query} onChange={(e) => setQuery(e.target.value)}
                />
                {current.length === 0 && past.length === 0 && <div className="tp-sidebar-trips-empty" data-testid="sidebar-trips-no-match">{query.trim() ? '找不到符合的行程' : '尚無行程'}</div>}
                {current.map(row)}
                {past.length > 0 && (
                  <>
                    <button
                      type="button" className="tp-sidebar-section-label tp-sidebar-past-toggle"
                      aria-expanded={pastShown} data-testid="sidebar-trips-past-toggle"
                      onClick={() => setPastOpen((o) => !o)}
                    >
                      <Icon name="chevron-right" />
                      過去 · {past.length}
                    </button>
                    {pastShown && past.map(row)}
                  </>
                )}
              </>
            );
          })()}
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
              id="account-sheet-open-desktop"
              className="tp-account-card"
              data-testid="sidebar-account-card"
              onClick={() => openSheet(location)}
            >
              <div className="tp-avatar-md" aria-hidden="true">{initial}</div>
              <div className="tp-account-body">
                <div className="tp-account-name">
                  {displayName}
                </div>
                {/* 無障礙名稱 = 顯示名稱 + 後綴；不用 aria-label，否則 axe（WCAG 2.5.3）會把 aria-hidden 頭像的首字也算進可見文字而判不符。 */}
                <div className="tp-account-email">{user.email}</div>
                <span className="sr-only"> 帳號設定</span>
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
