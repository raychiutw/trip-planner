/**
 * TripSheetTabs — underline tab header for TripSheet.
 */
import { useCallback, useEffect, useRef } from 'react';
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
  const tablistRef = useRef<HTMLDivElement>(null);
  // 紀錄上次是否由鍵盤觸發切換 — 只有鍵盤切換才需要 sync focus（避免搶點擊行為）
  const keyboardNavRef = useRef(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const idx = SHEET_TABS.indexOf(currentTab);
      let nextIdx: number | null = null;
      if (e.key === 'ArrowRight') nextIdx = (idx + 1) % SHEET_TABS.length;
      else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + SHEET_TABS.length) % SHEET_TABS.length;
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = SHEET_TABS.length - 1;
      if (nextIdx === null) return;
      // SHEET_TABS[nextIdx] 永遠 defined（nextIdx 由 modulo / 0 / length-1 計算得來），
      // 但 noUncheckedIndexedAccess 讓 TS 推成 SheetTab | undefined。顯式 narrow。
      const nextTab = SHEET_TABS[nextIdx];
      if (!nextTab) return;
      e.preventDefault();
      keyboardNavRef.current = true;
      onChange(nextTab);
    },
    [currentTab, onChange],
  );

  // 鍵盤切換後，currentTab 由 parent 更新；此 effect sync focus 到新 active tab。
  useEffect(() => {
    if (!keyboardNavRef.current) return;
    keyboardNavRef.current = false;
    const btn = tablistRef.current?.querySelector<HTMLButtonElement>(`#${sheetTabId(currentTab)}`);
    btn?.focus();
  }, [currentTab]);

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div
        ref={tablistRef}
        className="trip-sheet-tabs"
        role="tablist"
        onKeyDown={handleKeyDown}
      >
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
