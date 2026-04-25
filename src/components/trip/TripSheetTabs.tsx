/**
 * TripSheetTabs — underline tab header for TripSheet.
 */
import clsx from 'clsx';
import { SHEET_TABS, sheetPanelId, sheetTabId, type SheetTab } from '../../lib/trip-url';

const TAB_LABELS: Record<SheetTab, string> = {
  itinerary: '行程',
  ideas: '想法',
  map: '地圖',
  chat: '聊天',
};

const SCOPED_STYLES = `
.trip-sheet-tabs {
  display: flex; gap: 2px; flex: 1;
  overflow-x: auto; scrollbar-width: none;
}
.trip-sheet-tabs::-webkit-scrollbar { display: none; }
.trip-sheet-tab {
  padding: 8px 14px; border: none; background: transparent;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  font: inherit; font-size: 13px; font-weight: 500;
  color: var(--color-muted); cursor: pointer;
  white-space: nowrap; min-height: var(--spacing-tap-min);
  transition: color 150ms, border-bottom-color 150ms;
}
.trip-sheet-tab:hover:not(.is-active) { color: var(--color-foreground); }
.trip-sheet-tab.is-active {
  color: var(--color-foreground);
  border-bottom-color: var(--color-accent);
  font-weight: 600;
}
`;

export interface TripSheetTabsProps {
  currentTab: SheetTab;
  onChange: (tab: SheetTab) => void;
}

export default function TripSheetTabs({ currentTab, onChange }: TripSheetTabsProps) {
  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div className="trip-sheet-tabs" role="tablist">
        {SHEET_TABS.map((tab) => (
          <button
            key={tab}
            id={sheetTabId(tab)}
            type="button"
            role="tab"
            aria-selected={currentTab === tab}
            aria-controls={sheetPanelId(tab)}
            tabIndex={currentTab === tab ? 0 : -1}
            className={clsx('trip-sheet-tab', currentTab === tab && 'is-active')}
            onClick={() => onChange(tab)}
            data-testid={`trip-sheet-tab-${tab}`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
    </>
  );
}
