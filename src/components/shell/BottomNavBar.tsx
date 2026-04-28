/**
 * BottomNavBar — trip-scoped 4-tab mobile bottom nav.
 *
 * @deprecated Section 5 (terracotta-mockup-parity-v2 / E4)：mockup 對齊 5-tab
 *   global IA，全 page 統一用 `<GlobalBottomNav>`。本 component 已不被任何
 *   page render，「更多」 sheet 4 action 已遷移：
 *     共編 → trip TitleBar；切換行程 → /trips；外觀 → AccountPage；下載 → OverflowMenu
 *   File 暫保留，未來 cleanup PR 再砍。
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
