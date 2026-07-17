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
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { MyTrip } from '../../hooks/useMyTrips';

const SCOPED_STYLES = `
.tp-sidebar {
  /* 深棕 sidebar surface（mockup line 5126），light/dark 皆固定深底。 */
  background: var(--color-sidebar-bg);
  border-right: 1px solid var(--color-sidebar-bg);
  padding: 20px 14px;
  display: flex; flex-direction: column;
  gap: 2px;
  height: 100%;
  overflow: hidden;
}
.tp-sidebar-brand {
  padding: 0 8px;
  margin-bottom: 18px;
  display: flex; align-items: center; gap: 8px;
  font-size: var(--font-size-title3); font-weight: 700; letter-spacing: -0.01em;
  color: var(--color-sidebar-fg);
  flex-shrink: 0;
}
.tp-sidebar-brand .accent-dot { color: var(--color-accent); }

/* rev2：我的行程清單（取代 primary nav；nav 移底部玻璃膠囊） */
.tp-sidebar-section-label {
  padding: 0 8px; margin: 0 0 8px;
  font-size: var(--font-size-caption2); font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--color-sidebar-fg-faint);
  flex-shrink: 0;
}
.tp-sidebar-trips {
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto; flex: 1; min-height: 0;
}
.tp-trip-item {
  display: block; padding: 9px 12px; border-radius: var(--radius-md);
  color: var(--color-sidebar-fg-muted);
  font-size: var(--font-size-footnote); font-weight: 600;
  text-decoration: none; cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: background 150ms var(--transition-timing-function-apple), color 150ms;
}
.tp-trip-item:hover { background: var(--color-sidebar-fg-hover); color: var(--color-sidebar-fg); }
.tp-trip-item.is-active { background: var(--color-accent); color: var(--color-accent-foreground); }
.tp-sidebar-trips-empty {
  padding: 12px 8px; color: var(--color-sidebar-fg-faint);
  font-size: var(--font-size-footnote);
}
.tp-sidebar-trips-loading { display: flex; flex-direction: column; gap: 10px; padding: 10px 12px; }
.tp-trip-skeleton {
  display: block; height: 12px; border-radius: var(--radius-full);
  background: var(--color-sidebar-fg-skel-faint);
}
.tp-trip-skeleton.is-a { width: 82%; }
.tp-trip-skeleton.is-b { width: 60%; }
.tp-trip-skeleton.is-c { width: 72%; }

.tp-sidebar-cta {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--color-sidebar-fg-faint);
  display: flex; flex-direction: column; gap: 8px;
  flex-shrink: 0;
}
.tp-user-chip {
  display: flex; align-items: center; gap: 10px;
  padding: 8px; border-radius: var(--radius-md);
  color: var(--color-sidebar-fg-muted); font-size: var(--font-size-footnote);
}
.tp-user-chip .tp-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  display: grid; place-items: center;
  font-size: var(--font-size-footnote); font-weight: 700; flex-shrink: 0;
}
.tp-user-chip-loading {
  min-height: 52px;
}
.tp-user-chip-loading .tp-avatar {
  background: var(--color-sidebar-fg-faint);
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
  background: var(--color-sidebar-fg-skel-faint);
}
.tp-user-skeleton-line.is-primary { width: 76px; }
.tp-user-skeleton-line.is-secondary {
  width: 116px;
  background: var(--color-sidebar-fg-skel-secondary);
}

.tp-account-card {
  padding: 10px;
  border-radius: var(--radius-md);
  background: transparent;
  display: flex; align-items: center; gap: 10px;
  text-decoration: none;
  color: var(--color-sidebar-fg-muted);
  transition: background 150ms var(--transition-timing-function-apple);
  min-height: 52px;
}
.tp-account-card:hover { background: var(--color-sidebar-fg-hover); }
.tp-account-card:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.tp-account-card .tp-avatar-md {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  display: grid; place-items: center;
  font-size: var(--font-size-footnote); font-weight: 700; flex-shrink: 0;
}
.tp-account-card .tp-account-body {
  flex: 1; min-width: 0;
}
.tp-account-card .tp-account-name {
  font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-sidebar-fg);
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

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div className="tp-sidebar" data-testid="desktop-sidebar">
        <div className="tp-sidebar-brand">
          {brand ?? (<>Tripline<span className="accent-dot">.</span></>)}
        </div>

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
