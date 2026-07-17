/**
 * StackPanelHeader — rev2 共用堆疊面板 header（owner 2026-07-17 Image #4/#5）。
 *
 * 左上「‹」返上一層（前一頁）、右上「✕」關整疊（整個關閉，回地圖/AI 聊天）。
 * 桌機右欄堆疊面板 L3/L4 + 手機全頁 drill-down 共用（iOS Apple One 形制）。
 * L2 modal 語意（由下往上）只給 ✕、不給 back → 不傳 `onBack`。
 *
 * iOS navigation stack：「‹」永遠只退一階（L4→L3），「✕」才收整疊。
 */
import type { ReactNode } from 'react';
import Icon from '../shared/Icon';

export interface StackPanelHeaderProps {
  title?: ReactNode;
  /** 有值 → 顯示左上「‹」返上一層（前一頁）。L2 modal 不傳（只 close）。 */
  onBack?: () => void;
  /** 右上「✕」關整疊（整個關閉）。 */
  onClose: () => void;
}

export const STACK_PANEL_HEADER_STYLES = `
.tp-stack-head {
  display: flex; align-items: center; gap: 8px;
  height: 52px; padding: 0 8px 0 6px; flex-shrink: 0;
  border-bottom: 1px solid var(--color-border);
  /* 桌機右欄 panel / 手機全頁 drill-down 都以外層為 scroll container，header
   * 需 sticky top 才不隨內容捲走（比照 TitleBar sticky glass chrome）。 */
  position: sticky; top: 0; z-index: 3;
  background: color-mix(in srgb, var(--color-background) 88%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.tp-stack-head-btn {
  width: 38px; height: 38px; border-radius: var(--radius-full);
  display: grid; place-items: center; border: none; cursor: pointer;
  background: transparent; color: var(--color-foreground);
  transition: background 150ms var(--transition-timing-function-apple);
}
.tp-stack-head-btn:hover { background: var(--color-hover); }
.tp-stack-head-btn:focus-visible { outline: none; box-shadow: var(--shadow-ring); }
.tp-stack-head-btn .svg-icon { width: 20px; height: 20px; }
.tp-stack-head-title {
  flex: 1; min-width: 0; text-align: center;
  font-size: var(--font-size-callout); font-weight: 700;
  color: var(--color-foreground);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tp-stack-head-spacer { width: 38px; flex-shrink: 0; }
`;

export default function StackPanelHeader({ title, onBack, onClose }: StackPanelHeaderProps) {
  return (
    <>
      <style>{STACK_PANEL_HEADER_STYLES}</style>
      <div className="tp-stack-head" data-testid="stack-panel-header">
        {onBack ? (
          <button
            type="button"
            className="tp-stack-head-btn"
            aria-label="返回上一層"
            onClick={onBack}
            data-testid="stack-panel-back"
          >
            <Icon name="arrow-left" />
          </button>
        ) : (
          <span className="tp-stack-head-spacer" aria-hidden="true" />
        )}
        {title ? (
          <span className="tp-stack-head-title">{title}</span>
        ) : (
          <span style={{ flex: 1 }} aria-hidden="true" />
        )}
        <button
          type="button"
          className="tp-stack-head-btn"
          aria-label="關閉"
          onClick={onClose}
          data-testid="stack-panel-close"
        >
          <Icon name="x-mark" />
        </button>
      </div>
    </>
  );
}
