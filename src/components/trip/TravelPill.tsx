/**
 * TravelPill — Section 4.6 (terracotta-ui-parity-polish)
 *
 * 顯示兩 entry 之間的移動方式 + 時間 + 描述。對應 mockup section 13。
 * Layout: 圓形 icon (依 type) · N 分 · 描述 (optional)
 *
 * Travel data 來自 entry.travel = { type, desc, min }，semantic 上是「從上一個
 * entry 到本 entry」的 leg。所以本 component 渲染在 RailRow N 與 N+1 中間，
 * 但取的是 entry N+1 的 travel data。
 */
import Icon from '../shared/Icon';

const SCOPED_STYLES = `
.tp-travel-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 8px 8px;
  margin: 4px 0 4px 28px;
  border-radius: var(--radius-full);
  background: var(--color-secondary);
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
  width: fit-content;
}
.tp-travel-pill-icon {
  width: 24px; height: 24px;
  border-radius: 50%;
  background: var(--color-background);
  color: var(--color-foreground);
  display: grid; place-items: center;
  flex-shrink: 0;
}
.tp-travel-pill-icon .svg-icon { width: 14px; height: 14px; }
.tp-travel-pill-meta {
  display: inline-flex; align-items: baseline; gap: 6px;
  white-space: nowrap;
}
.tp-travel-pill-min { font-weight: 700; color: var(--color-foreground); }
.tp-travel-pill-desc {
  color: var(--color-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 240px;
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
    <div className="tp-travel-pill" role="presentation" data-testid="travel-pill">
      <style>{SCOPED_STYLES}</style>
      <span className="tp-travel-pill-icon" aria-hidden="true">
        <Icon name={iconName} />
      </span>
      <span className="tp-travel-pill-meta">
        {hasMin && <span className="tp-travel-pill-min">{min} 分</span>}
        {hasDesc && <span className="tp-travel-pill-desc">{desc}</span>}
      </span>
    </div>
  );
}
