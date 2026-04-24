/**
 * GlobalMapPage — B-P2 §6.2 placeholder
 *
 * /map 路由 — 全域 cross-trip 地圖（跟 /trip/:tripId/map 不同，後者是 per-trip 的 MapPage）。
 * view-only：顯示所有 trips 的 polyline + POI marker。未來實作對齊 Mindtrip layout reference。
 * 視覺對應：docs/design-sessions/mockup-map-v2.html
 */
import { Link } from 'react-router-dom';

export default function GlobalMapPage() {
  return (
    <div className="tp-placeholder" data-testid="global-map-page">
      <style>{`
        .tp-placeholder {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 60vh; padding: 48px 24px; text-align: center;
          color: var(--color-foreground);
        }
        .tp-placeholder .ph-eyebrow {
          font-size: var(--font-size-eyebrow); font-weight: 700;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: var(--color-muted); margin-bottom: 12px;
        }
        .tp-placeholder h1 {
          font-size: var(--font-size-title); font-weight: 800;
          letter-spacing: -0.02em; margin-bottom: 12px;
        }
        .tp-placeholder .ph-sub {
          font-size: var(--font-size-callout); color: var(--color-muted);
          max-width: 480px; margin-bottom: 28px;
        }
        .tp-placeholder .ph-cta {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 12px 20px; border-radius: var(--radius-full);
          background: var(--color-accent); color: var(--color-accent-foreground);
          text-decoration: none;
          font: inherit; font-size: 14px; font-weight: 600;
          min-height: var(--spacing-tap-min);
        }
        .tp-placeholder .ph-cta:hover { filter: brightness(0.92); }
      `}</style>
      <div className="ph-eyebrow">Coming soon · Phase 3</div>
      <h1>所有行程地圖</h1>
      <p className="ph-sub">跨 trip 的全域地圖 view — 看你所有 trips 的 polyline + POI 分布。跟單一 trip 的地圖（/trip/:id/map）不同。</p>
      <Link to="/manage" className="ph-cta">前往行程管理</Link>
    </div>
  );
}
