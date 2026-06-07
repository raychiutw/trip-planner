import Icon from '../shared/Icon';
import { POI_TYPE_LABELS, type PoiType } from '../../lib/poiCategory';
import { poiTypeToTone } from '../../lib/timelineUtils';

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

/** poi_type → Icon name, aligned with timelineUtils.deriveTypeMeta. Exported for reuse
 *  by EditableCategoryChip so the chip icon matches the picker tile icon. */
export const CATEGORY_ICON: Record<PoiType, string> = {
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
  /* 欄數交給容器寬度決定（RWD）：寬版面（自訂表單 ~672px、桌機編輯卡片 ~532px）一行排滿
     8 個分類，窄手機自動 reflow 成 4-5 欄。取代原本寫死的 repeat(4) — 桌機會把 4 欄各撐到
     ~160px，icon 周圍大量留白而顯鬆散。tile 最小 54px 讓編輯卡片寬度也容得下一整排 8 個。 */
  grid-template-columns: repeat(auto-fit, minmax(54px, 1fr));
  gap: 8px;
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
/* 三色：每個分類 tile 帶 data-tone，選中時 highlight 用該分類的 tone（picker = 色彩 legend）*/
.tp-category-tile[data-tone="accent"]  { --tone: var(--color-accent); --tone-deep: var(--color-accent-deep); --tone-subtle: var(--color-accent-subtle); }
.tp-category-tile[data-tone="sage"]    { --tone: var(--color-accent-2); --tone-deep: var(--color-accent-2-deep); --tone-subtle: var(--color-accent-2-subtle); }
.tp-category-tile[data-tone="pink"]    { --tone: var(--color-accent-3); --tone-deep: var(--color-accent-3-deep); --tone-subtle: var(--color-accent-3-subtle); }
/* neutral（other）顯式回 accent 柔褐 — 不靠「無規則→var() fallback」，否則若 tile 被包進
   有設 --tone-* 的祖先（lightbox / rail-item）會繼承到祖先 tone 而非預期的 accent。*/
.tp-category-tile[data-tone="neutral"] { --tone: var(--color-accent); --tone-deep: var(--color-accent-deep); --tone-subtle: var(--color-accent-subtle); }
.tp-category-tile.is-active {
  background: var(--tone-subtle, var(--color-accent-subtle)); color: var(--tone-deep, var(--color-accent-deep));
  box-shadow: inset 0 0 0 1.5px var(--tone, var(--color-accent));
}
/* focus 用 outline（獨立視覺層），不用 inset box-shadow — 否則會蓋掉 is-active 的 tone 選中框，
   鍵盤 tab 到已選的餐廳/住宿 tile 時粉/sage 框會被換成 accent。outline 與選中框正交，兩者並存。*/
.tp-category-tile:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
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
            data-tone={poiTypeToTone(type)}
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
