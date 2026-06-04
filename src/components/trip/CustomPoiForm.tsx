/**
 * CustomPoiForm — v2.31.98 shared 自訂景點 form (title + address typeahead +
 * map pin + hint checkbox).
 *
 * 設計：AddStopPage（建立新 entry）+ ChangePoiPage（替換或加為備選）共用
 * 同一份 form UI/邏輯，避免兩邊 drift。
 *
 * 父層 owns title/coord/hint state（fully controlled），flyToSignal 內部管理
 * （typeahead pick 後 fire flyTo → map idle 觸發 onCoordChange）。
 *
 * Layout：
 *   - 桌機 ≥1024px：left form pane 380px / right map pane 1fr (per mockup C)
 *   - 行動裝置 ≤1023px：stacked single-column
 *   - extraRows prop：父層額外 form 欄位（e.g. AddStopPage 的 time/duration/note）
 */
import { useCallback, useState, type ReactNode } from 'react';
import { LocationPickerMap } from './LocationPickerMap';
import { CategoryPicker } from './CategoryPicker';
import { usePlacesAutocomplete } from '../../hooks/usePlacesAutocomplete';
import { useTypeaheadKeyboard } from '../../hooks/useTypeaheadKeyboard';
import { apiFetchRaw } from '../../lib/apiClient';
import { isValidCoord } from '../../lib/locationPicker';
import type { PoiType } from '../../lib/poiCategory';

export type CustomPoiCoord = { lat: number; lng: number };

type Props = {
  title: string;
  onTitleChange: (v: string) => void;
  coord: CustomPoiCoord | null;
  onCoordChange: (c: CustomPoiCoord | null) => void;
  hintConfirmed: boolean;
  onHintConfirmedChange: (b: boolean) => void;
  initialCenter: CustomPoiCoord;
  /** 地圖縮放等級，預設 14 */
  initialZoom?: number;
  /** Google Places typeahead 區域偏好（'tw' / 'jp'…），forward to autocomplete API */
  regionCode?: string;
  /** form-level 錯誤訊息（顯在 title input 下方） */
  error?: string | null;
  /** 額外 form 列（AddStopPage 用來放 time/duration/note；ChangePoiPage 不傳） */
  extraRows?: ReactNode;
  /** 三選一控制 testid namespace：'add-stop-custom' | 'change-poi-custom' | 'add-custom-stop' */
  testIdPrefix: string;
  /** 類別 picker（自訂 stop 用）— 同時提供 category + onCategoryChange 才會 render。
   *  自訂 stop 無 Google 來源，預設由父層帶（通常 'attraction'），使用者可改。 */
  category?: PoiType;
  onCategoryChange?: (next: PoiType) => void;
};

const SCOPED_STYLES = `
/* LocationPickerMap base styles (component coupling — these used to live in
   AddStopPage SCOPED_STYLES，搬進這裡讓 ChangePoiPage 也能用) */
.tp-custom-picker-wrap {
  position: relative;
  width: 100%;
  height: 280px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
}
.tp-custom-picker-map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.tp-custom-picker-map:focus-visible {
  outline: 3px solid var(--color-accent);
  outline-offset: -3px;
}
.tp-custom-picker-pin {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -100%);
  width: 32px;
  height: 40px;
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(42, 31, 24, 0.25));
  z-index: 5;
}
.tp-custom-picker-pin svg { width: 100%; height: 100%; display: block; }
.tp-custom-picker-coord {
  position: absolute;
  left: 8px;
  top: 8px;
  font-size: var(--font-size-caption2);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-foreground);
  background: rgba(255, 251, 245, 0.92);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  z-index: 6;
}
.tp-custom-picker-error {
  padding: 12px 14px;
  background: var(--color-destructive-bg);
  color: var(--color-destructive);
  border-radius: var(--radius-md);
  font-size: var(--font-size-footnote);
  text-align: center;
}

.tp-custom-poi-form { display: flex; flex-direction: column; gap: 14px; }
.tp-custom-poi-form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.tp-custom-poi-form-row.is-full { grid-template-columns: 1fr; }
.tp-custom-poi-form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.tp-custom-poi-form-field label {
  font-size: var(--font-size-caption);
  font-weight: 700;
  color: var(--color-foreground);
}
.tp-custom-poi-form-field input,
.tp-custom-poi-form-field textarea {
  padding: 10px 12px; min-height: 44px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  font: inherit; font-size: var(--font-size-callout);
  color: var(--color-foreground);
}
.tp-custom-poi-form-field input:focus,
.tp-custom-poi-form-field textarea:focus {
  outline: none; border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-subtle);
}
.tp-custom-poi-form-row-error {
  color: var(--color-destructive);
  font-size: var(--font-size-caption2);
  margin-top: 2px;
}
.tp-custom-poi-form-helper {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
  line-height: 1.45;
}

/* address typeahead */
.tp-custom-poi-typeahead-wrap { position: relative; }
.tp-custom-poi-typeahead-list {
  margin-top: 4px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  max-height: 240px;
  overflow-y: auto;
  z-index: 10;
}
.tp-custom-poi-typeahead-item {
  display: block;
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  font: inherit;
  color: var(--color-foreground);
}
.tp-custom-poi-typeahead-item:last-child { border-bottom: none; }
.tp-custom-poi-typeahead-item:hover,
.tp-custom-poi-typeahead-item:focus-visible,
.tp-custom-poi-typeahead-item.is-focused {
  background: var(--color-accent-subtle);
  outline: none;
}
.tp-custom-poi-typeahead-main {
  font-size: var(--font-size-callout);
  font-weight: 600;
}
.tp-custom-poi-typeahead-sub {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  margin-top: 2px;
}

/* hint checkbox */
.tp-custom-poi-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--color-accent-subtle);
  border: 1px solid var(--color-accent-bg);
  border-radius: var(--radius-md);
}
.tp-custom-poi-hint-checkbox {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-line-strong);
  border-radius: var(--radius-sm);
  cursor: pointer;
  flex-shrink: 0;
  background: var(--color-background);
  margin: 0;
  position: relative;
}
.tp-custom-poi-hint-checkbox:checked {
  background: var(--color-accent);
  border-color: var(--color-accent);
}
.tp-custom-poi-hint-checkbox:checked::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 5px;
  height: 10px;
  border: solid var(--color-accent-foreground);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.tp-custom-poi-hint-text {
  font-size: var(--font-size-footnote);
  color: var(--color-foreground);
  line-height: 1.4;
  cursor: pointer;
}
.tp-custom-poi-hint-text strong { font-weight: 600; }

/* sidehelp + map pane headers */
.tp-custom-poi-form-map-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.tp-custom-poi-form-map-title {
  font-size: var(--font-size-callout);
  font-weight: 700;
  color: var(--color-foreground);
}
.tp-custom-poi-form-map-coord {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}
.tp-custom-poi-form-sidehelp {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  padding: 12px 14px;
  background: var(--color-accent-subtle);
  border-radius: var(--radius-md);
  line-height: 1.5;
}
.tp-custom-poi-form-sidehelp-title {
  font-weight: 700;
  color: var(--color-foreground);
  margin-bottom: 4px;
}

/* Desktop two-pane layout (mockup C) */
@media (min-width: 1024px) {
  .tp-custom-poi-form.tp-custom-poi-form-twopane {
    display: grid;
    grid-template-columns: 380px 1fr;
    min-height: 540px;
    column-gap: 0;
    gap: 0;
  }
  .tp-custom-poi-form-pane {
    padding: 20px 24px;
    border-right: 1px solid var(--color-border);
    background: var(--color-background);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .tp-custom-poi-form-map-pane {
    padding: 20px 24px;
    background: var(--color-secondary);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .tp-custom-poi-form-map-pane .tp-custom-picker-wrap {
    flex: 1;
    min-height: 380px;
    height: auto;
  }
}
@media (max-width: 1023px) {
  .tp-custom-poi-form-pane,
  .tp-custom-poi-form-map-pane {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .tp-custom-poi-form-sidehelp { display: none; }
}
@media (max-width: 760px) {
  .tp-custom-poi-form-row { grid-template-columns: 1fr; }
}
`;

export function CustomPoiForm({
  title,
  onTitleChange,
  coord,
  onCoordChange,
  hintConfirmed,
  onHintConfirmedChange,
  initialCenter,
  initialZoom = 14,
  regionCode,
  error,
  extraRows,
  testIdPrefix,
  category,
  onCategoryChange,
}: Props) {
  const [flyToSignal, setFlyToSignal] =
    useState<{ coord: CustomPoiCoord; zoom?: number } | null>(null);

  const typeahead = usePlacesAutocomplete(regionCode ? { regionCode } : undefined);

  const handlePick = useCallback(
    async (placeId: string) => {
      const closingToken = typeahead.pickSuggestion(placeId);
      try {
        const qs = new URLSearchParams({ placeId });
        if (closingToken) qs.set('sessionToken', closingToken);
        const res = await apiFetchRaw(`/places/resolve?${qs.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { lat: number; lng: number };
        if (!isValidCoord({ lat: data.lat, lng: data.lng })) return;
        setFlyToSignal({ coord: { lat: data.lat, lng: data.lng }, zoom: 15 });
      } catch {
        // silent — user can still drag map manually
      }
    },
    [typeahead],
  );

  const typeaheadKb = useTypeaheadKeyboard({
    listId: `${testIdPrefix}-suggestions`,
    options: typeahead.predictions,
    onPick: (p) => void handlePick(p.placeId),
  });

  return (
    <div
      className="tp-custom-poi-form tp-custom-poi-form-twopane"
      data-testid={`${testIdPrefix}-twopane`}
    >
      <style>{SCOPED_STYLES}</style>

      <div className="tp-custom-poi-form-pane">
        <div className="tp-custom-poi-form-row is-full">
          <div className="tp-custom-poi-form-field">
            <label htmlFor={`${testIdPrefix}-title`}>標題 *</label>
            <input
              id={`${testIdPrefix}-title`}
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="輸入景點名稱（例：心型岩看夕陽）"
              autoFocus
              data-testid={`${testIdPrefix}-title`}
            />
            {error && (
              <div
                className="tp-custom-poi-form-row-error"
                data-testid={`${testIdPrefix}-error`}
              >
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="tp-custom-poi-form-row is-full">
          <div className="tp-custom-poi-form-field">
            <label htmlFor={`${testIdPrefix}-address`}>地址或地標</label>
            <div className="tp-custom-poi-typeahead-wrap">
              <input
                id={`${testIdPrefix}-address`}
                type="text"
                value={typeahead.query}
                onChange={(e) => typeahead.setQuery(e.target.value)}
                placeholder="輸入地址縮放地圖（選填）"
                autoComplete="off"
                data-testid={`${testIdPrefix}-address-typeahead`}
                {...typeaheadKb.inputProps}
              />
              {typeahead.predictions.length > 0 && (
                <div
                  id={`${testIdPrefix}-suggestions`}
                  className="tp-custom-poi-typeahead-list"
                  role="listbox"
                >
                  {typeahead.predictions.map((p, i) => {
                    const focused = typeaheadKb.focusedIndex === i;
                    return (
                      <button
                        key={p.placeId}
                        id={typeaheadKb.getOptionId(i)}
                        type="button"
                        role="option"
                        aria-selected={focused}
                        className={`tp-custom-poi-typeahead-item${focused ? ' is-focused' : ''}`}
                        onClick={() => void handlePick(p.placeId)}
                        data-testid={`${testIdPrefix}-suggestion-${p.placeId}`}
                      >
                        <div className="tp-custom-poi-typeahead-main">{p.primaryText}</div>
                        {p.secondaryText && (
                          <div className="tp-custom-poi-typeahead-sub">{p.secondaryText}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="tp-custom-poi-form-helper">
              選填 — 縮放地圖到大概區域。最終 lat/lng 以地圖中心為準。
            </div>
          </div>
        </div>

        {category != null && onCategoryChange && (
          <div className="tp-custom-poi-form-row is-full">
            <div className="tp-custom-poi-form-field">
              <label id={`${testIdPrefix}-category-label`}>類別</label>
              <CategoryPicker
                value={category}
                onChange={onCategoryChange}
                testIdPrefix={`${testIdPrefix}-category`}
                ariaLabelledBy={`${testIdPrefix}-category-label`}
              />
            </div>
          </div>
        )}

        {extraRows}
      </div>

      <div
        className="tp-custom-poi-form-map-pane"
        data-testid={`${testIdPrefix}-map-pane`}
      >
        <div className="tp-custom-poi-form-map-head">
          <span className="tp-custom-poi-form-map-title">在地圖上選位置</span>
          <span
            className="tp-custom-poi-form-map-coord"
            data-testid={`${testIdPrefix}-coord-readout`}
          >
            {coord ? `${coord.lat.toFixed(4)}°N ${coord.lng.toFixed(4)}°E` : '—'}
          </span>
        </div>
        <LocationPickerMap
          initialCenter={initialCenter}
          initialZoom={initialZoom}
          onCoordChange={onCoordChange}
          flyToSignal={flyToSignal}
        />
        <div className="tp-custom-poi-hint">
          <input
            type="checkbox"
            id={`${testIdPrefix}-hint`}
            className="tp-custom-poi-hint-checkbox"
            checked={hintConfirmed}
            onChange={(e) => onHintConfirmedChange(e.target.checked)}
            data-testid={`${testIdPrefix}-hint`}
          />
          <label htmlFor={`${testIdPrefix}-hint`} className="tp-custom-poi-hint-text">
            <strong>已調整到正確位置</strong> — 拖地圖或用方向鍵微調
          </label>
        </div>
        <div className="tp-custom-poi-form-sidehelp">
          <div className="tp-custom-poi-form-sidehelp-title">小提示</div>
          朋友家 / 隱藏小店地址常不精確 — 拖 pin 到實際位置，timeline 才會顯正確車程。鍵盤可用 ↑↓←→ 微調。
        </div>
      </div>
    </div>
  );
}
