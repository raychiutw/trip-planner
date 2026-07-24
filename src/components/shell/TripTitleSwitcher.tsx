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
  // W6：長清單搜尋 —— 行程數超過門檻才顯搜尋框，純 client filter（無 debounce）。
  const [query, setQuery] = useState('');
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

  // W6：清單長時（>8）才顯搜尋框；本地 filter title/name/countries/id。
  const showSearch = trips.length > 8;
  const q = query.trim().toLowerCase();
  const shown = q
    ? trips.filter((t) =>
        `${t.title ?? ''} ${t.name ?? ''} ${t.countries ?? ''} ${t.tripId}`.toLowerCase().includes(q))
    : trips;

  return (
    <div className="tp-titlebar-trip-title-wrap" ref={rootRef}>
      <button
        type="button"
        className="tp-titlebar-trip-title"
        onClick={() => setOpen((o) => { if (o) setQuery(''); return !o; })}
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
          {showSearch && (
            // W6 長清單搜尋。此搜尋是行程選擇器內的 scoped 搜尋（spec §6），非頁面內容搜尋，
            // 不與 W7「地圖/聊天/帳號不顯 page-level 搜尋」衝突（W7 guard 讀頁面檔、非本元件）。
            <input
              type="search"
              className="tp-titlebar-trip-search"
              placeholder="搜尋行程…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="搜尋行程"
              data-testid={`${testIdPrefix}-trip-search`}
              autoFocus
            />
          )}
          {shown.map((t) => {
            const active = t.tripId === activeTripId;
            return (
              <button
                key={t.tripId}
                type="button"
                className={`tp-titlebar-trip-row ${active ? 'is-active' : ''}`}
                onClick={() => { onPick(t.tripId); setOpen(false); setQuery(''); }}
                // W6：單選語意（menuitemradio + aria-checked）+ 目前列 checkmark，讓 VoiceOver
                // 讀得出「已選取」（原本只有底色/字色變化，SR 讀不出狀態）。
                role="menuitemradio"
                aria-checked={active}
                data-testid={`${testIdPrefix}-trip-pick-${t.tripId}`}
              >
                <span className="tp-titlebar-trip-row-title">{t.title || t.name || t.tripId}</span>
                <span className="tp-titlebar-trip-row-meta">
                  {(t.countries ?? '').toUpperCase() || t.tripId}
                </span>
                {active && (
                  <svg className="tp-titlebar-trip-row-check" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M5 10.5 8.5 14 15 6.5" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
          {showSearch && q && shown.length === 0 && (
            <div className="tp-titlebar-trip-empty">找不到符合的行程</div>
          )}
        </div>
      )}
    </div>
  );
}
