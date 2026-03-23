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

  /* --- Hotel pin（顯示在最前，index=0）--- */
  const hotel: Hotel | null = day.hotel;
  if (hotel && isValidCoords(hotel.location)) {
    pins.push({
      id: hotel.id,
      type: 'hotel',
      index: 0,
      title: hotel.name,
      lat: hotel.location.lat,
      lng: hotel.location.lng,
      sortOrder: -1,
    });
  }

  /* --- Entry pins --- */
  const timeline: Entry[] = day.timeline ?? [];
  for (const entry of timeline) {
    if (isValidCoords(entry.location)) {
      entryIndex++;
      pins.push({
        id: entry.id,
        type: 'entry',
        index: entryIndex,
        title: entry.title,
        lat: entry.location.lat,
        lng: entry.location.lng,
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
