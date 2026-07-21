/**
 * TripTitleSwitcher — 標題即切換器。
 *
 * owner 2026-07-21：「手機桌機移除切換行程 icon，改為點下行程名稱後切換，
 * 行程名稱後面接一個 V 符號」。
 *
 * 原本的形制是 TitleBar 右側 actions 放一顆 `⇄ ▾` 按鈕，與左側標題分離 ——
 * 使用者得先認出那顆圖示才知道能換行程，而標題本身明明就是最自然的入口。
 * 改成標題自己是按鈕、後面掛一個 chevron，符合 iOS 上「標題帶 ⌄ = 可切換」
 * 的既有慣例（Files、Mail 的資料夾切換都是這個形制）。
 *
 * 這個元件同時取代了 ChatPage / MapPage / TripsListPage 三份重複的實作。
 * 它們原本各自維護一模一樣的 dropdown markup 與 outside-click 邏輯。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface TripTitleSwitcherItem {
  tripId: string;
  name?: string;
  title?: string | null;
  countries?: string | null;
}

export interface TripTitleSwitcherProps {
  /** 目前顯示的標題文字（通常是 activeTrip 的 title/name）。 */
  label: ReactNode;
  /** 可切換的行程。少於 2 筆時不顯示 chevron —— 沒得換就別給可點的暗示。 */
  trips: TripTitleSwitcherItem[];
  activeTripId: string | null;
  onPick: (tripId: string) => void;
  /** data-testid 前綴，讓各頁的測試能各自定位（chat / map / trips）。 */
  testIdPrefix: string;
}

export default function TripTitleSwitcher({
  label, trips, activeTripId, onPick, testIdPrefix,
}: TripTitleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 點外面關閉。監聽掛在 document 上，且只在開啟時掛 —— 常駐監聽器會讓
  // 每個頁面都多一個永遠在跑的 handler。
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  // 只有一個行程就沒有「切換」可言 —— 顯示純文字，不給可點的假象。
  const switchable = trips.length > 1;
  if (!switchable) return <>{label}</>;

  return (
    <div className="tp-titlebar-trip-title-wrap" ref={rootRef}>
      <button
        type="button"
        className="tp-titlebar-trip-title"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={`${testIdPrefix}-trip-title`}
      >
        <span className="tp-titlebar-trip-title-text">{label}</span>
        {/* 用 SVG 而非「▾」字元：字元的字級與基線隨字體變動，跨平台對不齊。 */}
        <svg className="tp-titlebar-trip-title-chevron" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="tp-titlebar-trip-dropdown" role="menu">
          {trips.map((t) => (
            <button
              key={t.tripId}
              type="button"
              className={`tp-titlebar-trip-row ${t.tripId === activeTripId ? 'is-active' : ''}`}
              onClick={() => { onPick(t.tripId); setOpen(false); }}
              role="menuitem"
              data-testid={`${testIdPrefix}-trip-pick-${t.tripId}`}
            >
              <span className="tp-titlebar-trip-row-title">{t.title || t.name || t.tripId}</span>
              <span className="tp-titlebar-trip-row-meta">
                {(t.countries ?? '').toUpperCase() || t.tripId}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
