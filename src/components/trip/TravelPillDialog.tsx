/**
 * TravelPillDialog — segment travel 方式 picker（v2.55.45 多方式擴充）。
 *
 * v2.24.0 起點：3 mode（駕車/步行/大眾運輸）。v2.55.45 擴成 8 方式晶片格：
 *   駕車 · 步行 · 單軌 · 公車 · 地鐵 · 火車 · 高鐵 · 其他（自由輸入方式名）。
 * 方式定義集中於 lib/travelMode.ts（TRAVEL_METHODS），與後端 submode 對齊。
 *
 * 計算策略（後端 segments/_shared.ts 分派）：
 *   - 自動算：駕車/步行（Google WALK/DRIVE）、單軌（本地 Yui 估）、公車（Google DRIVE）。
 *   - 純手填：地鐵/火車/高鐵、其他。距離一律自動（駕車/步行/公車＝Google、其餘＝直線）。
 *
 * 覆寫 / 恢復自動：
 *   - 自動方式手填分鐘 → 後端存 source='manual'（鎖定），recompute 不再覆寫。
 *   - 「恢復自動計算」= 送不帶 min 的 PATCH（min:undefined，JSON.stringify 丟棄）→ 後端重算。
 *   - source==='manual' 且選中原方式且該方式可自動 → 顯示 🔒 + 恢復鈕。
 *
 * v2.33.108: auto-save（無「儲存」button）。切晶片/改分鐘即 PATCH。OCC via currentVersion。
 * Mobile (<760px)：bottom sheet。Desktop：popover 360px。createPortal 到 body（遮罩蓋 sticky header）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { apiFetchRaw } from '../../lib/apiClient';
import { ApiError } from '../../lib/errors';
import { EVENT } from '../../lib/events';
import { useAutosave } from '../../hooks/useAutosave';
import { useSheetBehavior } from '../../hooks/useSheetBehavior';
import {
  type TravelMode,
  type TravelMethod,
  TRAVEL_METHODS,
  MAX_SEGMENT_MIN_CLIENT,
  travelMethodKey,
} from '../../lib/travelMode';

// v2.33.91: re-export for backward-compat import chains.
export type { TravelMode };

const SCOPED_STYLES = `
.tp-travel-overlay {
  position: fixed; inset: 0;
  background: var(--color-overlay);
  display: flex; align-items: flex-end; justify-content: center;
  z-index: var(--z-modal, 110);
}
@media (min-width: 760px) { .tp-travel-overlay { align-items: center; } }
.tp-travel-dialog {
  background: var(--color-background);
  width: 100%;
  padding: 8px 16px 24px;
  box-shadow: 0 -8px 32px rgba(42, 31, 24, 0.18);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}
@media (min-width: 760px) {
  .tp-travel-dialog {
    width: 360px;
    border-radius: var(--radius-md);
    padding: 20px;
    box-shadow: 0 16px 48px rgba(42, 31, 24, 0.22);
  }
}
/* .tp-travel-dialog-handle 已刪除（#1161）：那是一條純裝飾的膠囊，**沒有綁任何觸控事件**。
 * 這個對話框是固定高度的覆蓋層、畫不出可拖曳的行為，卻畫了一個看起來可拖的把手 ——
 * 使用者會一直嘗試一個不存在的手勢。依「誠實介面」原則直接刪視覺元素，不新增手勢。
 * （原本只在 <760px 顯示，桌機本來就看不到，所以這個改動只影響手機寬度的渲染。） */
.tp-travel-dialog-title { font-size: var(--font-size-headline); font-weight: 700; margin: 0 0 4px; }
.tp-travel-dialog-meta { font-size: var(--font-size-footnote); color: var(--color-muted); margin: 0 0 14px; }

/* 方式晶片格 */
.tp-travel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.tp-travel-chip {
  display: flex; align-items: center; gap: 8px;
  min-height: var(--spacing-tap-min, 44px);
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  font: inherit; font-size: var(--font-size-body);
  color: var(--color-foreground);
  cursor: pointer; text-align: left; width: 100%;
}
.tp-travel-chip:hover { background: var(--color-hover); }
.tp-travel-chip.is-selected {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent);
  color: var(--color-accent-deep);
}
.tp-travel-chip-icon { display: inline-flex; align-items: center; color: var(--color-accent); flex-shrink: 0; }
.tp-travel-chip.is-selected .tp-travel-chip-icon { color: var(--color-accent-deep); }
.tp-travel-chip-icon .svg-icon { width: 18px; height: 18px; }
.tp-travel-chip-label { font-weight: 600; }
.tp-travel-chip-tag { margin-left: auto; font-size: var(--font-size-caption); color: var(--color-muted); }
.tp-travel-chip.is-selected .tp-travel-chip-tag { color: var(--color-accent-deep); }

/* detail / input 區 */
.tp-travel-detail {
  margin-top: 10px; padding: 12px 14px;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-md);
  background: var(--color-accent-subtle);
  display: flex; flex-direction: column; gap: 8px;
}
.tp-travel-field { display: flex; flex-direction: column; gap: 4px; }
.tp-travel-field-label { font-size: var(--font-size-footnote); color: var(--color-accent-deep); font-weight: 600; }
.tp-travel-detail input {
  font: inherit; font-size: var(--font-size-body);
  padding: 8px 12px;
  border: 1px solid var(--color-border-control);
  border-radius: var(--radius-sm);
  width: 100%;
  background: var(--color-background); color: var(--color-foreground);
}
.tp-travel-detail input:focus { outline: none; border-color: var(--color-accent); }
.tp-travel-hint { font-size: var(--font-size-caption); color: var(--color-muted); }
.tp-travel-compute { font-size: var(--font-size-footnote); color: var(--color-foreground); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.tp-travel-compute-val { font-weight: 700; }
.tp-travel-lock { color: var(--color-accent-deep); font-size: var(--font-size-caption); font-weight: 600; display: inline-flex; align-items: center; gap: 2px; }
.tp-travel-revert {
  align-self: flex-start;
  min-height: 36px; padding: 6px 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-accent);
  background: var(--color-background);
  color: var(--color-accent-deep);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
}
.tp-travel-revert:hover { background: var(--color-hover); }
.tp-travel-revert .svg-icon { width: 14px; height: 14px; }

.tp-travel-dialog-footer { display: flex; margin-top: 16px; justify-content: flex-end; }
.tp-travel-dialog-btn {
  min-height: var(--spacing-tap-min, 44px);
  padding: 10px 20px; border-radius: var(--radius-full);
  font: inherit; font-size: var(--font-size-body); font-weight: 600;
  cursor: pointer; border: 1px solid var(--color-border);
  background: var(--color-background); color: var(--color-foreground);
}
.tp-travel-dialog-btn:hover { background: var(--color-hover); }

/* v2.55.46 同一地點/免交通 — 中性整列，與交通方式晶片視覺區隔（非柔褐/ sage 選取態）。 */
.tp-travel-sameplace-sep {
  display: flex; align-items: center; gap: 10px;
  margin: 13px 2px 0; color: var(--color-muted); font-size: var(--font-size-caption);
}
.tp-travel-sameplace-sep::before, .tp-travel-sameplace-sep::after {
  content: ""; height: 1px; flex: 1; background: var(--color-border);
}
.tp-travel-sameplace-row {
  display: flex; align-items: center; gap: 10px; width: 100%;
  margin-top: 10px; padding: 11px 12px;
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  background: var(--color-background);
  font: inherit; text-align: left; cursor: pointer; color: var(--color-foreground);
  min-height: var(--spacing-tap-min, 44px);
}
.tp-travel-sameplace-row:hover { background: var(--color-hover); }
.tp-travel-sameplace-row.is-selected { background: var(--color-hover); border-color: var(--color-line-strong); }
.tp-travel-sameplace-row > .svg-icon { width: 18px; height: 18px; color: var(--color-muted); flex-shrink: 0; }
.tp-travel-sameplace-row-txt b { font-size: var(--font-size-body); font-weight: 700; display: block; }
.tp-travel-sameplace-row-txt span { font-size: var(--font-size-caption); color: var(--color-muted); }
.tp-travel-sameplace-row-check { margin-left: auto; color: var(--color-foreground); display: inline-flex; }
.tp-travel-sameplace-row-check .svg-icon { width: 18px; height: 18px; }
.tp-travel-sameplace-hint { margin: 12px 2px 0; font-size: var(--font-size-footnote); color: var(--color-muted); }
`;

export interface TravelPillDialogProps {
  tripId: string;
  /** 既有 segment → PATCH /segments/:id。省略 → create 模式：用 fromEntryId/toEntryId POST /segments 建立。 */
  segmentId?: number;
  /** create 模式（segmentId 省略）時必填：POST /segments 的 from/to entry id。 */
  fromEntryId?: number;
  toEntryId?: number;
  currentMode: TravelMode;
  /** v2.55.45: 目前 submode（monorail/bus/metro/train/hsr/自由文字/null）。 */
  currentSubmode?: string | null;
  currentMin?: number | null;
  /** v2.55.45: 'manual' = 手填/手動覆寫鎖定；其餘（google/haversine）= 自動。 */
  currentSource?: string | null;
  /** v2.55.46: 1 = 目前標記為「同一地點/免交通」。 */
  currentNoTravel?: number | null;
  currentVersion?: number;
  distanceM?: number | null;
  fromName?: string | null;
  toName?: string | null;
  onClose: () => void;
  onSaved?: (updated: { mode: TravelMode; min: number | null }) => void;
}

interface SegmentPatchBody {
  mode: TravelMode;
  submode?: string | null;
  min?: number;
  /** v2.55.46: true = 標記同一地點/免交通（後端繞過 mode/min、收合此段）。 */
  noTravel?: boolean;
}

/** selectedKey 的特殊值（非 TRAVEL_METHODS key）：標記「同一地點/免交通」。 */
const SAMEPLACE_KEY = 'sameplace';

function formatKm(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 50) * 50} m`;
}

export default function TravelPillDialog({
  tripId,
  segmentId,
  fromEntryId,
  toEntryId,
  currentMode,
  currentSubmode,
  currentMin,
  currentSource,
  currentNoTravel,
  currentVersion,
  distanceM,
  fromName,
  toName,
  onClose,
  onSaved,
}: TravelPillDialogProps) {
  const initialKey = useMemo(
    () => (currentNoTravel === 1 ? SAMEPLACE_KEY : travelMethodKey(currentMode, currentSubmode)),
    [currentNoTravel, currentMode, currentSubmode],
  );

  const [selectedKey, setSelectedKey] = useState(initialKey);
  const [otherName, setOtherName] = useState(
    initialKey === 'other' && typeof currentSubmode === 'string' ? currentSubmode : '',
  );
  // 手填方式 or 已覆寫的自動方式 → 預填分鐘；自動未覆寫 → 空（override 選填）。lazy init 算一次。
  const [minInput, setMinInput] = useState(() => {
    const method = TRAVEL_METHODS.find((m) => m.key === initialKey) ?? TRAVEL_METHODS[0]!;
    const locked = currentSource === 'manual' || !method.auto;
    return locked && typeof currentMin === 'number' ? String(currentMin) : '';
  });

  const overlayRef = useRef<HTMLDivElement | null>(null);
  // #1161：交給引擎當 initialFocusRef —— 由下方 effect 填入第一個交通方式晶片。
  const initialFocusRef = useRef<HTMLElement | null>(null);
  const titleId = `tp-travel-dialog-title-${segmentId ?? `${fromEntryId}-${toEntryId}`}`;

  const selectedMethod: TravelMethod = useMemo(
    () => TRAVEL_METHODS.find((m) => m.key === selectedKey) ?? TRAVEL_METHODS[0]!,
    [selectedKey],
  );
  const isSamePlaceSelected = selectedKey === SAMEPLACE_KEY;

  const minNumber = parseInt(minInput, 10);
  const minValid = Number.isFinite(minNumber) && minNumber >= 1 && minNumber <= MAX_SEGMENT_MIN_CLIENT;
  // 選中原方式 + 該方式可自動 + 目前鎖定 → 已手動覆寫（顯示 🔒 + 恢復鈕）。
  const isOverridden = selectedMethod.auto && selectedKey === initialKey && currentSource === 'manual';

  const autosave = useAutosave<SegmentPatchBody>({
    initialVersion: currentVersion,
    debounceMs: 600,
    save: async (body, expectedVersion) => {
      // segmentId 省略 = create 模式：POST /segments 帶 from/to entry id（後端 upsert）。
      // 既有 segment → PATCH /segments/:id 帶 expectedVersion（OCC）。
      const isCreate = segmentId == null;
      const payload: Record<string, unknown> = { ...body };
      if (isCreate) {
        payload.from_entry_id = fromEntryId;
        payload.to_entry_id = toEntryId;
      } else if (typeof expectedVersion === 'number') {
        payload.expectedVersion = expectedVersion;
      }
      const res = await apiFetchRaw(
        isCreate
          ? `/trips/${encodeURIComponent(tripId)}/segments`
          : `/trips/${encodeURIComponent(tripId)}/segments/${segmentId}`,
        { method: isCreate ? 'POST' : 'PATCH', body: JSON.stringify(payload) },
      );
      if (!res.ok) throw await ApiError.fromResponse(res);
      const updated = await res.json() as { id?: number; mode?: TravelMode; min?: number | null; version?: number };
      onSaved?.({
        mode: (updated.mode ?? body.mode) as TravelMode,
        min: typeof updated.min === 'number' ? updated.min : null,
      });
      window.dispatchEvent(new CustomEvent(EVENT.segmentUpdated, { detail: { tripId, segmentId: segmentId ?? updated.id } }));
      return updated as Record<string, unknown>;
    },
    onStale: async () => {
      const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/segments`);
      if (!res.ok) throw new Error('Failed to refresh segments');
      const list = await res.json() as Array<{ id: number; version: number; from_entry_id: number; to_entry_id: number }>;
      const found = segmentId != null
        ? list.find((s) => s.id === segmentId)
        : list.find((s) => s.from_entry_id === fromEntryId && s.to_entry_id === toEntryId);
      if (!found) throw new Error('Segment not found after refresh');
      return found.version;
    },
  });

  // 送出：min:undefined → 自動（JSON.stringify 丟棄 undefined key）；有 min → 手填/覆寫鎖定。
  const submit = useCallback((mode: TravelMode, submode: string | null, min: number | undefined) => {
    autosave.patch({ mode, submode, min });
    void autosave.flush();
  }, [autosave]);

  // v2.55.46: 標記「同一地點/免交通」— 送 noTravel:true（後端繞過 mode/min、no_travel=1、收合）。
  // 送 currentMode 只為滿足 body type；後端 noTravel 分支忽略 mode/submode/min。選任一方式即清旗標。
  const submitNoTravel = useCallback(() => {
    setSelectedKey(SAMEPLACE_KEY);
    setMinInput('');
    autosave.patch({ mode: currentMode, submode: null, min: undefined, noTravel: true });
    void autosave.flush();
  }, [autosave, currentMode]);

  // 手填 commit（min input / 方式名 input 的 onBlur 共用）：組 submode（其他＝自由文字名）
  // + min 送出；自動方式帶 min 即手動覆寫鎖定。無效 min / 其他缺方式名 → 不送。
  const commitManual = useCallback((method: TravelMethod) => {
    if (!minValid) return;
    const submode = method.freeText ? otherName.trim() : method.submode;
    if (method.freeText && !submode) return; // 其他需先填方式名
    submit(method.mode, submode, minNumber);
  }, [minValid, otherName, minNumber, submit]);

  const handleSelectMethod = useCallback((method: TravelMethod) => {
    setSelectedKey(method.key);
    // 選回原本已覆寫的自動方式 → 還原覆寫值顯示、保留鎖定（不自動重算）。
    if (method.auto && method.key === initialKey && currentSource === 'manual') {
      setMinInput(typeof currentMin === 'number' ? String(currentMin) : '');
      return;
    }
    // 切方式一律清空 min 輸入，避免半打的分鐘被當新方式的覆寫套用（stale leak）。
    setMinInput('');
    if (method.auto) submit(method.mode, method.submode, undefined); // 自動算（不帶 min）
    // 手填方式：等使用者輸入 min 後 onBlur commit，不在選擇當下帶 stale 值。
  }, [initialKey, currentSource, currentMin, submit]);

  const handleRevert = useCallback(() => {
    setMinInput('');
    submit(selectedMethod.mode, selectedMethod.submode, undefined);
  }, [selectedMethod, submit]);

  const handleClose = useCallback(() => {
    void autosave.flush().finally(onClose);
  }, [autosave, onClose]);

  // #1161：接共用 sheet 引擎。本元件宣告 aria-modal="true" 卻是手刻覆蓋層，Tab 會跑出
  // 對話框外碰到底下被遮住的內容 —— 宣告 modal 卻沒有 focus trap 就是騙輔助技術。
  //
  // 接上引擎一次拿到：Tab focus trap（handlePanelKeyDown 掛在 .tp-travel-dialog 上，
  // 那才是真正的 panel）、**巢狀時只有最上層回應的 Escape**（原本手刻的 document
  // keydown 沒有這個判斷，內層若再開 confirm 會兩個一起關）、IME 組字中的 Escape 不誤關、
  // body scroll lock、以及開啟時的初始焦點。原本手刻的 Escape listener 整段刪除。
  //
  // ⚠ 已知限制（不在本票範圍）：本元件由 parent 條件式 render，沒有 `open` prop ——
  // isOpen 永遠是 true，所以引擎的「關閉時還原焦點」（#1160）在這裡不會觸發（unmount
  // 不等於 isOpen 轉 false）。要補得先把它改成受控的 open prop。
  const { panelRef, backdropRef, handlePanelKeyDown } = useSheetBehavior(true, handleClose, {
    initialFocusRef,
  });

  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (autosave.state === 'error' && autosave.error && autosave.error !== lastErrorRef.current) {
      lastErrorRef.current = autosave.error;
      showToast(`交通方式儲存失敗：${autosave.error}`, 'error', 6000);
    } else if (autosave.state !== 'error') {
      lastErrorRef.current = null;
    }
  }, [autosave.state, autosave.error]);

  // #1161：改成只「記下」初始焦點目標，實際 focus() 交給引擎（它在 rAF 裡做，時序才對）。
  // 若這裡自己 focus()，引擎的 rAF 會晚一步把焦點搬到 panel 上，反而蓋掉第一個晶片。
  useEffect(() => {
    initialFocusRef.current =
      overlayRef.current?.querySelector<HTMLButtonElement>('.tp-travel-chip') ?? null;
  }, []);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  };

  if (typeof document === 'undefined') return null;

  const hasDist = typeof distanceM === 'number' && distanceM > 0;
  const m = selectedMethod;

  return createPortal(
    <>
      <style>{SCOPED_STYLES}</style>
      <div
        // overlay 同時是 backdrop（點它會關）。一個元素只能掛一個 ref，用 callback ref
        // 同時餵既有的 overlayRef 與引擎的 backdropRef —— 後者讓引擎能阻擋 backdrop 上的
        // wheel/touchmove（手機 bottom sheet 尤其有感；沒掛的話引擎會安靜 no-op）。
        ref={(el) => {
          overlayRef.current = el;
          backdropRef.current = el;
        }}
        className="tp-travel-overlay"
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="travel-pill-dialog"
      >
        <div className="tp-travel-dialog" ref={panelRef} tabIndex={-1} onKeyDown={handlePanelKeyDown}>
          <h3 id={titleId} className="tp-travel-dialog-title">交通方式</h3>
          {(fromName || toName || hasDist) && (
            <p className="tp-travel-dialog-meta">
              {fromName && toName ? `${fromName} → ${toName}` : ''}
              {(fromName || toName) && hasDist ? ' · ' : ''}
              {hasDist ? formatKm(distanceM!) : ''}
            </p>
          )}

          <div className="tp-travel-grid">
            {TRAVEL_METHODS.map((method) => {
              const isSelected = selectedKey === method.key;
              return (
                <button
                  key={method.key}
                  type="button"
                  className={`tp-travel-chip ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleSelectMethod(method)}
                  aria-pressed={isSelected}
                  data-testid={`travel-method-${method.key}`}
                >
                  <span className="tp-travel-chip-icon" aria-hidden="true">
                    <Icon name={method.iconName} />
                  </span>
                  <span className="tp-travel-chip-label">{method.label}</span>
                  {isSelected && method.auto && <span className="tp-travel-chip-tag">自動</span>}
                </button>
              );
            })}
          </div>

          {/* v2.55.46 同一地點/免交通 — 非交通方式，故在方式格下方獨立整列（中性色，非晶片態）。 */}
          <div className="tp-travel-sameplace-sep">或</div>
          <button
            type="button"
            className={`tp-travel-sameplace-row ${isSamePlaceSelected ? 'is-selected' : ''}`}
            onClick={submitNoTravel}
            aria-pressed={isSamePlaceSelected}
            data-testid="travel-method-sameplace"
          >
            <Icon name="location-pin" />
            <span className="tp-travel-sameplace-row-txt">
              <b>不需計算路程</b>
              <span>此段不顯示交通時間</span>
            </span>
            {isSamePlaceSelected && (
              <span className="tp-travel-sameplace-row-check" aria-hidden="true"><Icon name="check" /></span>
            )}
          </button>

          {isSamePlaceSelected ? (
            <p className="tp-travel-sameplace-hint" data-testid="travel-sameplace-hint">
              此段不計交通時間，選上方任一方式即可恢復。
            </p>
          ) : (
          <div className="tp-travel-detail">
            {/* 自動方式：計算明細 + 鎖定/恢復 */}
            {m.auto && (
              <div className="tp-travel-compute">
                {typeof currentMin === 'number' && currentMin > 0
                  ? <><span className="tp-travel-compute-val">{currentMin} 分鐘</span>{hasDist ? ` · ${formatKm(distanceM!)}` : ''}</>
                  : <span className="tp-travel-hint">選此方式即自動計算</span>}
                {isOverridden
                  ? <span className="tp-travel-lock"><Icon name="warning" /> 已手動覆寫</span>
                  : (typeof currentMin === 'number' && currentMin > 0 ? <span className="tp-travel-hint">· 自動</span> : null)}
              </div>
            )}
            {m.auto && isOverridden && (
              <button type="button" className="tp-travel-revert" onClick={handleRevert} data-testid="travel-revert">
                <Icon name="refresh-cw" /> 恢復自動計算
              </button>
            )}

            {/* 其他：自由輸入方式名 */}
            {m.freeText && (
              <div className="tp-travel-field">
                <label className="tp-travel-field-label" htmlFor={`tp-other-name-${segmentId}`}>交通方式名稱</label>
                <input
                  id={`tp-other-name-${segmentId}`}
                  type="text"
                  maxLength={20}
                  value={otherName}
                  onChange={(e) => setOtherName(e.target.value)}
                  onBlur={() => commitManual(selectedMethod)}
                  placeholder="例：水上巴士、纜車…"
                  data-testid="travel-other-name"
                />
              </div>
            )}

            {/* 分鐘：手填方式＝必填、自動方式＝覆寫（選填） */}
            <div className="tp-travel-field">
              <label className="tp-travel-field-label" htmlFor={`tp-min-${segmentId}`}>
                {m.auto ? '手動覆寫分鐘（選填）' : '需要多少分鐘？'}
              </label>
              <input
                id={`tp-min-${segmentId}`}
                className="tp-input-short"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_SEGMENT_MIN_CLIENT}
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                onBlur={() => commitManual(selectedMethod)}
                placeholder={m.auto ? '留空＝維持自動' : ''}
                data-testid="travel-min-input"
              />
              <span className="tp-travel-hint">
                {m.auto ? '填了就鎖定手動值、停自動' : `範圍 1–${MAX_SEGMENT_MIN_CLIENT} 分鐘`}
                {!m.auto && hasDist ? ` · 距離 ${formatKm(distanceM!)}（自動）` : ''}
              </span>
            </div>
          </div>
          )}

          <div className="tp-travel-dialog-footer">
            <button
              type="button"
              className="tp-travel-dialog-btn"
              onClick={handleClose}
              data-testid="travel-dialog-close"
            >
              關閉
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
