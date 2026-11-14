/**
 * useDocumentTitle — 全站唯一設定瀏覽器分頁標題的地方（#1696）。
 * 格式「頁名 · 行程名 — Tripline」；首頁只寫「Tripline」。
 * 行程名：/trip/:id 與 /trips?selected=X 取該行程，其餘有行程脈絡的頁（聊天、地圖）取 active trip；
 * 清單查不到（例如分享頁）就省略行程名。
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCurrentUser } from './useCurrentUser';
import { useTripSelection } from './useMyTrips';

const APP = 'Tripline';

/** 依序比對，第一個命中者為頁名；`trip` 表示標題要帶行程名。 */
const PAGES: ReadonlyArray<[RegExp, string, boolean]> = [
  [/^\/chat/, '聊天', true],
  [/^\/map\/?$/, '地圖', true],
  [/^\/trip\/[^/]+\/(?:stop\/[^/]+\/)?map\/?$/, '地圖', true],
  [/^\/trip\/[^/]+\/stop\/[^/]+\/copy/, '複製景點', true],
  [/^\/trip\/[^/]+\/stop\/[^/]+\/move/, '移動景點', true],
  [/^\/trip\/[^/]+\/stop\/[^/]+\/change-poi/, '更換景點', true],
  [/^\/trip\/[^/]+\/stop\/[^/]+\/edit/, '編輯景點', true],
  [/^\/trip\/[^/]+\/edit/, '編輯行程', true],
  [/^\/trip\/[^/]+\/add-stop/, '加入景點', true],
  [/^\/trip\/[^/]+\/add-entry/, '新增景點', true],
  [/^\/trip\/[^/]+\/add-custom-stop/, '自訂景點', true],
  [/^\/trip\/[^/]+\/collab/, '共編', true],
  [/^\/trip\/[^/]+\/health/, '行程健檢', true],
  [/^\/trip\/[^/]+\/notes/, '筆記', true],
  [/^\/trip\/[^/]+\/print/, '列印', true],
  [/^\/trip\/[^/]+/, '行程', true],
  [/^\/trips\/new/, '新增行程', false],
  [/^\/trips/, '行程', false],
  [/^\/(?:favorites|add-to-trip)/, '收藏', false],
  [/^\/explore/, '探索', false],
  [/^\/(?:account|settings)/, '帳號', false],
  [/^\/(?:login|auth\/password)/, '登入', false],
  [/^\/signup|^\/auth\/verify-email/, '註冊', false],
  [/^\/privacy/, '隱私權', false],
  [/^\/developer/, '開發者應用程式', false],
  [/^\/oauth/, '授權', false],
  [/^\/invite/, '邀請', false],
  [/^\/s\//, '分享行程', false],
];

/** 路徑 → [頁名, 是否帶行程名]；沒有對應回 null（標題退回 Tripline）。 */
export function resolvePage(pathname: string): [string, boolean] | null {
  const hit = PAGES.find(([re]) => re.test(pathname));
  return hit ? [hit[1], hit[2]] : null;
}

export function useDocumentTitle() {
  const { pathname, search } = useLocation();
  const { user } = useCurrentUser();
  const { trips, activeTripId } = useTripSelection(user?.id, { fallback: false });
  const urlTripId = pathname.match(/^\/trip\/([^/]+)/)?.[1];
  // 桌機行程詳情是 /trips?selected=X（沒有 :tripId 路徑段）
  const selectedTripId = pathname.startsWith('/trips') ? new URLSearchParams(search).get('selected') : null;
  const tripId = urlTripId ?? selectedTripId ?? activeTripId;
  const found = trips?.find((t) => t.tripId === tripId);
  const tripName = found ? (found.title || found.name) : '';

  useEffect(() => {
    const hit = resolvePage(pathname);
    if (!hit) { document.title = APP; return; }
    const [label, withTrip] = hit;
    document.title = `${label}${(withTrip || selectedTripId) && tripName ? ` · ${tripName}` : ''} — ${APP}`;
  }, [pathname, tripName, selectedTripId]);
}
