/**
 * TravelPill — Section 4.6 (terracotta-ui-parity-polish)
 *
 * 顯示兩 entry 之間的移動方式 + 時間 + 描述。對應 mockup section 13。
 * Layout: 圓形 icon (依 type) · N min · 描述 (optional)
 *
 * Travel data 來自 entry.travel = { type, desc, min }，semantic 上是「從上一個
 * entry 到本 entry」的 leg。所以本 component 渲染在 RailRow N 與 N+1 中間，
 * 但取的是 entry N+1 的 travel data。
 */
import Icon from '../shared/Icon';

const SCOPED_STYLES = `
.tp-travel-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 5px 14px;
  margin: 6px 0 6px 110px;
  border-radius: var(--radius-full);
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
  width: fit-content;
  font-variant-numeric: tabular-nums;
}
.tp-travel-pill-icon {
  color: var(--color-accent);
  display: inline-flex; align-items: center;
  flex-shrink: 0;
}
.tp-travel-pill-icon .svg-icon { width: 14px; height: 14px; }
.tp-travel-pill-meta {
  display: inline-flex; align-items: baseline; gap: 6px;
  white-space: nowrap;
}
.tp-travel-pill-min { font-weight: 700; color: var(--color-foreground); }
.tp-travel-pill-sep { color: var(--color-muted); opacity: 0.5; }
.tp-travel-pill-desc {
  color: var(--color-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 240px;
}
@media (max-width: 760px) {
  .tp-travel-pill {
    margin-left: 92px;
    padding: 4px 12px;
    gap: 8px;
    font-size: var(--font-size-caption);
  }
  .tp-travel-pill-desc { max-width: 150px; }
}
`;

const TYPE_ICON_MAP: Record<string, string> = {
  car: 'car',
  drive: 'car',
  driving: 'car',
  walk: 'walking',
  walking: 'walking',
  train: 'train',
  metro: 'train',
  subway: 'train',
  bus: 'bus',
  ferry: 'plane',
  flight: 'plane',
  plane: 'plane',
};

export interface TravelPillProps {
  type?: string | null;
  desc?: string | null;
  min?: number | null;
}

export default function TravelPill({ type, desc, min }: TravelPillProps) {
  const hasMin = typeof min === 'number' && min > 0;
  const hasDesc = typeof desc === 'string' && desc.trim().length > 0;
  if (!hasMin && !hasDesc) return null;
  const iconName = TYPE_ICON_MAP[(type ?? '').toLowerCase()] ?? 'car';
  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div className="tp-travel-pill" role="presentation" data-testid="travel-pill">
        <span className="tp-travel-pill-icon" aria-hidden="true">
          <Icon name={iconName} />
        </span>
        <span className="tp-travel-pill-meta">
          {hasMin && <span className="tp-travel-pill-min">{min} min</span>}
          {hasMin && hasDesc && <span className="tp-travel-pill-sep">·</span>}
          {hasDesc && <span className="tp-travel-pill-desc">{desc}</span>}
        </span>
      </div>
    </>
  );
}
