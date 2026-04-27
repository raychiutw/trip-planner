const SCOPED_STYLES = `
.tp-conflict-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(20, 14, 9, 0.42);
  display: grid;
  place-items: center;
  padding: 20px;
}
.tp-conflict-modal {
  width: min(420px, 100%);
  border-radius: var(--radius-xl);
  background: var(--color-background);
  color: var(--color-foreground);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
  padding: 18px;
}
.tp-conflict-eyebrow {
  margin: 0 0 8px;
  font-size: var(--font-size-eyebrow);
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-muted);
}
.tp-conflict-title {
  margin: 0;
  font-size: var(--font-size-title3);
  font-weight: 800;
}
.tp-conflict-copy {
  margin: 10px 0 0;
  font-size: var(--font-size-callout);
  line-height: 1.5;
  color: var(--color-muted);
}
.tp-conflict-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 16px;
}
.tp-conflict-actions button {
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
.tp-conflict-actions button.primary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-foreground);
}
.tp-conflict-actions button:hover {
  filter: brightness(0.98);
}
`;

export interface ConflictModalProps {
  open: boolean;
  conflictTitle?: string | null;
  time: string;
  onMoveAfter: () => void;
  onParallel: () => void;
  onCancel: () => void;
}

export default function ConflictModal({
  open,
  conflictTitle,
  time,
  onMoveAfter,
  onParallel,
  onCancel,
}: ConflictModalProps) {
  if (!open) return null;
  const title = conflictTitle?.trim() || '既有行程';
  return (
    <div className="tp-conflict-backdrop">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-conflict-modal" role="dialog" aria-modal="true" aria-label="時段衝突">
        <p className="tp-conflict-eyebrow">Time conflict</p>
        <h3 className="tp-conflict-title">此時段已有 {title}</h3>
        <p className="tp-conflict-copy">
          你選的 {time} 已有安排。請選擇換位置、併排，或取消這次拖曳。
        </p>
        <div className="tp-conflict-actions">
          <button type="button" className="primary" onClick={onMoveAfter}>換位置</button>
          <button type="button" onClick={onParallel}>併排</button>
          <button type="button" onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>
  );
}
