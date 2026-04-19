/**
 * MobileBottomNav — bottom tab bar on ≤760px viewports (Okinawa Trip Mobile.html 對齊)
 *
 * 5 tabs: 行程 / 編輯 / 建議 / 航班 / 更多
 *  - 行程: clear activeSheet, scroll to top
 *  - 編輯: link to /manage/ (AI edit page)
 *  - 建議: open 'suggestions' sheet
 *  - 航班: open 'flights' sheet
 *  - 更多: open 'ai-group' aggregate sheet (checklist/backup/driving/etc)
 */

import clsx from 'clsx';
import Icon from '../shared/Icon';

type TabKey = 'home' | 'editor' | 'suggest' | 'flight' | 'menu';

interface MobileBottomNavProps {
  /** Currently-open sheet key (maps to tab highlight). */
  activeSheet: string | null;
  /** Trigger a sheet by key. */
  onOpenSheet: (key: string) => void;
  /** Clear any active sheet (used by 行程 tab). */
  onClearSheet: () => void;
  /** Online gating for editor link. */
  isOnline?: boolean;
}

export default function MobileBottomNav({
  activeSheet,
  onOpenSheet,
  onClearSheet,
  isOnline = true,
}: MobileBottomNavProps) {
  function currentTab(): TabKey {
    if (activeSheet === 'suggestions') return 'suggest';
    if (activeSheet === 'flights') return 'flight';
    if (
      activeSheet === 'action-menu' ||
      activeSheet === 'checklist' ||
      activeSheet === 'backup' ||
      activeSheet === 'driving' ||
      activeSheet === 'appearance' ||
      activeSheet === 'trip-select' ||
      activeSheet === 'emergency'
    ) return 'menu';
    return 'home';
  }
  const tab = currentTab();

  const go = (target: TabKey) => {
    switch (target) {
      case 'home':
        onClearSheet();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'suggest':
        onOpenSheet('suggestions');
        break;
      case 'flight':
        onOpenSheet('flights');
        break;
      case 'menu':
        onOpenSheet('action-menu');
        break;
      case 'editor':
        if (isOnline) window.location.href = '/manage/';
        break;
    }
  };

  const tabs: { k: TabKey; icon: string; label: string }[] = [
    { k: 'home',    icon: 'home',       label: '行程' },
    { k: 'editor',  icon: 'edit',       label: '編輯' },
    { k: 'suggest', icon: 'lightbulb',  label: '建議' },
    { k: 'flight',  icon: 'plane',      label: '航班' },
    { k: 'menu',    icon: 'menu',       label: '更多' },
  ];

  return (
    <nav className="ocean-bottom-nav" aria-label="主要功能">
      {tabs.map((t) => {
        const active = tab === t.k;
        const disabled = t.k === 'editor' && !isOnline;
        return (
          <button
            key={t.k}
            type="button"
            className={clsx('ocean-bottom-nav-btn', active && 'is-active')}
            aria-current={active ? 'page' : undefined}
            aria-label={t.label}
            disabled={disabled}
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
