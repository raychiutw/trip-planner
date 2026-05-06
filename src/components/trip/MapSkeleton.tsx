/**
 * MapSkeleton — loading skeleton for Google Maps JS API loader window.
 *
 * Google Maps JS bundle ~300-500KB → mobile 載入 2-4s。期間 render MapSkeleton
 * 取代 blank rail flash（autoplan T4 design fix）。沿用 .tp-skel 體系（DESIGN.md
 * L621/661）— shimmer + spinner + 文字。reduced-motion 自動關 animation。
 *
 * Load failure → caller 改 render <PageErrorState>（不在本 component 處理）。
 */
const MapSkeletonStyles = `
.tp-map-skeleton {
  width: 100%; height: 100%;
  min-height: 240px;
  background: var(--color-background-subtle, var(--color-secondary, #F4ECE2));
  display: grid; place-items: center;
  position: relative; overflow: hidden;
}
.tp-map-skeleton::before {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 50%,
    transparent 100%);
  animation: tp-map-skeleton-shimmer 1.6s infinite;
  pointer-events: none;
}
@keyframes tp-map-skeleton-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.tp-map-skeleton-content {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  z-index: 1;
}
.tp-map-skeleton-spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--color-border, #E2D5C2);
  border-top-color: var(--color-accent, #B85F2A);
  border-radius: 50%;
  animation: tp-map-skeleton-spin 0.8s linear infinite;
}
@keyframes tp-map-skeleton-spin { to { transform: rotate(360deg); } }
.tp-map-skeleton-text {
  color: var(--color-muted, #6B5F52);
  font-size: 14px;
}
@media (prefers-reduced-motion: reduce) {
  .tp-map-skeleton::before { animation: none; }
  .tp-map-skeleton-spinner {
    animation: none;
    border-top-color: var(--color-border, #E2D5C2);
  }
}
`;

export interface MapSkeletonProps {
  /** Override default text. Default: "載入地圖中…". */
  text?: string;
  testId?: string;
}

export default function MapSkeleton({
  text = '載入地圖中…',
  testId = 'map-skeleton',
}: MapSkeletonProps) {
  return (
    <>
      <style>{MapSkeletonStyles}</style>
      <div
        className="tp-map-skeleton"
        data-testid={testId}
        role="status"
        aria-live="polite"
        aria-label={text}
      >
        <div className="tp-map-skeleton-content">
          <div className="tp-map-skeleton-spinner" aria-hidden="true" />
          <div className="tp-map-skeleton-text">{text}</div>
        </div>
      </div>
    </>
  );
}
