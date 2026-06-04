import { useState } from 'react';
import Icon from '../shared/Icon';
import { CategoryPicker, CATEGORY_ICON } from './CategoryPicker';
import { POI_TYPE_LABELS, type PoiType } from '../../lib/poiCategory';

export type EditableCategoryChipProps = {
  value: PoiType;
  onChange: (next: PoiType) => void;
  /** auto-derived default — forwarded to the picker's dot indicator */
  autoValue?: PoiType | null;
  disabled?: boolean;
  testIdPrefix?: string;
  /**
   * 在 fixed/sticky bottom bar 等「下方無空間」處使用時設 true，picker 改向上彈出
   * （absolute 定位，不被 viewport 底切掉）。預設 false（沿用 in-flow 向下展開）。
   */
  dropUp?: boolean;
};

const SCOPED_STYLES = `
.tp-cat-chip-wrap { position: relative; display: inline-block; }
.tp-cat-chip {
  display: inline-flex; align-items: center; gap: 5px;
  min-height: 28px; padding: 3px 9px 3px 8px;
  border: 0; border-radius: var(--radius-full);
  background: var(--color-tertiary); color: var(--color-foreground);
  font: inherit; font-size: var(--font-size-caption); font-weight: 600;
  cursor: pointer; transition: background 150ms, color 150ms, box-shadow 150ms;
}
.tp-cat-chip:hover:not(:disabled) { background: var(--color-accent-bg); }
.tp-cat-chip:disabled { opacity: 0.6; cursor: default; }
.tp-cat-chip.is-open {
  background: var(--color-accent-subtle); color: var(--color-accent-deep);
  box-shadow: inset 0 0 0 1.5px var(--color-accent);
}
.tp-cat-chip:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--color-accent); }
.tp-cat-chip .svg-icon { width: 14px; height: 14px; }
.tp-cat-chip .tp-cat-chip-pencil { width: 11px; height: 11px; color: var(--color-muted); }
.tp-cat-chip.is-open .tp-cat-chip-pencil { color: var(--color-accent-deep); }
.tp-cat-chip-pop {
  margin-top: 8px; background: var(--color-secondary);
  border-radius: var(--radius-md); padding: 10px;
}
/* dropUp：在 bottom bar 等下方無空間處，picker 改 absolute 向上彈出，避免被 viewport 底切掉。
   width:max-content + min-width 讓 4×2 grid 撐開，max-width 防小螢幕橫向溢出。 */
.tp-cat-chip-pop.is-up {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  margin-top: 0;
  z-index: 60;
  width: max-content;
  min-width: 264px;
  max-width: calc(100vw - 32px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
}
`;

/**
 * EditableCategoryChip — a tappable category chip (icon + label + ✎ pencil) that expands
 * the signed-off CategoryPicker inline. Presentational only: it calls `onChange(next)` and
 * the parent decides the side effect (PATCH for an existing POI, local state for an add).
 */
export function EditableCategoryChip({
  value,
  onChange,
  autoValue,
  disabled = false,
  testIdPrefix = 'category-chip',
  dropUp = false,
}: EditableCategoryChipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className="tp-cat-chip-wrap">
      <style>{SCOPED_STYLES}</style>
      <button
        type="button"
        className={`tp-cat-chip${open ? ' is-open' : ''}`}
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
        disabled={disabled}
        aria-expanded={open}
        aria-label={`分類：${POI_TYPE_LABELS[value]}，點擊更改`}
        data-testid={`${testIdPrefix}-toggle`}
      >
        <Icon name={CATEGORY_ICON[value]} />
        <span>{POI_TYPE_LABELS[value]}</span>
        <span className="tp-cat-chip-pencil">
          <Icon name="edit" />
        </span>
      </button>
      {open && (
        <div className={`tp-cat-chip-pop${dropUp ? ' is-up' : ''}`} data-testid={`${testIdPrefix}-pop`}>
          <CategoryPicker
            value={value}
            autoValue={autoValue}
            testIdPrefix={`${testIdPrefix}-picker`}
            onChange={(next) => {
              setOpen(false);
              if (next !== value) onChange(next);
            }}
          />
        </div>
      )}
    </span>
  );
}
