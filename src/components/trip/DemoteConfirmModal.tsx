/**
 * DemoteConfirmModal — drag entry → Ideas section 後彈出的 destructive 確認。
 *
 * Spec: openspec/changes/ideas-drag-to-itinerary/specs/drag-to-reorder/spec.md
 *   Scenario: Demote 確認 modal（destructive）
 *   "drop 到 Ideas section → 彈 modal「確認移回 Ideas？時段資訊會清除」
 *    with 確認 / 取消 button"。
 */

const SCOPED_STYLES = `
.tp-demote-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(20, 14, 9, 0.42);
  display: grid;
  place-items: center;
  padding: 20px;
}
.tp-demote-modal {
  width: min(420px, 100%);
  border-radius: var(--radius-xl);
  background: var(--color-background);
  color: var(--color-foreground);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
  padding: 18px;
}
.tp-demote-eyebrow {
  margin: 0 0 8px;
  font-size: var(--font-size-eyebrow);
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-priority-high-dot);
}
.tp-demote-title {
  margin: 0;
  font-size: var(--font-size-title3);
  font-weight: 800;
}
.tp-demote-copy {
  margin: 10px 0 0;
  font-size: var(--font-size-callout);
  line-height: 1.5;
  color: var(--color-muted);
}
.tp-demote-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 16px;
}
.tp-demote-actions button {
  flex: 1;
  min-width: 112px;
  min-height: var(--spacing-tap-min);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-secondary);
  color: var(--color-foreground);
  font: inherit;
  font-size: var(--font-size-footnote);
  font-weight: 800;
  cursor: pointer;
}
.tp-demote-actions button.danger {
  background: var(--color-priority-high-dot);
  border-color: var(--color-priority-high-dot);
  color: var(--color-priority-high-foreground, #fff);
}
.tp-demote-actions button:hover {
  filter: brightness(0.98);
}
`;

export interface DemoteConfirmModalProps {
  open: boolean;
  entryTitle?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DemoteConfirmModal({ open, entryTitle, onConfirm, onCancel }: DemoteConfirmModalProps) {
  if (!open) return null;
  const title = entryTitle?.trim() || '此景點';
  return (
    <div className="tp-demote-backdrop">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-demote-modal" role="alertdialog" aria-modal="true" aria-label="確認移回 Ideas">
        <p className="tp-demote-eyebrow">Move back to Ideas</p>
        <h3 className="tp-demote-title">確認移回 Ideas？</h3>
        <p className="tp-demote-copy">
          「{title}」的時段資訊會清除，景點本身會留在 Ideas 清單。此操作無法直接 undo。
        </p>
        <div className="tp-demote-actions">
          <button type="button" className="danger" onClick={onConfirm}>確認移回</button>
          <button type="button" onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>
  );
}
