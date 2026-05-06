/**
 * Haversine 大圓距離（公尺）
 *
 * 純數學 function，0 API call。recompute-travel 用來在叫 Google Routes 之前
 * 預先 gate：≤1km → 標記 walking + 叫 WALK；>1km → 標記 driving + 叫 DRIVE。
 *
 * 平均地球半徑（IUGG mean） 6,371,008.8 m。對 trip-planner 使用情境（同一城市
 * 內 short-medium 距離）誤差 < 0.5%，遠優於需要的精度。
 */

const EARTH_RADIUS_M = 6_371_008.8;

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const phi1 = (a.lat * Math.PI) / 180;
  const phi2 = (b.lat * Math.PI) / 180;
  const dPhi = ((b.lat - a.lat) * Math.PI) / 180;
  const dLambda = ((b.lng - a.lng) * Math.PI) / 180;

  const x =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

  return EARTH_RADIUS_M * c;
}
