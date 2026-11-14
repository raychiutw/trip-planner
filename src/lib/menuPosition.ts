/** 浮動選單貼座標時的 clamp：整個選單留在 viewport 內並保留邊距（RailRowMenu、TripCardMenu 共用）。 */
export function clampToViewport(
  x: number, y: number, width: number, height: number, vw: number, vh: number, margin = 8,
): { left: number; top: number } {
  return {
    left: Math.max(margin, Math.min(x, vw - width - margin)),
    top: Math.max(margin, Math.min(y, vh - height - margin)),
  };
}
