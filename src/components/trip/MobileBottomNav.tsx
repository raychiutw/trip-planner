/**
 * MobileBottomNav — bottom tab bar on ≤760px viewports (PR3: 4-tab route-based)
 *
 * 4 tabs: 行程 / 地圖 / 訊息 / 更多
 *  - 行程: navigate('/trip/:tripId') + scroll-to-top
 *  - 地圖: navigate('/trip/:tripId/map')
 *  - 訊息: navigate('/manage')
 *  - 更多: onOpenSheet('action-menu')
 *
 * Active state driven by useLocation pathname match.
 * CSS: grid-template-columns: repeat(4, 1fr)
 */

import clsx from 'clsx';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../shared/Icon';

type TabKey = 'home' | 'map' | 'message' | 'menu';

interface MobileBottomNavProps {
  /** Trip ID used for navigate targets. */
  tripId: string;
  /** Currently-open sheet key (used to highlight 更多 tab). */
  activeSheet: string | null;
  /** Trigger a sheet by key. */
  onOpenSheet: (key: string) => void;
  /** Clear any active sheet (legacy compat — not used for route tabs). */
  onClearSheet?: () => void;
  /** Online gating (kept for future use). */
  isOnline?: boolean;
}

export default function MobileBottomNav({
  tripId,
  activeSheet,
  onOpenSheet,
  isOnline: _isOnline = true,
}: MobileBottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  function currentTab(): TabKey {
    const { pathname } = location;
    // Map tab: must match /trip/:id/map exactly (and sub-routes), not just any path containing '/map'
    if (/\/trip\/[^/]+\/map/.test(pathname)) return 'map';
    // Message tab: /manage
    if (pathname.startsWith('/manage')) return 'message';
    // 更多 tab: open sheet that's not a route
    if (
      activeSheet === 'action-menu' ||
      activeSheet === 'checklist' ||
      activeSheet === 'backup' ||
      activeSheet === 'driving' ||
      activeSheet === 'appearance' ||
      activeSheet === 'trip-select' ||
      activeSheet === 'emergency' ||
      activeSheet === 'today-route' ||
      activeSheet === 'suggestions' ||
      activeSheet === 'flights'
    ) return 'menu';
    // Default: 行程 (matches /trip/:id or any sub-route not caught above)
    return 'home';
  }

  const tab = currentTab();

  const go = (target: TabKey) => {
    switch (target) {
      case 'home':
        navigate(`/trip/${tripId}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'map':
        navigate(`/trip/${tripId}/map`);
        break;
      case 'message':
        navigate('/manage');
        break;
      case 'menu':
        onOpenSheet('action-menu');
        break;
    }
  };

  const tabs: { k: TabKey; icon: string; label: string }[] = [
    { k: 'home',    icon: 'home',   label: '行程' },
    { k: 'map',     icon: 'map',    label: '地圖' },
    { k: 'message', icon: 'phone',  label: '助理' },
    { k: 'menu',    icon: 'menu',   label: '更多' },
  ];

  return (
    <nav className="ocean-bottom-nav" aria-label="主要功能">
      {tabs.map((t) => {
        const active = tab === t.k;
        return (
          <button
            key={t.k}
            type="button"
            className={clsx('ocean-bottom-nav-btn', active && 'is-active')}
            aria-current={active ? 'page' : undefined}
            aria-label={t.label}
            onClick={() => go(t.k)}
          >
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
