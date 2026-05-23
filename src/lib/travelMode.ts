/**
 * Travel mode canonical type + labels + icons.
 *
 * v2.33.28: extracted to dedupe TravelPill / EditEntryPage local maps. Same
 * 3 modes used backend-side (functions/api/trips/[id]/days/_merge.ts) so labels
 * align with trip_segments.mode CHECK constraint.
 *
 * 注意：TravelPill 還處理 legacy raw `entry.travel.type` 值（car/drive/walk/
 * train/bus/...），那些保留在 TravelPill.tsx 自己的 alias map，不放這裡。
 */

export type TravelMode = 'driving' | 'walking' | 'transit';

export const TRAVEL_MODE_LABEL: Record<TravelMode, string> = {
  driving: '開車',
  walking: '步行',
  transit: '大眾運輸',
};

export const TRAVEL_MODE_ICON: Record<TravelMode, string> = {
  driving: 'car',
  walking: 'walking',
  transit: 'bus',
};
