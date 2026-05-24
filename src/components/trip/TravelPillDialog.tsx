/**
 * TravelPillDialog — v2.24.0 segment travel mode picker.
 *
 * Mobile (<760px)：bottom sheet 由下滑出。
 * Desktop：popover anchored 相對於 trigger（外層自處理位置；本 component 純 render dialog body
 * + overlay）。
 *
 * 三選一：driving / walking / transit。Save → PATCH /api/trips/:id/segments/:sid。
 *
 * v2.30.0：
 *   - driving / walking → backend 一律打 Google Routes 重算（ignore body.min）
 *   - transit → user 手填分鐘（1–1440），backend save 為 source='manual'（Japan
 *     Google Routes API 沒 transit 資料）
 *
 * 對齊 docs/design-sessions/2026-05-07-travel-pill-tap-switch.html。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../shared/Icon';
import { apiFetchRaw } from '../../lib/apiClient';
import { EVENT } from '../../lib/events';
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
  border-radius: 2px;
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
.tp-travel-dialog-error {
  margin-top: 8px;
  font-size: var(--font-size-footnote);
  color: var(--color-destructive);
}
.tp-travel-dialog-footer {
  display: flex; gap: 8px;
  margin-top: 16px;
}
.tp-travel-dialog-btn {
  flex: 1;
  min-height: var(--spacing-tap-min, 44px);
  padding: 10px 16px;
  border-radius: var(--radius-full);
  font: inherit; font-size: var(--font-size-body); font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}
.tp-travel-dialog-btn-primary {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  border-color: var(--color-accent);
}
.tp-travel-dialog-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.tp-travel-dialog-btn-secondary {
  background: transparent;
  color: var(--color-muted);
  border-color: var(--color-border);
}
`;

export interface TravelPillDialogProps {
  tripId: string;
  segmentId: number;
  /** 當前 mode（從 segments endpoint 來） */
  currentMode: TravelMode;
  /** 當前 min（顯示在現選 mode option 描述） */
  currentMin?: number | null;
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

export default function TravelPillDialog({
  tripId,
  segmentId,
  currentMode,
  currentMin,
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const titleId = `tp-travel-dialog-title-${segmentId}`;

  // ESC 關閉
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 自動聚焦第一個 option（mount 後）
  useEffect(() => {
    const first = overlayRef.current?.querySelector<HTMLButtonElement>('.tp-travel-mode-option');
    first?.focus();
  }, []);

  const transitMinNumber = useMemo(() => {
    const n = parseInt(transitMin, 10);
    return Number.isFinite(n) ? n : NaN;
  }, [transitMin]);

  const isTransitMinValid =
    selectedMode !== 'transit' ||
    (Number.isFinite(transitMinNumber) && transitMinNumber >= 1 && transitMinNumber <= 1440);

  const isDirty =
    selectedMode !== currentMode ||
    (selectedMode === 'transit' && transitMinNumber !== currentMin);

  const canSubmit = !submitting && isDirty && isTransitMinValid;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const body: { mode: TravelMode; min?: number } = { mode: selectedMode };
    if (selectedMode === 'transit') {
      body.min = transitMinNumber;
    }
    try {
      const res = await apiFetchRaw(
        `/trips/${encodeURIComponent(tripId)}/segments/${segmentId}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`PATCH 失敗 (${res.status}): ${text.slice(0, 160)}`);
      }
      onSaved?.({
        mode: selectedMode,
        min: selectedMode === 'transit' ? transitMinNumber : (currentMin ?? null),
      });
      window.dispatchEvent(new CustomEvent(EVENT.segmentUpdated, { detail: { tripId, segmentId } }));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗');
      setSubmitting(false);
    }
  }, [canSubmit, selectedMode, transitMinNumber, tripId, segmentId, currentMin, onSaved, onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
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
                  onClick={() => setSelectedMode(def.mode)}
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
                onChange={(e) => setTransitMin(e.target.value)}
                autoFocus
                data-testid="travel-transit-min-input"
              />
              <span className="tp-travel-transit-input-hint">範圍 1–1440 分鐘（24 小時內）</span>
            </div>
          )}

          {error && (
            <div className="tp-travel-dialog-error" role="alert">
              {error}
            </div>
          )}

          <div className="tp-travel-dialog-footer">
            <button
              type="button"
              className="tp-travel-dialog-btn tp-travel-dialog-btn-secondary"
              onClick={onClose}
              data-testid="travel-dialog-cancel"
            >
              取消
            </button>
            <button
              type="button"
              className="tp-travel-dialog-btn tp-travel-dialog-btn-primary"
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
              data-testid="travel-dialog-save"
            >
              {submitting ? '儲存中…' : isDirty ? '儲存' : '無變更'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
