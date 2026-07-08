/**
 * TravelPillDialog — v2.24.0 segment travel mode picker.
 *
 * v2.33.108: 移除「儲存 / 取消」button — 改 auto-save。
 *   - mode option click → 立即 patch (driving/walking 不需 min；transit 需 min 並
 *     等 valid input 後 patch)
 *   - transit min input → onBlur flush 立即 patch
 *   - footer 顯示 SaveStatus（pending/saving/saved/error/offline）+ 「關閉」button
 *
 * Mobile (<760px)：bottom sheet 由下滑出。Desktop：popover 樣式 360px。
 *
 * Backend (v2.30.0)：
 *   - driving / walking → backend 一律打 Google Routes 重算（ignore body.min）
 *   - transit → user 手填分鐘（1–1440），backend save 為 source='manual'
 *
 * OCC (v2.33.108)：currentVersion prop → autosave hook 帶 expectedVersion；
 * concurrent edit race 時 backend 回 409 STALE_ENTRY → hook 自動 refresh + retry。
 *
 * 對齊 docs/design-sessions/2026-05-07-travel-pill-tap-switch.html。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { apiFetchRaw } from '../../lib/apiClient';
import { ApiError } from '../../lib/errors';
import { EVENT } from '../../lib/events';
import { useAutosave } from '../../hooks/useAutosave';
import type { TravelMode } from '../../lib/travelMode';

// v2.33.91: 移除本地 type 宣告，從 lib/travelMode canonical 來源 import + 為 backward-compat
// 透過 `export type` re-export（之前 TravelPill.tsx 等檔案經 `from './TravelPillDialog'` import）。
export type { TravelMode };

const SCOPED_STYLES = `
.tp-travel-overlay {
  position: fixed; inset: 0;
  background: var(--color-overlay);
  display: flex; align-items: flex-end; justify-content: center;
  z-index: var(--z-modal, 110);
}
@media (min-width: 760px) {
  .tp-travel-overlay { align-items: center; }
}
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
.tp-travel-dialog-handle {
  width: 36px; height: 4px;
  background: var(--color-line-strong);
  border-radius: var(--radius-full);
  margin: 0 auto 12px;
}
@media (min-width: 760px) { .tp-travel-dialog-handle { display: none; } }
.tp-travel-dialog-title {
  font-size: var(--font-size-headline);
  font-weight: 700;
  margin: 0 0 4px;
}
.tp-travel-dialog-meta {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  margin: 0 0 16px;
}
.tp-travel-mode-list {
  display: flex; flex-direction: column; gap: 8px;
}
.tp-travel-mode-option {
  display: flex; align-items: center; gap: 12px;
  min-height: var(--spacing-tap-min, 44px);
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-background);
  font: inherit; font-size: var(--font-size-body);
  color: var(--color-foreground);
  cursor: pointer; text-align: left; width: 100%;
}
.tp-travel-mode-option:hover { background: var(--color-hover); }
.tp-travel-mode-option.is-selected {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent);
  color: var(--color-accent-deep);
}
.tp-travel-mode-option-icon {
  width: 40px; height: 40px;
  border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--color-secondary);
  color: var(--color-accent);
  flex-shrink: 0;
}
.tp-travel-mode-option.is-selected .tp-travel-mode-option-icon {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
}
.tp-travel-mode-option-icon .svg-icon { width: 18px; height: 18px; }
.tp-travel-mode-option-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.tp-travel-mode-option-label { font-weight: 600; }
.tp-travel-mode-option-meta {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
}
.tp-travel-mode-option.is-selected .tp-travel-mode-option-meta { color: var(--color-accent-deep); }
.tp-travel-mode-option-check {
  color: var(--color-accent);
  flex-shrink: 0;
}
.tp-travel-mode-option-check .svg-icon { width: 18px; height: 18px; }
.tp-travel-transit-input {
  margin-top: 8px;
  padding: 12px 14px;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-md);
  background: var(--color-accent-subtle);
  display: flex; flex-direction: column; gap: 8px;
}
.tp-travel-transit-input-label {
  font-size: var(--font-size-footnote);
  color: var(--color-accent-deep);
  font-weight: 600;
}
.tp-travel-transit-input input {
  font: inherit; font-size: var(--font-size-body);
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  width: 100%;
  background: var(--color-background);
  color: var(--color-foreground);
}
.tp-travel-transit-input input:focus {
  outline: none;
  border-color: var(--color-accent);
}
.tp-travel-transit-input-hint {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
}
/* v2.33.108: footer 只剩「關閉」button + SaveStatus inline。auto-save 後不需 cancel/save 二選一。 */
.tp-travel-dialog-footer {
  display: flex; gap: 8px;
  margin-top: 16px;
  align-items: center;
  justify-content: space-between;
}
.tp-travel-dialog-btn {
  min-height: var(--spacing-tap-min, 44px);
  padding: 10px 20px;
  border-radius: var(--radius-full);
  font: inherit; font-size: var(--font-size-body); font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-foreground);
}
.tp-travel-dialog-btn:hover { background: var(--color-hover); }
`;

export interface TravelPillDialogProps {
  tripId: string;
  segmentId: number;
  /** 當前 mode（從 segments endpoint 來） */
  currentMode: TravelMode;
  /** 當前 min（顯示在現選 mode option 描述） */
  currentMin?: number | null;
  /** v2.33.108: 當前 OCC version；undefined → skip OCC check（向後相容）。 */
  currentVersion?: number;
  /** 距離 m，用於 walking 估算與顯示 */
  distanceM?: number | null;
  /** 顯示 from→to entry 名稱（純展示，optional） */
  fromName?: string | null;
  toName?: string | null;
  /** 關閉 callback */
  onClose: () => void;
  /** Save 完成後 callback（傳更新後的 segment row） */
  onSaved?: (updated: { mode: TravelMode; min: number | null }) => void;
}

const MODE_DEFINITIONS: Array<{ mode: TravelMode; label: string; iconName: string; describe: (props: { distanceM?: number | null; currentMin?: number | null; isSelected: boolean }) => string }> = [
  {
    mode: 'driving',
    label: '駕車',
    iconName: 'car',
    describe: ({ distanceM, currentMin, isSelected }) => {
      if (isSelected && currentMin && currentMin > 0) {
        return `${currentMin} min${distanceM ? ` · ${formatKm(distanceM)}` : ''} · Google Routes`;
      }
      return distanceM ? `距離 ${formatKm(distanceM)}` : '系統估算';
    },
  },
  {
    mode: 'walking',
    label: '步行',
    iconName: 'walking',
    describe: ({ distanceM, currentMin, isSelected }) => {
      if (isSelected && currentMin && currentMin > 0) {
        return `${currentMin} min${distanceM ? ` · ${formatKm(distanceM)}` : ''} · Google Routes`;
      }
      if (distanceM && distanceM > 0) {
        const estMin = Math.round((distanceM / 1000) * 12); // ~5km/h
        return `距離 ${formatKm(distanceM)} · 估 ${estMin} min`;
      }
      return '系統估算';
    },
  },
  {
    mode: 'transit',
    label: '大眾運輸',
    iconName: 'bus',
    describe: ({ currentMin, isSelected }) => {
      if (isSelected && currentMin && currentMin > 0) {
        return `${currentMin} 分鐘 · 已手動填寫`;
      }
      return '手動填寫分鐘（Google API 沒日本資料）';
    },
  },
];

function formatKm(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 50) * 50} m`;
}

interface SegmentPatchBody {
  mode: TravelMode;
  min?: number;
}

export default function TravelPillDialog({
  tripId,
  segmentId,
  currentMode,
  currentMin,
  currentVersion,
  distanceM,
  fromName,
  toName,
  onClose,
  onSaved,
}: TravelPillDialogProps) {
  const [selectedMode, setSelectedMode] = useState<TravelMode>(currentMode);
  const [transitMin, setTransitMin] = useState<string>(
    currentMode === 'transit' && typeof currentMin === 'number' ? String(currentMin) : '',
  );
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const titleId = `tp-travel-dialog-title-${segmentId}`;

  const transitMinNumber = useMemo(() => {
    const n = parseInt(transitMin, 10);
    return Number.isFinite(n) ? n : NaN;
  }, [transitMin]);

  const isTransitMinValid =
    selectedMode !== 'transit' ||
    (Number.isFinite(transitMinNumber) && transitMinNumber >= 1 && transitMinNumber <= 1440);

  // v2.33.108: auto-save hook 取代 handleSubmit
  const autosave = useAutosave<SegmentPatchBody>({
    initialVersion: currentVersion,
    debounceMs: 600,
    save: async (body, expectedVersion) => {
      const payload: SegmentPatchBody & { expectedVersion?: number } = { ...body } as SegmentPatchBody & { expectedVersion?: number };
      if (typeof expectedVersion === 'number') payload.expectedVersion = expectedVersion;
      const res = await apiFetchRaw(
        `/trips/${encodeURIComponent(tripId)}/segments/${segmentId}`,
        { method: 'PATCH', body: JSON.stringify(payload) },
      );
      if (!res.ok) throw await ApiError.fromResponse(res);
      const updated = await res.json() as { mode?: TravelMode; min?: number | null; version?: number };
      onSaved?.({
        mode: (updated.mode ?? body.mode) as TravelMode,
        min: typeof updated.min === 'number' ? updated.min : null,
      });
      window.dispatchEvent(new CustomEvent(EVENT.segmentUpdated, { detail: { tripId, segmentId } }));
      return updated as Record<string, unknown>;
    },
    onStale: async () => {
      // GET segments 拿最新 version (segments index endpoint 已加 version)
      const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/segments`);
      if (!res.ok) throw new Error('Failed to refresh segments');
      const list = await res.json() as Array<{ id: number; version: number }>;
      const found = list.find((s) => s.id === segmentId);
      if (!found) throw new Error('Segment not found after refresh');
      return found.version;
    },
  });

  // v2.33.108: mode click → 立即觸發 PATCH (debounce 短)
  const handleSelectMode = useCallback((mode: TravelMode) => {
    setSelectedMode(mode);
    if (mode !== 'transit') {
      autosave.patch({ mode });
      // 非 transit 立即 flush — 不等 debounce
      void autosave.flush();
    } else if (isTransitMinValid && Number.isFinite(transitMinNumber)) {
      autosave.patch({ mode, min: transitMinNumber });
      void autosave.flush();
    }
    // transit 模式但 min 未 valid → 等 user 填完 onBlur 再觸發
  }, [autosave, isTransitMinValid, transitMinNumber]);

  // v2.33.108: transit min input → onChange 寫 state，onBlur 觸發 PATCH
  const handleTransitMinChange = useCallback((value: string) => {
    setTransitMin(value);
  }, []);

  const handleTransitMinBlur = useCallback(() => {
    if (selectedMode === 'transit' && isTransitMinValid && Number.isFinite(transitMinNumber)) {
      autosave.patch({ mode: 'transit', min: transitMinNumber });
      void autosave.flush();
    }
  }, [autosave, selectedMode, isTransitMinValid, transitMinNumber]);

  // 關閉前 flush 任何 pending patch — 防 user 改了 transit min 後直接 close
  const handleClose = useCallback(() => {
    void autosave.flush().finally(onClose);
  }, [autosave, onClose]);

  // ESC 關閉
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

  // v2.33.143: autosave error 走 toast（拔 SaveStatus 後唯一錯誤 surface）
  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (autosave.state === 'error' && autosave.error && autosave.error !== lastErrorRef.current) {
      lastErrorRef.current = autosave.error;
      showToast(`交通方式儲存失敗：${autosave.error}`, 'error', 6000);
    } else if (autosave.state !== 'error') {
      lastErrorRef.current = null;
    }
  }, [autosave.state, autosave.error]);

  // 自動聚焦第一個 option（mount 後）
  useEffect(() => {
    const first = overlayRef.current?.querySelector<HTMLButtonElement>('.tp-travel-mode-option');
    first?.focus();
  }, []);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  };

  if (typeof document === 'undefined') return null; // 非 DOM 環境 → 與 ConfirmModal 等 shared modal 同樣 degrade，不硬 crash
  // createPortal 到 body：overlay 是 fixed inset:0 z=--z-modal(9000)，但 dialog 掛在
  // timeline 欄的 stacking context 內（day-section 動畫的 containing block 會困住 fixed），
  // 不 portal 出去遮罩就蓋不過 sticky header（標題列 + DAY tabs）。與 ConfirmModal /
  // StopLightbox 等 shared modal 同 idiom。
  return createPortal(
    <>
      <style>{SCOPED_STYLES}</style>
      <div
        ref={overlayRef}
        className="tp-travel-overlay"
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="travel-pill-dialog"
      >
        <div className="tp-travel-dialog">
          <div className="tp-travel-dialog-handle" />
          <h3 id={titleId} className="tp-travel-dialog-title">
            交通方式
          </h3>
          {(fromName || toName || distanceM) && (
            <p className="tp-travel-dialog-meta">
              {fromName && toName ? `${fromName} → ${toName}` : ''}
              {(fromName || toName) && typeof distanceM === 'number' && distanceM > 0 ? ' · ' : ''}
              {typeof distanceM === 'number' && distanceM > 0 ? formatKm(distanceM) : ''}
            </p>
          )}
          <div className="tp-travel-mode-list">
            {MODE_DEFINITIONS.map((def) => {
              const isSelected = selectedMode === def.mode;
              return (
                <button
                  key={def.mode}
                  type="button"
                  className={`tp-travel-mode-option ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleSelectMode(def.mode)}
                  aria-pressed={isSelected}
                  data-testid={`travel-mode-option-${def.mode}`}
                >
                  <span className="tp-travel-mode-option-icon" aria-hidden="true">
                    <Icon name={def.iconName} />
                  </span>
                  <span className="tp-travel-mode-option-body">
                    <span className="tp-travel-mode-option-label">{def.label}</span>
                    <span className="tp-travel-mode-option-meta">
                      {def.describe({
                        distanceM,
                        currentMin: isSelected && def.mode === currentMode ? currentMin : null,
                        isSelected: isSelected && def.mode === currentMode,
                      })}
                    </span>
                  </span>
                  {isSelected && (
                    <span className="tp-travel-mode-option-check" aria-hidden="true">
                      <Icon name="check" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedMode === 'transit' && (
            <div className="tp-travel-transit-input">
              <label className="tp-travel-transit-input-label" htmlFor={`tp-transit-min-${segmentId}`}>
                需要多少分鐘？
              </label>
              <input
                id={`tp-transit-min-${segmentId}`}
                className="tp-input-short"
                type="number"
                inputMode="numeric"
                min={1}
                max={1440}
                value={transitMin}
                onChange={(e) => handleTransitMinChange(e.target.value)}
                onBlur={handleTransitMinBlur}
                autoFocus
                data-testid="travel-transit-min-input"
              />
              <span className="tp-travel-transit-input-hint">範圍 1–1440 分鐘（24 小時內）</span>
            </div>
          )}

          {/* v2.33.143: SaveStatus 拔除 — silent auto-save，失敗走 toast (上方 useEffect)。 */}
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
