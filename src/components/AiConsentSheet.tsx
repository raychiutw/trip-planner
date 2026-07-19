/**
 * AiConsentSheet — ChatPage 送出時「owner 尚未授權 AI」的底部授權 sheet（跳出式）。
 *
 * 背景：AI 聊天送出 = 建 trip_request；後端 mint-restricted 要 owner 對 tp-request 的
 * Consent 才能以 owner 身分簽 token。一個「行程已存在、直接用 chat 問 AI」的 owner
 * 在「帳號 → 已連結應用」找不到授權入口（那頁只能撤銷），送出只會建一筆永遠 mint 不出
 * token 的請求、卡住整條佇列。此 sheet 在送出當下就地問要不要授權：
 *   - 授權並送出 → 上層 POST /api/account/ai-authorization 後續送原訊息
 *   - 取消 → 不建請求、保留輸入
 *
 * mockup（sign-off variant B）：docs/design-sessions/2026-07-15-chat-consent-gate.html
 * 視覺沿用 AiAuthorizeCard（.tp-ai-card 木棕 tone）。純呈現元件：consent 狀態、POST、
 * 送出邏輯都由 ChatPage 持有，這裡只吐兩個 callback。
 */
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSheetBehavior } from '../hooks/useSheetBehavior';

const SCOPED_STYLES = `
.tp-consent-backdrop {
  position: fixed; inset: 0;
  z-index: var(--z-modal, 9000);
  background: rgba(20, 14, 9, 0.42);
  display: flex; align-items: flex-end; justify-content: center;
  animation: tp-consent-backdrop-in 150ms var(--transition-timing-function-apple);
}
@keyframes tp-consent-backdrop-in { from { opacity: 0; } to { opacity: 1; } }

.tp-consent-sheet {
  width: min(480px, 100%);
  background: var(--color-background);
  color: var(--color-foreground);
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -8px 30px rgba(0,0,0,0.25);
  padding: 16px 16px max(20px, env(safe-area-inset-bottom));
  animation: tp-consent-sheet-in 260ms var(--transition-timing-function-apple);
}
@keyframes tp-consent-sheet-in { from { transform: translateY(40px); opacity: 0.4; } to { transform: none; opacity: 1; } }

/* G-S2：固定高度 sheet 不放 resize grabber（原 .tp-consent-grip 純裝飾、無拖動行為，已移除）。 */

/* 沿用 AiAuthorizeCard .tp-ai-card 視覺 */
.tp-consent-card { border-radius: var(--radius-xl); padding: 16px; background: var(--color-accent-subtle); }
.tp-consent-card__row { display: flex; gap: 12px; align-items: flex-start; }
.tp-consent-card__badge {
  flex: none; width: 38px; height: 38px; border-radius: var(--radius-lg);
  background: var(--color-accent); color: var(--color-accent-foreground);
  display: flex; align-items: center; justify-content: center;
}
.tp-consent-card__title { font-size: 15px; font-weight: 700; color: var(--color-foreground); }
.tp-consent-card__desc { font-size: 13px; color: var(--color-muted); margin-top: 3px; line-height: 1.5; }
.tp-consent-quoted {
  margin-top: 12px; padding: 10px 12px; border-radius: var(--radius-lg);
  background: var(--color-background); border: 1px solid var(--color-border);
  font-size: 13px; color: var(--color-foreground); word-break: break-word;
}
.tp-consent-quoted__lbl { font-size: var(--font-size-caption2); color: var(--color-muted); margin-bottom: 3px; }

.tp-consent-actions { margin-top: 14px; display: flex; flex-direction: column; gap: 9px; }
.tp-consent-btn {
  width: 100%; min-height: 48px; border: none; border-radius: var(--radius-lg);
  font: inherit; font-size: 15px; font-weight: 700; cursor: pointer;
}
.tp-consent-btn-primary { background: var(--color-accent); color: var(--color-accent-foreground); }
.tp-consent-btn-primary:disabled { opacity: 0.6; cursor: default; }
.tp-consent-btn-ghost { background: transparent; color: var(--color-muted); font-weight: 600; }
.tp-consent-err { margin-top: 8px; text-align: center; font-size: 12px; color: var(--color-accent-3-deep); }
.tp-consent-fineprint { margin-top: 4px; text-align: center; font-size: var(--font-size-caption2); color: var(--color-muted); }
`;

export interface AiConsentSheetProps {
  /** 是否顯示 */
  open: boolean;
  /** 將送出的訊息（引用預覽） */
  message: string;
  /** 授權進行中（POST 未 resolve）→ disable 主鈕 */
  busy?: boolean;
  /** 授權失敗訊息，null 時不顯示 */
  error?: string | null;
  /** 點「授權並送出」 */
  onAuthorizeAndSend: () => void;
  /** 點「取消」/ Escape / 點背景 */
  onCancel: () => void;
}

export default function AiConsentSheet({
  open,
  message,
  busy = false,
  error = null,
  onAuthorizeAndSend,
  onCancel,
}: AiConsentSheetProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  // 統一 sheet 引擎（B3）：body scroll-lock（G-S3，modal 預設 true）+ 開啟 focus 主鈕
  // + Escape（canDismiss=!busy 保留 busy 鎖，避免「看似取消卻仍在送出」）+ IME/巢狀 guard
  // + focus-trap。固定高度 sheet → 不放 grabber（G-S2）。
  const { panelRef, backdropRef, handlePanelKeyDown } = useSheetBehavior(open, onCancel, {
    initialFocusRef: primaryRef,
    canDismiss: !busy,
  });

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <style>{SCOPED_STYLES}</style>
      <div
        ref={backdropRef}
        className="tp-consent-backdrop"
        role="presentation"
        onClick={busy ? undefined : onCancel}
        data-testid="ai-consent-backdrop"
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          className="tp-consent-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tp-consent-title"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handlePanelKeyDown}
          data-testid="ai-consent-sheet"
        >
          <div className="tp-consent-card">
            <div className="tp-consent-card__row">
              <div className="tp-consent-card__badge" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l1.9 4.6L18.5 8l-4.6 1.9L12 14l-1.9-4.1L5.5 8l4.6-1.4L12 2z" />
                  <circle cx="18" cy="17" r="2.4" />
                </svg>
              </div>
              <div>
                <h4 className="tp-consent-card__title" id="tp-consent-title">讓 AI 幫你把行程填滿</h4>
                <p className="tp-consent-card__desc">
                  AI 需要你授權一次，才能以你的身分安排景點、餐廳、交通。可隨時在「已連結應用」撤銷。
                </p>
              </div>
            </div>
            <div className="tp-consent-quoted" data-testid="ai-consent-quoted">
              <div className="tp-consent-quoted__lbl">將送出這則訊息</div>
              {message}
            </div>
          </div>

          <div className="tp-consent-actions">
            <button
              ref={primaryRef}
              type="button"
              className="tp-consent-btn tp-consent-btn-primary"
              onClick={onAuthorizeAndSend}
              disabled={busy}
              data-testid="ai-consent-authorize"
            >
              {busy ? '授權中⋯' : '授權並送出'}
            </button>
            <button
              type="button"
              className="tp-consent-btn tp-consent-btn-ghost"
              onClick={onCancel}
              disabled={busy}
              data-testid="ai-consent-cancel"
            >
              取消
            </button>
          </div>

          {error && (
            <p className="tp-consent-err" data-testid="ai-consent-error">{error}</p>
          )}
          <p className="tp-consent-fineprint">授權對象：Tripline AI 行程排程</p>
        </div>
      </div>
    </>,
    document.body,
  );
}
