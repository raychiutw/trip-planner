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

function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat !== 0 &&
    lng !== 0
  );
}

/* ===== Hook ===== */

export function useMapData(day: Day | null | undefined): UseMapDataReturn {
  return useMemo(() => {
    if (!day) {
      return { pins: [], missingCount: 0, hasData: false };
    }

    const pins: MapPin[] = [];
    let missingCount = 0;
    let entryIndex = 0;

    /* --- Hotel pin（顯示在最前，index=0）--- */
    const hotel: Hotel | null = day.hotel;
    if (hotel) {
      const lat = hotel.location?.lat;
      const lng = hotel.location?.lng;
      if (isValidLatLng(lat, lng)) {
        pins.push({
          id: hotel.id,
          type: 'hotel',
          index: 0,
          title: hotel.name,
          lat,
          lng: hotel.location!.lng as number,
          sortOrder: -1,
        });
      }
    }

    /* --- Entry pins --- */
    const timeline: Entry[] = day.timeline ?? [];
    for (const entry of timeline) {
      const lat = entry.location?.lat;
      const lng = entry.location?.lng;

      if (isValidLatLng(lat, lng)) {
        entryIndex++;
        pins.push({
          id: entry.id,
          type: 'entry',
          index: entryIndex,
          title: entry.title,
          lat,
          lng: entry.location!.lng as number,
          time: entry.time,
          googleRating: entry.googleRating,
          travelMin: entry.travel?.min,
          sortOrder: entry.sortOrder,
        });
      } else {
        missingCount++;
      }
    }

    return {
      pins,
      missingCount,
      hasData: pins.length > 0,
    };
  }, [day]);
}
