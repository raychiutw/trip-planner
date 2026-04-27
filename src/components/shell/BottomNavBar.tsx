/**
 * BottomNavBar — trip-scoped mobile tab bar (4-tab: 行程 / 地圖 / 助理 / 更多).
 *
 * Why sticky + inset-block-end: keeps nav aligned to AppShell grid cell bottom
 * instead of escaping to viewport (fixed positioning would bypass grid).
 */

import clsx from 'clsx';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../shared/Icon';

type TabKey = 'home' | 'map' | 'message' | 'menu';

const MENU_SHEETS = new Set<string>([
  'action-menu',
  'checklist',
  'backup',
  'appearance',
  'trip-select',
  'emergency',
  'today-route',
  'suggestions',
  'flights',
]);

interface BottomNavBarProps {
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

export default function BottomNavBar({
  tripId,
  activeSheet,
  onOpenSheet,
  isOnline: _isOnline = true,
}: BottomNavBarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  function currentTab(): TabKey {
    const { pathname } = location;
    // Map tab: must match /trip/:id/map exactly (and sub-routes), not just any path containing '/map'
    if (/\/trip\/[^/]+\/map/.test(pathname)) return 'map';
    if (pathname.startsWith('/chat')) return 'message';
    if (activeSheet && MENU_SHEETS.has(activeSheet)) return 'menu';
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
        navigate('/chat');
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
