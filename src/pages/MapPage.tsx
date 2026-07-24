/**
 * MapPage — fullscreen map view (Funliday-style navigation).
 *
 *  /trip/:tripId/map                  → day 1 by default
 *  /trip/:tripId/map?day=N            → specific day
 *  /trip/:tripId/map?day=all          → overview (all days, per-day dayColor polyline)
 *  /trip/:tripId/stop/:entryId/map    → focus that entry (auto-detects day)
 *
 *  ┌────────────────────────────────────────────┐
 *  │ ← 返回   總覽 · 7/29 – 8/4  |  DAY NN ...  │  52px topbar
 *  ├────────────────────────────────────────────┤
 *  │                                            │
 *  │          TpMap (flyTo activeEntry       │  flex-1
 *  │          or fitBounds in overview)         │
 *  ├────────────────────────────────────────────┤
 *  │ 總覽 · 7天  DAY 01 · 7/29  DAY 02 · ···   │  day tabs (snap-scroll)
 *  ├────────────────────────────────────────────┤
 *  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ···           │  entry cards (snap-scroll)
 *  │ │D1 10:45│ │D1 12:10│ │D2 13:00│ ···      │  (D{N} prefix only in overview)
 *  │ └────┘ └────┘ └────┘ └────┘                │
 *  └────────────────────────────────────────────┘
 */

import { Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { lazyWithRetry } from '../lib/lazyWithRetry';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTripContext } from '../contexts/TripContext';
import { extractPinsFromDay, extractPinsFromAllDays, type MapPin } from '../hooks/useMapData';
import { apiFetch } from '../lib/apiClient';
import { dayColor } from '../lib/dayPalette';
import { findEntryInDays } from '../lib/mapDay';
import Icon from '../components/shared/Icon';
import AppShell from '../components/shell/AppShell';
import TripTitleSwitcher from '../components/shell/TripTitleSwitcher';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import AccountCircle from '../components/shell/AccountCircle';
import MapDayTab from '../components/trip/MapDayTab';
import MapEntryCard, { type EntryKind } from '../components/trip/MapEntryCard';
import MapFabs from '../components/trip/MapFabs';
import GooglePoiCard from '../components/trip/GooglePoiCard';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useDayStripNav } from '../hooks/useDayStripNav';
import type { GooglePoiClick } from '../lib/mapHelpers';


const TpMap = lazyWithRetry(() => import('../components/trip/TpMap'));

const SCOPED_STYLES = `
.map-page-wrap {
  /* rev2 owner 2026-07-19：地圖頁改 full-bleed —— 地圖填滿、day tab 浮頂、POI 卡浮底、
   * 都疊在地圖上（無白帶）。原 flex column（地圖 body → day tab → POI 白帶堆疊）改為
   * relative 定位容器 + 絕對定位浮層。height:100% 填 main content-area（AppShell 已為
   * bottom-nav 留 padding，浮層 bottom 相對 wrap 即在 nav 之上）。 */
  height: 100%;
  position: relative;
  background: var(--color-background);
  overflow: hidden;
}
.map-page-body {
  position: absolute;
  /* owner 2026-07-19：地圖從 titlebar **下方**開始填（非跑到 titlebar 下），否則 Google
   * TOP_LEFT 的 +/- 縮放鍵被浮動 titlebar 蓋。仍 full-bleed（填滿 titlebar 以下、無白帶）、
   * day tab 仍浮頂、POI 仍浮底；縮放鍵在 titlebar 下方正常露出。 */
  top: var(--titlebar-h, 64px);
  left: 0; right: 0; bottom: 0;
  z-index: 0;
}
.map-page-body > * { width: 100%; height: 100%; }
.map-page-wrap > .tp-titlebar { position: relative; z-index: 3; }

/* ===== Loading state — shimmer canvas + accent spinner（mockup Section 20） ===== */
.map-page-loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--color-secondary) 0%, var(--color-tertiary) 50%, var(--color-secondary) 100%);
  background-size: 200% 200%;
  animation: shimmer 2s ease-in-out infinite;
  z-index: 4;
}
.map-page-loading-stack {
  display: flex; flex-direction: column;
  align-items: center; gap: 12px;
}
.map-page-loading-spinner {
  width: 32px; height: 32px;
  border: 2.5px solid color-mix(in srgb, var(--color-accent) 20%, transparent);
  border-top-color: var(--color-accent);
  border-radius: var(--radius-full);
  animation: tp-spin 800ms linear infinite;
}
.map-page-loading-text {
  font-size: var(--font-size-footnote);
  font-weight: 600;
  color: var(--color-muted);
  margin: 0;
}

/* ===== Empty state — glass card（mockup Section 20） ===== */
.map-page-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 4;
}
.map-page-empty-card {
  text-align: center;
  padding: 24px 28px;
  background: var(--color-glass-nav);
  backdrop-filter: blur(var(--blur-glass, 14px));
  -webkit-backdrop-filter: blur(var(--blur-glass, 14px));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  max-width: 280px;
  box-shadow: var(--shadow-md);
}
.map-page-empty-icon {
  width: 32px; height: 32px;
  color: var(--color-muted);
  margin: 0 auto 8px;
  display: grid; place-items: center;
}
.map-page-empty-icon svg { width: 32px; height: 32px; }
.map-page-empty-title {
  font-size: var(--font-size-callout);
  font-weight: 700;
  margin: 0 0 4px;
}
.map-page-empty-text {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  margin: 0;
  line-height: 1.5;
}

/* ===== Map page entry cards centering override =====
 * tp-map-entry-cards 的基礎樣式在 tokens.css；MapPage 額外加 scroll-snap 與
 * 中心 padding（first/last card 能 snap 到 viewport center）。 */
/* rev2 owner 2026-07-19：地圖頁 full-bleed 浮層 —— day tab 浮頂置中、POI 卡浮底。 */
.map-page-wrap > .tp-map-day-tabs {
  position: absolute;
  /* 落在 titlebar 下方（否則被 titlebar 蓋）+ 12px 間距。 */
  top: calc(var(--titlebar-h, 64px) + 12px);
  left: 50%; transform: translateX(-50%);
  margin: 0; /* 覆蓋 timeline 用的 auto margin */
  z-index: 5;
  max-width: calc(100% - 24px);
}
.map-page-cards {
  position: absolute;
  /* v2.56.12：功能頁改全版後（v2.56.9 拿掉 main 的 88px 保留），這層 wrap 延伸到螢幕底，
   * 浮底 POI 卡就掉進底部 tab 的區域重疊 —— 卡片是**可點的互動元件**，被 tab icon 壓住
   * 會點不準（e2e 實證：firstCard.click() 被 nav 攔截）。比照 ChatPage composer，用
   * --nav-overlay-h 讓位（桌機 tab 隱藏 / 操作頁不顯 tab 時該值為 0，不受影響）。 */
  bottom: calc(12px + var(--nav-overlay-h, 0px) + env(safe-area-inset-bottom, 0px));
  left: 0; right: 0;
  z-index: 5;
  /* 無白帶（原 .tp-map-entry-cards 的 background + border-top 在此清掉）。 */
  background: transparent;
  border-top: none;
  /* POI 從左側起排（owner「夠寬靠左」；對齊已批 mockup），溢出時從左捲。 */
  justify-content: flex-start;
  padding: 0 12px;
  -webkit-overflow-scrolling: touch;
}
/* POI 卡改玻璃（浮在地圖上、非白底）：夠不透明 + blur + 邊界 + 陰影，對齊 day tab 玻璃質感。 */
.map-page-cards .tp-map-entry-card {
  background: color-mix(in srgb, var(--color-background) 88%, transparent);
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border: 1px solid color-mix(in srgb, var(--color-foreground) 10%, transparent);
  box-shadow: 0 8px 24px rgba(42, 31, 24, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.5);
}
.map-page-card-empty {
  flex: 0 0 auto;
  padding: 10px 12px;
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
}

@media (max-width: 760px) {
  .map-page-cards .tp-map-entry-card { flex: 0 0 200px; }
}

/* Google POI 卡插槽 — 同一插槽（.map-page-cards 的定位）但非橫向捲動 strip，
 * 单張卡片撐開寬度即可（GooglePoiCard 自帶玻璃樣式）。
 *
 * owner 2026-07-22：「地圖單獨模式選 Google POI 開啟的顯示區域要置中」。
 * 外層 .map-page-cards 是 absolute + left:0/right:0 撐滿欄寬，這張是單張 block
 * 卡、又有 max-width:420px，沒有 auto margin 就會貼左。旁邊那排行程 POI 卡是
 * 刻意靠左的橫向 strip（owner 先前「夠寬靠左」），不受影響 —— 只有這個單卡插槽置中。 */
.map-page-google-poi-slot {
  display: block;
  max-width: 420px;
  margin-inline: auto;
}

`;

/**
 * inferKind — 從 pin.title 推 entry kind（heuristic）。
 * MapPin 沒 kind metadata，這個是過渡方案；待 entries schema 加 kind 欄位後可移除。
 * Hotel pin 直接走 type === 'hotel'。
 */
function inferKind(pin: { type: string; title: string }): EntryKind {
  if (pin.type === 'hotel') return 'hotel';
  const t = pin.title;
  if (/食堂|餐廳|餐|食|麵|拉麵|烏龍|壽司|sushi|ramen|cafe|coffee|restaurant|noodle|燒|定食|烤|料理|燒肉|烤肉/i.test(t)) return 'food';
  if (/購物|商店|outlet|百貨|超市|mart|store|商場|藥妝|免稅|drug|drugstore|店|shop/i.test(t)) return 'shopping';
  return 'sight';
}

/* ===== Helpers ===== */

interface DayTab {
  dayNum: number;
  date: string | null;
  label: string | null;
}

interface TripSummary {
  tripId: string;
  name?: string;
  title?: string | null;
  countries?: string | null;
}

/* ===== Component ===== */

export default function MapPage() {
  const { tripId, entryId: entryIdStr } = useParams<{ tripId: string; entryId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { trip, allDays, loading } = useTripContext();

  /* trip 切換：清單餵給 <TripTitleSwitcher/>（標題即切換器，owner 2026-07-21）。
   * 開合與 outside-click 由該元件自理，本頁不再持有 menu state。
   * pickTrip → navigate /trip/:newId/map（整頁切換 trip context）。 */
  const [trips, setTrips] = useState<TripSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 2026-07-21：改為單抓 /my-trips。原本是雙抓 —— /my-trips 只拿「我有權限
        // 的 id 集合」，name/title/countries 這些**要顯示的資料**卻來自
        // /trips?all=1。而 all=1 需要 ops:trips:read service-token scope，
        // 一般使用者拿不到，會靜默降級成只回 published 行程；既有行程改為不公開
        // 後名稱就全沒了，畫面只剩 tripId（owner 2026-07-21 回報）。
        // /my-trips 本身就帶 name/title/countries/totalDays/startDate/endDate，
        // 第二支 API 從一開始就是多餘的。
        const myTrips = await apiFetch<TripSummary[]>('/my-trips');
        if (!cancelled) setTrips(myTrips);
      } catch {
        /* silent — trip-picker only enhancement,fetch fail 隱藏 picker 即可 */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const pickTrip = useCallback((newTripId: string) => {
    if (newTripId === tripId) return;
    navigate(`/trip/${encodeURIComponent(newTripId)}/map`);
  }, [tripId, navigate]);

  const urlEntryId = entryIdStr ? Number(entryIdStr) : null;

  /* --- Day list --- */
  const dayTabs: DayTab[] = useMemo(() => {
    if (!allDays) return [];
    return Object.keys(allDays)
      .map((n) => Number(n))
      .sort((a, b) => a - b)
      .map((dayNum) => {
        const d = allDays[dayNum]!;
        return { dayNum, date: d.date ?? null, label: d.label ?? null };
      });
  }, [allDays]);

  /* --- Initial active tab: 'overview' | number --- */
  // URL 解析順序：entry 存在 → 對應 day；?day=N → N；?day=all → 'overview'；
  // 否則 'overview'（user 拍板：地圖預設全覽，先看整趟再縮特定 day）
  const initialTab: 'overview' | number = useMemo(() => {
    if (!allDays) return 'overview';
    if (urlEntryId != null) {
      const ctx = findEntryInDays(allDays, urlEntryId);
      if (ctx) return ctx.dayNum;
    }
    const q = searchParams.get('day');
    if (q === 'all') return 'overview';
    if (q) {
      const n = Number(q);
      if (Number.isFinite(n) && allDays[n]) return n;
    }
    return 'overview';
  }, [allDays, urlEntryId, searchParams]);

  const [activeTab, setActiveTab] = useState<'overview' | number>(initialTab);
  const isOverview = activeTab === 'overview';

  // Section 4.10：MapFabs 需要 google.maps.Map instance；TpMap 透過 onMapReady prop
  // 在 mount 時 surface ref，unmount 時 reset 為 null。
  const [googleMap, setGoogleMap] = useState<google.maps.Map | null>(null);

  // Keep activeTab synced with URL on first load
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  /* --- Pins: overview vs single day --- */
  const overviewData = useMemo(() => {
    return isOverview ? extractPinsFromAllDays(allDays) : null;
  }, [isOverview, allDays]);

  const currentDay = !isOverview && typeof activeTab === 'number' ? allDays?.[activeTab] : undefined;
  const singleDayPins = useMemo(() => {
    if (!currentDay) return [];
    return extractPinsFromDay(currentDay).pins;
  }, [currentDay]);

  // Flat pins passed to TpMap (overview aggregates all days)
  const mapPins: MapPin[] = useMemo(() => {
    if (isOverview && overviewData) return overviewData.pins;
    return singleDayPins;
  }, [isOverview, overviewData, singleDayPins]);

  // Entry pins for card list — mockup 規格：含 hotel（D1·1 Super Hotel 也在 cards）。
  // overview 模式聚合所有日；single day 模式只該日。
  const cardEntryPins = useMemo(() => {
    if (isOverview && overviewData) return overviewData.pins;
    return singleDayPins;
  }, [isOverview, overviewData, singleDayPins]);

  // Entry id → dayNum map (used for overview card's day prefix)
  const entryDayMap = useMemo(() => {
    const m = new Map<number, number>();
    if (overviewData) {
      overviewData.pinsByDay.forEach((pins, dayNum) => {
        pins.forEach((p) => m.set(p.id, dayNum));
      });
    }
    return m;
  }, [overviewData]);

  const [activeEntryId, setActiveEntryId] = useState<number | null>(urlEntryId);

  // owner 2026-07-21「地圖點選 Google POI」：Google 原生 POI 圖示（非我們自己的
  // 行程 pin）被點擊時顯示的底部卡片（對齊 Flutter TripMapScreen 的
  // _selectedGooglePoi）。與行程 entry 卡互斥 — 選了行程 stop 就清掉、點地圖
  // 空白處也清掉。
  const [selectedGooglePoi, setSelectedGooglePoi] = useState<GooglePoiClick | null>(null);
  const clearSelectedGooglePoi = useCallback(() => setSelectedGooglePoi(null), []);

  // When tab changes (or first load), default active entry to URL entry or first card.
  // Overview mode without explicit entryId: leave unfocused so TpMap falls back to
  // fitBounds (shows whole trip) instead of flyTo on first pin.
  useEffect(() => {
    if (urlEntryId != null && cardEntryPins.some((p) => p.id === urlEntryId)) {
      setActiveEntryId(urlEntryId);
      return;
    }
    setActiveEntryId(isOverview ? null : (cardEntryPins[0]?.id ?? null));
  }, [activeTab, urlEntryId, cardEntryPins, isOverview]);

  /* --- Switch tab --- */
  const handleTabClick = useCallback((tab: 'overview' | number) => {
    setActiveTab(tab);
    const dayParam = tab === 'overview' ? 'all' : String(tab);
    // Strip entry segment when switching tab via URL
    if (urlEntryId != null) {
      navigate(`/trip/${tripId}/map?day=${dayParam}`);
    } else {
      const next = new URLSearchParams(searchParams);
      next.set('day', dayParam);
      setSearchParams(next, { replace: true });
    }
  }, [tripId, navigate, searchParams, setSearchParams, urlEntryId]);

  /* --- Day strip：active tab 置中 + ArrowLeft/Right roving（與 DayNav 共用 hook，W9）。
   * key 序列＝'overview' + 各 dayNum；activeTab 本身就是 'overview' | number。 --- */
  const dayStripKeys = useMemo<('overview' | number)[]>(
    () => ['overview', ...dayTabs.map((t) => t.dayNum)],
    [dayTabs],
  );
  const { navRef: dayTabsRef, handleKeyDown: onDayTabsKeyDown } = useDayStripNav<'overview' | number>({
    keys: dayStripKeys,
    activeKey: activeTab,
    onPick: handleTabClick,
    testId: (k) => (k === 'overview' ? 'map-day-overview' : `map-day-${k}`),
  });

  /* --- Card scroll → active entry (IntersectionObserver) --- */
  const cardsRef = useRef<HTMLDivElement | null>(null);
  const scrollingProgrammatically = useRef(false);

  useEffect(() => {
    const container = cardsRef.current;
    if (!container) return;
    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-card-entry-id]'));
    if (cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingProgrammatically.current) return;
        // Pick the most-visible card (threshold ≥ 0.6 means pretty centred)
        const mostVisible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio > 0.5)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (mostVisible) {
          const id = Number((mostVisible.target as HTMLElement).dataset.cardEntryId);
          if (Number.isFinite(id)) {
            setActiveEntryId((prev) => (prev === id ? prev : id));
          }
        }
      },
      { root: container, threshold: [0.5, 0.7, 0.9] },
    );

    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
    // selectedGooglePoi 納入 deps：顯示 GooglePoiCard 時 entry-cards 容器（ref={cardsRef}）
    // 被三元換掉、關閉後是全新 DOM 節點；沒有這個 dep，observer 不重建仍觀察舊的脫離節點，
    // 卡片捲動 → active entry / day tab 同步（scroll-spy）在 POI 卡開關一輪後失效。
  }, [cardEntryPins, activeTab, selectedGooglePoi]);

  /* --- Card click → scroll into view + set active + sync day nav (v2.31.81 #1) --- */
  const handleCardClick = useCallback((entryId: number) => {
    setActiveEntryId((prev) => (prev === entryId ? prev : entryId));
    // 選行程自己的 stop 時，若正顯示 Google POI 卡則清掉（對齊 Flutter _selectStop
    // 同時清 _selectedGooglePoi 的行為 — 兩種底部卡互斥）。
    setSelectedGooglePoi(null);
    // v2.31.81 #1：overview 模式 user 點 map pin 時，day nav 沒切到該 entry 的
    // 那一天 — 用 entryDayMap 反查 dayNum，call handleTabClick 同步。
    if (isOverview) {
      const targetDay = entryDayMap.get(entryId);
      if (typeof targetDay === 'number') {
        handleTabClick(targetDay);
      }
    }
    const el = cardsRef.current?.querySelector<HTMLElement>(`[data-card-entry-id="${entryId}"]`);
    if (!el) return;
    scrollingProgrammatically.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    setTimeout(() => { scrollingProgrammatically.current = false; }, 400);
  }, [isOverview, entryDayMap, handleTabClick]);

  /* --- On tab change / initial mount: scroll active card into centre BEFORE IO stabilises --- */
  useEffect(() => {
    if (cardEntryPins.length === 0) return;
    const targetId = activeEntryId ?? cardEntryPins[0]!.id;
    const el = cardsRef.current?.querySelector<HTMLElement>(`[data-card-entry-id="${targetId}"]`);
    if (!el || !cardsRef.current) return;
    scrollingProgrammatically.current = true;
    el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
    const t = setTimeout(() => { scrollingProgrammatically.current = false; }, 300);
    return () => clearTimeout(t);
    // selectedGooglePoi 納入 deps：同上，POI 卡關閉後 entry-cards 重新掛載，需重跑一次
    // 把 active 卡捲回中央（新節點的 cardsRef 才對得上）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, cardEntryPins.length, selectedGooglePoi]);

  // MapPage 是 /trip/:id/map(從行程詳情下鑽的 trip-scoped 地圖)→ 顯 back 回行程詳情
  // 是 HIG drill-down 語意(見下方 TitleBar back)。〔2026-04-29 v2.17.14「地圖不需要回前頁」
  // 是 pre-rev2 的 root-map IA 決定,已被 rev2 取代:root 地圖=GlobalMapPage(無 back);
  // 此頁是 trip 內下鑽,需要 back。〕

  const { user } = useCurrentUser();

  const main = (
    <div className="map-page-wrap">
      <style>{SCOPED_STYLES}</style>

      <TitleBar
        // v2.31.81：title bar 對齊 ChatPage 格式 — 左 trip name，右 icon-only picker。
        title={
          <TripTitleSwitcher
            label={trip?.title || trip?.name || '地圖'}
            trips={trips ?? []}
            activeTripId={tripId ?? null}
            onPick={pickTrip}
            testIdPrefix="map"
          />
        }
        back={tripId ? () => navigate(`/trip/${encodeURIComponent(tripId)}`) : undefined}
        account={<AccountCircle />}
      />

      <main className="map-page-body">
        {loading ? (
          <div className="map-page-loading" role="status" aria-busy="true" aria-live="polite">
            <div className="map-page-loading-stack">
              <div className="map-page-loading-spinner" aria-hidden="true" />
              <p className="map-page-loading-text">地圖載入中…</p>
            </div>
          </div>
        ) : mapPins.length === 0 ? (
          <div className="map-page-empty">
            <div className="map-page-empty-card">
              <span className="map-page-empty-icon" aria-hidden="true">
                <Icon name="map" />
              </span>
              <p className="map-page-empty-title">{isOverview ? '這趟行程尚無景點' : '此日尚無景點'}</p>
              <p className="map-page-empty-text">切換其他日期、或回到行程加入景點。</p>
            </div>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="map-page-loading" role="status" aria-busy="true" aria-live="polite">
                <div className="map-page-loading-stack">
                  <div className="map-page-loading-spinner" aria-hidden="true" />
                  <p className="map-page-loading-text">地圖載入中…</p>
                </div>
              </div>
            }
          >
            <TpMap
              pins={mapPins}
              mode="overview"
              focusId={activeEntryId ?? undefined}
              routes={true}
              fillParent={true}
              pinsByDay={isOverview ? overviewData?.pinsByDay : undefined}
              dayNum={isOverview ? undefined : (activeTab as number)}
              onMapReady={setGoogleMap}
              onMarkerClick={handleCardClick}
              onPoiClick={setSelectedGooglePoi}
              onMapClick={clearSelectedGooglePoi}
              /* owner ⑦ 補修（2026-07-20 prod QA）：預設 TOP_LEFT 的 Google 縮放鍵被
               * 浮頂 day tab 膠囊蓋住（實測 + 鍵 y67-107 vs 膠囊 y68-112 全覆蓋）。
               * full-bleed 地圖上緣被 day tab、下緣被 POI 卡、右下被 MapFabs 佔用 →
               * 右側垂直中段是唯一乾淨區，改用官方 RIGHT_CENTER（非 hack Google 內部 class）。 */
              zoomControlPosition="RIGHT_CENTER"
            />
          </Suspense>
        )}
        {/* Section 4.10：右下 FAB stack — 圖層切換 + 我的位置 */}
        <MapFabs map={googleMap} />
      </main>

      {dayTabs.length > 1 && (
        <nav
          ref={dayTabsRef}
          className="tp-map-day-tabs"
          aria-label="行程日期"
          onKeyDown={onDayTabsKeyDown}
        >
          {/* 「總覽」tab prepend 於 Day 01 之前 */}
          <MapDayTab
            key="overview"
            dayLabel="總覽"
            isActive={isOverview}
            onClick={() => handleTabClick('overview')}
            testId="map-day-overview"
          />
          {dayTabs.map((t) => (
            <MapDayTab
              key={t.dayNum}
              dayLabel={`DAY ${t.dayNum}`}
              dayColor={dayColor(t.dayNum)}
              isActive={!isOverview && t.dayNum === activeTab}
              onClick={() => handleTabClick(t.dayNum)}
              testId={`map-day-${t.dayNum}`}
            />
          ))}
        </nav>
      )}

      {selectedGooglePoi ? (
        // owner 2026-07-21：點到 Google 原生 POI 圖示 → 同一個底部插槽換成
        // GooglePoiCard（取代行程 POI 卡橫向捲動），對齊 Flutter 的
        // AnimatedSwitcher(tripline-poi-accessory ↔ google-poi-accessory)。
        <div className="map-page-cards map-page-google-poi-slot">
          <GooglePoiCard poi={selectedGooglePoi} onClose={clearSelectedGooglePoi} />
        </div>
      ) : (
        <div className="tp-map-entry-cards map-page-cards" ref={cardsRef} role="list">
          {cardEntryPins.length === 0 ? (
            <div className="map-page-card-empty">
              {isOverview ? '這趟行程尚無景點' : '這天沒有景點'}
            </div>
          ) : (
            cardEntryPins.map((pin) => {
              const isActive = pin.id === activeEntryId;
              // Overview 模式：用 entryDayMap 反查；Single-day 模式：activeTab 即 dayNum
              const pinDay = isOverview ? entryDayMap.get(pin.id) : (activeTab as number);
              const color = pinDay ? dayColor(pinDay) : 'var(--color-muted)';
              return (
                <MapEntryCard
                  key={pin.id}
                  dataEntryId={pin.id}
                  dayLocalIndex={pin.index}
                  dayLabel={isOverview && pinDay ? `D${pinDay}` : undefined}
                  dayColor={color}
                  time={pin.time ?? undefined}
                  title={pin.title || '（無標題）'}
                  kind={inferKind(pin)}
                  isActive={isActive}
                  onClick={() => handleCardClick(pin.id)}
                />
              );
            })
          )}
        </div>
      )}

      {/* Trip title for a11y / fallback */}
      {trip?.title && (
        <span className="sr-only" aria-hidden="true">{trip.title}</span>
      )}
    </div>
  );

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={main}
      bottomNav={<GlobalBottomNav authed={user !== null} />}
    />
  );
}
