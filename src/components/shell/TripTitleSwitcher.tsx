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
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
  // Bug 修（2026-07-24）：dropdown 原本是 absolute 掛在 title-wrap 內，被 titlebar 的
  // `.tp-titlebar-title { overflow: hidden }`（給長標題 ellipsis 用）整個裁掉 → 點了打不開。
  // 改用 portal 到 body + fixed 定位（依 trigger rect），逃離所有 parent overflow
  //（同時間軸 time-chip popover 的作法）。
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  // #1445 F13：視窗夾限的水平修正量（加在 pos.right 上；正值 = 往左、負值 = 往右）。
  const [adjust, setAdjust] = useState(0);
  const [menuW, setMenuW] = useState(0);
  const corrections = useRef(0);

  // 點外面關閉。dropdown 已 portal 出去（不在 rootRef 內），故要同時檢查 dropdownRef。
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !dropdownRef.current?.contains(t)) setOpen(false);
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

  // 依 trigger 的 rect 定位 portaled dropdown（fixed）；開啟時算一次，並跟 resize/scroll 更新。
  useLayoutEffect(() => {
    if (!open) { setPos(null); setAdjust(0); corrections.current = 0; return; }
    const btn = triggerRef.current;
    if (!btn) return;
    const update = () => {
      const r = btn.getBoundingClientRect();
      setAdjust(0);
      corrections.current = 0;
      setPos({ top: Math.round(r.bottom + 6), right: Math.round(window.innerWidth - r.right) });
    };
    update();
    window.addEventListener('resize', update);
    // 下拉自己（max-height + overflow）捲動也會冒到 window 的 capture scroll：忽略，否則長清單每個捲動事件都重置夾限並重算。
    const onScroll = (e: Event) => { if (dropdownRef.current?.contains(e.target as Node)) return; update(); };
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  // 視窗夾限（#1445 F13）。dropdown 以 trigger 右緣對齊（right），但窄螢幕上 trigger 靠左，
  // 240px 寬的選單會往左伸出視窗（390px 寬 x=-50、360px 寬 x=-80）。
  // 做法：量 dropdown 實際的 DOM 位置，超出邊距就算出位移量加到 right。用「相對位移」而非
  // 重算絕對 right —— 第一版用 clientWidth 推算絕對值，結果與 fixed 定位的參考邊差了捲軸寬度，
  // 左緣落在 -3px；相對位移不依賴參考邊是哪個。
  // ResizeObserver：字型／內容延後載入會改變寬度，只量一次會算錯。
  const mounted = open && pos !== null;
  useLayoutEffect(() => {
    if (!mounted) { setMenuW(0); return; }
    const d = dropdownRef.current;
    if (!d) return;
    const measure = () => setMenuW(d.getBoundingClientRect().width);
    measure();
    // 舊瀏覽器／jsdom 沒有 ResizeObserver：只量一次，夾限仍會在掛載時生效。
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(d);
    return () => ro.disconnect();
  }, [mounted]);
  const posRight = pos?.right;
  // 寬度變了（搜尋過濾、字型延後載入）是一次新的夾限情境：修正次數重新計。
  useLayoutEffect(() => { corrections.current = 0; }, [menuW]);
  useLayoutEffect(() => {
    if (!mounted) return;
    const d = dropdownRef.current;
    if (!d) return;
    const margin = 8;
    const vw = document.documentElement.clientWidth;
    const r = d.getBoundingClientRect();
    // 還沒排版（寬 0，jsdom 一律如此）不修正；並限制修正次數，避免位置不隨 right 改變時無限迴圈。
    if (r.width === 0 || corrections.current >= 3) return;
    let delta = 0;
    if (r.left < margin) delta = -(margin - r.left);
    else if (r.right > vw - margin) delta = r.right - (vw - margin);
    if (Math.abs(delta) >= 1) {
      corrections.current += 1;
      setAdjust((a) => a + Math.round(delta));
    }
  }, [mounted, posRight, menuW, adjust]);

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
        ref={triggerRef}
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

      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          className="tp-titlebar-trip-dropdown"
          role="menu"
          style={{ position: 'fixed', top: pos.top, right: pos.right + adjust }}
        >
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
        </div>,
        document.body,
      )}
    </div>
  );
}
