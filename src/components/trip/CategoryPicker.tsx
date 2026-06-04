import Icon from '../shared/Icon';
import { POI_TYPE_LABELS, type PoiType } from '../../lib/poiCategory';

export type CategoryPickerProps = {
  value: PoiType;
  onChange: (next: PoiType) => void;
  /** auto-derived value — marked with a dot indicator so users see the default */
  autoValue?: PoiType | null;
  testIdPrefix?: string;
  /** id of a visible label to wire as the radiogroup's accessible name. When set,
   *  it replaces the default aria-label so the announced name matches the visible one. */
  ariaLabelledBy?: string;
};

/** Grid order mirrors the signed-off mockup (Variant C, 4×2). */
const CATEGORY_ORDER: readonly PoiType[] = [
  'hotel',
  'restaurant',
  'shopping',
  'parking',
  'transport',
  'activity',
  'attraction',
  'other',
];

/** poi_type → Icon name, aligned with timelineUtils.deriveTypeMeta. */
const CATEGORY_ICON: Record<PoiType, string> = {
  hotel: 'hotel',
  restaurant: 'utensils',
  shopping: 'shopping',
  parking: 'parking',
  transport: 'car',
  activity: 'sparkle',
  attraction: 'location-pin',
  other: 'circle-dot',
};

const SCOPED_STYLES = `
.tp-category-picker {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
@media (max-width: 360px) {
  .tp-category-picker { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.tp-category-tile {
  position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  min-height: 64px; padding: 8px 4px;
  border: 0; border-radius: var(--radius-md);
  background: var(--color-secondary); color: var(--color-muted);
  font: inherit; font-size: var(--font-size-caption); font-weight: 600;
  cursor: pointer;
  transition: background 150ms, color 150ms, box-shadow 150ms;
}
.tp-category-tile .svg-icon { width: 22px; height: 22px; }
.tp-category-tile:hover { background: var(--color-hover); color: var(--color-foreground); }
.tp-category-tile.is-active {
  background: var(--color-accent-subtle); color: var(--color-accent-deep);
  box-shadow: inset 0 0 0 1.5px var(--color-accent);
}
.tp-category-tile:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--color-accent); }
/* auto-derived default indicator dot */
.tp-category-tile-auto {
  position: absolute; top: 5px; right: 6px;
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-accent);
}
`;

/**
 * CategoryPicker — 8-category icon grid (Variant C, mockup signed off 2026-06-04).
 * Controlled: parent owns `value`; the auto-derived `autoValue` is flagged with a
 * dot so users can see the default and tap any tile to override before adding.
 */
export function CategoryPicker({
  value,
  onChange,
  autoValue,
  testIdPrefix = 'category-picker',
  ariaLabelledBy,
}: CategoryPickerProps) {
  return (
    <div
      className="tp-category-picker"
      role="radiogroup"
      aria-label={ariaLabelledBy ? undefined : '景點類別'}
      aria-labelledby={ariaLabelledBy}
      data-testid={testIdPrefix}
    >
      <style>{SCOPED_STYLES}</style>
      {CATEGORY_ORDER.map((type) => {
        const active = type === value;
        const isAuto = autoValue != null && type === autoValue;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={POI_TYPE_LABELS[type]}
            className={`tp-category-tile${active ? ' is-active' : ''}`}
            onClick={() => onChange(type)}
            data-testid={`${testIdPrefix}-${type}`}
            data-active={active || undefined}
          >
            {isAuto && <span className="tp-category-tile-auto" aria-hidden="true" />}
            <Icon name={CATEGORY_ICON[type]} />
            <span>{POI_TYPE_LABELS[type]}</span>
          </button>
        );
      })}
    </div>
  );
}
