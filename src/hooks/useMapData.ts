/**
 * useMapData — 從 Day 資料提取地圖需要的資訊
 *
 * 過濾有效 lat/lng 的 entries 與 hotel，回傳 MapPin 陣列。
 * 純計算，無副作用，依賴 Day 物件。
 */

import { useMemo } from 'react';
import type { Day, Entry, Hotel } from '../types/trip';

/* ===== Types ===== */

export type MapPinType = 'entry' | 'hotel';

export interface MapPin {
  id: number;
  type: MapPinType;
  index: number;       // 顯示順序 (1-based)，hotel 用 0
  title: string;
  lat: number;
  lng: number;
  time?: string | null;
  googleRating?: number | null;
  travelMin?: number | null;
  travelType?: string | null;
  sortOrder: number;
}

export interface UseMapDataReturn {
  pins: MapPin[];
  /** 缺少座標的 entry 數量 */
  missingCount: number;
  /** 是否有任何可顯示的座標 */
  hasData: boolean;
}

/* ===== 驗證 lat/lng ===== */

/**
 * 驗證 lat/lng 是否為有效數字座標。
 * 回傳 true 時 TypeScript 會將 coords 收窄為 { lat: number; lng: number }。
 */
export function isValidCoords(
  coords: { lat?: unknown; lng?: unknown } | null | undefined,
): coords is { lat: number; lng: number } {
  if (!coords) return false;
  const { lat, lng } = coords;
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat !== 0 &&
    lng !== 0
  );
}

/* ===== 從 Day 提取 pins（純函式，供 useMapData 和 TripMap 共用）===== */

export function extractPinsFromDay(day: Day): { pins: MapPin[]; missingCount: number } {
  const pins: MapPin[] = [];
  let missingCount = 0;
  let entryIndex = 0;

  /* --- 取 location 座標（location 可能是 JSON 字串、物件或陣列，取第一個有效座標）--- */
  const resolveLocation = (loc: unknown): { lat: number; lng: number } | null => {
    if (!loc) return null;
    let parsed = loc;
    if (typeof loc === 'string') {
      try { parsed = JSON.parse(loc); } catch { return null; }
    }
    const target = Array.isArray(parsed) ? parsed[0] : parsed;
    return isValidCoords(target as { lat?: unknown; lng?: unknown }) ? (target as { lat: number; lng: number }) : null;
  };

  /* --- Hotel pin（顯示在最前，index=0）--- */
  const hotel: Hotel | null = day.hotel;
  const hotelCoords = hotel ? resolveLocation(hotel.location) : null;
  if (hotel && hotelCoords) {
    pins.push({
      id: hotel.id,
      type: 'hotel',
      index: 0,
      title: hotel.name,
      lat: hotelCoords.lat,
      lng: hotelCoords.lng,
      sortOrder: -1,
    });
  }

  /* --- Entry pins --- */
  const timeline: Entry[] = day.timeline ?? [];
  for (const entry of timeline) {
    // Phase 2：POI master 優先，fallback entry.location；Phase 3 後只剩 POI
    let coords: { lat: number; lng: number } | null = null;
    if (entry.poi && isValidCoords(entry.poi)) {
      coords = { lat: entry.poi.lat as number, lng: entry.poi.lng as number };
    }
    if (!coords) coords = resolveLocation(entry.location);
    // 餐廳 entry：優先用首選餐廳 (sort_order=0) 的座標
    if (!coords && entry.restaurants.length > 0) {
      const primary = entry.restaurants.find(r => r.sortOrder === 0) || entry.restaurants[0];
      if (primary && isValidCoords(primary)) {
        coords = { lat: primary.lat, lng: primary.lng };
      }
    }
    if (coords) {
      entryIndex++;
      pins.push({
        id: entry.id,
        type: 'entry',
        index: entryIndex,
        title: entry.title,
        lat: coords.lat,
        lng: coords.lng,
        time: entry.time,
        googleRating: entry.googleRating,
        travelMin: entry.travel?.min,
        travelType: entry.travel?.type,
        sortOrder: entry.sortOrder,
      });
    } else {
      missingCount++;
    }
  }

  return { pins, missingCount };
}

/* ===== 從全行程 days 提取 pins + pinsByDay（overview mode 用） ===== */

export interface ExtractAllDaysResult {
  /** Flat pins 陣列（所有 days 合併） */
  pins: MapPin[];
  /** pins 依 dayNum grouping — 用於 polyline 分天著色 */
  pinsByDay: Map<number, MapPin[]>;
  /** 缺少座標的 entry 總數 */
  missingCount: number;
}

/**
 * 從全行程 days 物件提取所有 pins + dayNum → pins 對應表。
 *
 * 用於：
 * - MapPage overview mode（多天多色 polyline）
 * - TripMapRail 桌機 sticky map（全行程 pins）
 *
 * 回傳 pinsByDay 以 dayNum 為 key，用於 OceanMap / TripMapRail 依天著色 polyline。
 */
export function extractPinsFromAllDays(
  allDays: Record<number, Day> | null | undefined,
): ExtractAllDaysResult {
  if (!allDays) {
    return { pins: [], pinsByDay: new Map(), missingCount: 0 };
  }

  const pins: MapPin[] = [];
  const pinsByDay = new Map<number, MapPin[]>();
  let missingCount = 0;

  const dayNums = Object.keys(allDays).map(Number).sort((a, b) => a - b);
  for (const dayNum of dayNums) {
    const day = allDays[dayNum];
    if (!day) continue;
    const { pins: dayPins, missingCount: dayMissing } = extractPinsFromDay(day);
    if (dayPins.length > 0) {
      pinsByDay.set(dayNum, dayPins);
      pins.push(...dayPins);
    }
    missingCount += dayMissing;
  }

  return { pins, pinsByDay, missingCount };
}

/* ===== Hook ===== */

export function useMapData(day: Day | null | undefined): UseMapDataReturn {
  return useMemo(() => {
    if (!day) {
      return { pins: [], missingCount: 0, hasData: false };
    }

    const { pins, missingCount } = extractPinsFromDay(day);
    return {
      pins,
      missingCount,
      hasData: pins.length > 0,
    };
  }, [day]);
}
