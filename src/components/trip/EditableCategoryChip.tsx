import { useState, useRef, useLayoutEffect } from 'react';
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
  /**
   * 在 overflow:hidden 或窄卡片容器（如 AddStopPage 搜尋結果卡）使用時設 true：popover 維持
   * 手機式 in-flow 緊湊展開（撐高容器、不被 clip），不套桌機 absolute 寬浮層（≥768px 多欄）。
   * 窄容器（<~400px）放不下寬浮層、且祖先的 overflow:hidden 會把 absolute 浮層裁成碎片，故維持 in-flow。
   */
  compact?: boolean;
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
  /* 預設 .tp-cat-chip-wrap 是 inline-block → popover 會被壓成 min-content 窄條（手機上
     4 格擠成 ~42px、又高又窄）。給舒適寬度：手機填滿可用寬（上限 288px）、小螢幕不橫向溢出，
     讓 4×2 grid 的 tile 撐到舒適大小。 */
  width: max-content;
  min-width: min(288px, calc(100vw - 32px));
  max-width: calc(100vw - 24px);
}
/* dropUp：在 bottom bar 等下方無空間處，picker 改 absolute 向上彈出，避免被 viewport 底切掉。
   bottom-bar 的 chip 偏右（actions 在右、counter 在左把它推右）→ 用 right:0 把 picker 的右緣
   對齊 chip 右緣、向左展開，避免 left:0 + 288px 寬度衝出右邊界（QA 實測溢出 129px）。寬度沿用 base。 */
.tp-cat-chip-pop.is-up {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  margin-top: 0;
  z-index: 60;
  box-shadow: var(--shadow-lg);
}
/* 桌機（≥768px）：非 dropUp 的 popover 改 absolute 浮層向下彈出，並給 definite width，讓
   CategoryPicker 的 auto-fit grid 把 8 個分類一行排開（版面寬度決定欄數）。
   為何用 absolute 而非把 wrap 撐成 block：popover 若靠撐寬 inline-block wrap 來變寬，會把
   chip 旁同列的兄弟元素（例如備選列 .tp-edit-entry-alt-category 裡的星等）擠到下一行。
   absolute 脫離 in-flow，寬度自己定，不影響 chip 與兄弟的排版。手機維持 inline-block
   + max-content/min 288 的 in-flow 緊湊浮層。兩種容器排除桌機浮層：dropUp（fixed bottom bar，
   .is-dropup）保留 .is-up 的 absolute right:0 向上錨點；compact（窄/overflow:hidden 卡片，
   .is-compact）維持 in-flow，否則 absolute 浮層會被祖先 overflow:hidden 裁成碎片。 */
@media (min-width: 768px) {
  .tp-cat-chip-wrap:not(.is-dropup):not(.is-compact) .tp-cat-chip-pop:not(.is-up) {
    position: absolute;
    left: 0;
    top: 100%;
    margin-top: 8px;
    z-index: 60;
    width: min(512px, calc(100vw - 32px));
    box-shadow: var(--shadow-lg);
  }
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
  compact = false,
}: EditableCategoryChipProps) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  // dropUp popover 用 right:0 對齊 chip 右緣，但 chip 在 bottom bar 的水平位置會隨 counter
  // 文案長短在「靠右」與「置中」間漂移（短名 → 三項同列置中、長名 → actions 換行被推右）。
  // 純 CSS 的 left/right 錨點都可能某一側溢出 → 開啟時量測一次、用 transform 夾回 viewport
  // 內（左右各留 8px margin），任意 chip 位置都不切掉。
  useLayoutEffect(() => {
    const el = popRef.current;
    if (!open || !dropUp || !el) return;
    el.style.transform = 'translateX(0px)';
    const r = el.getBoundingClientRect();
    const margin = 8;
    const vw = document.documentElement.clientWidth;
    let dx = 0;
    if (r.right > vw - margin) dx = vw - margin - r.right;
    if (r.left + dx < margin) dx = margin - r.left;
    if (dx !== 0) el.style.transform = `translateX(${Math.round(dx)}px)`;
  }, [open, dropUp]);

  return (
    <span className={`tp-cat-chip-wrap${dropUp ? ' is-dropup' : ''}${compact ? ' is-compact' : ''}`}>
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
        <div ref={popRef} className={`tp-cat-chip-pop${dropUp ? ' is-up' : ''}`} data-testid={`${testIdPrefix}-pop`}>
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
