/**
 * AiDataConsentSheet — 就地「AI 資料同意」底部 sheet（spec #1553、ADR-0012；已簽核變體 A）。
 * 使用者在原畫面碰到受管制入口被擋時出現，同意後由上層接續原操作並保留輸入。
 * 與 AiConsentSheet（AI 操作授權）是兩個獨立概念。純呈現：狀態與 POST 都在上層（useAiDataConsent）。
 * 旅伴（共編者）送出不需同意，只有行程擁有者自己送出時才會被擋。
 */
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSheetBehavior } from '../hooks/useSheetBehavior';
import type { AiDataConsent } from '../hooks/useAiDataConsent';

export const CONSENT_STYLES = `
.tp-dc-backdrop { position: fixed; inset: 0; z-index: var(--z-modal, 9000); background: rgba(20,14,9,.42); display: flex; align-items: flex-end; justify-content: center; }
.tp-dc-sheet { width: min(480px, 100%); max-height: 86dvh; overflow: auto; background: var(--color-background); color: var(--color-foreground); border-radius: 22px 22px 0 0; box-shadow: 0 -8px 30px rgba(0,0,0,.25); padding: 16px 18px max(20px, env(safe-area-inset-bottom)); }
.tp-dc-title { font-size: 1.125rem; font-weight: 700; margin: 0 0 6px; letter-spacing: -0.01em; }
.tp-dc-lead { font-size: .875rem; color: var(--color-muted); margin: 0 0 12px; line-height: 1.5; }
.tp-dc-banner { border-radius: var(--radius-md); padding: 10px 12px; font-size: .8125rem; margin-bottom: 12px; background: var(--color-accent-subtle); }
.tp-dc-banner.warn { background: var(--color-destructive-bg); color: var(--color-destructive); }
.tp-dc-acc { border: 1px solid var(--color-border); border-radius: var(--radius-md); margin-bottom: 8px; }
.tp-dc-acc summary, .tp-dc-outer > summary { padding: 12px 14px; font-size: .875rem; font-weight: 600; cursor: pointer; min-height: var(--spacing-tap-min); display: flex; align-items: center; justify-content: space-between; list-style: none; }
.tp-dc-outer > summary { padding-left: 0; padding-right: 0; }
.tp-dc-acc summary::-webkit-details-marker, .tp-dc-outer > summary::-webkit-details-marker { display: none; }
.tp-dc-acc summary::after, .tp-dc-outer > summary::after { content: '›'; content: '›' / ''; color: var(--color-muted); transition: transform 150ms; }
.tp-dc-acc[open] > summary::after, .tp-dc-outer[open] > summary::after { transform: rotate(90deg); }
@media (prefers-reduced-motion: reduce) { .tp-dc-acc summary::after, .tp-dc-outer > summary::after { transition: none; } }
.tp-dc-acc ul { margin: 0; padding: 0 14px 12px 32px; font-size: .8125rem; line-height: 1.55; }
.tp-dc-row { display: flex; gap: 10px; margin-top: 12px; } .tp-dc-row > * { flex: 1; }
.tp-dc-btn { font: inherit; font-size: 1rem; font-weight: 600; min-height: var(--spacing-tap-min); padding: 12px 18px; border-radius: var(--radius-md); cursor: pointer; border: 1px solid var(--color-border); background: var(--color-background); color: var(--color-foreground); }
.tp-dc-btn.primary { background: var(--color-accent-fill); border-color: var(--color-accent-fill); color: var(--color-accent-foreground); }
.tp-dc-btn[disabled] { opacity: .5; cursor: default; }
.tp-dc-keep, .tp-dc-ver { font-size: .8125rem; color: var(--color-muted); margin: 10px 0 0; }
.tp-dc-ver { font-size: .75rem; margin-top: 6px; }
.tp-dc-err { margin-top: 8px; font-size: .8125rem; color: var(--color-destructive); }
`;

/** 說明已更新（stale）／已撤回（withdrawn）的橫幅；其他狀態不顯示。就地 sheet 與合併卡共用同一份文案。 */
export function ConsentStatusBanner({ status }: { status: AiDataConsent['status'] }) {
  if (status === 'stale') return <div className="tp-dc-banner" data-testid="ai-data-consent-banner"><b>說明已更新</b>：請重新確認後才能繼續使用 AI。你仍可使用不需要 AI 的功能。</div>;
  if (status === 'withdrawn') return <div className="tp-dc-banner" data-testid="ai-data-consent-banner">你先前已撤回同意。要再使用 AI 助理，請重新同意。</div>;
  return null;
}

/** 說明文字（server 回的那一份）：每個章節一個可展開區，第一個預設展開。 */
export function ConsentSections({ consent }: { consent: AiDataConsent }) {
  return <>{consent.text.sections.map((s, i) => (
    <details className="tp-dc-acc" key={s.heading} open={i === 0}>
      <summary>{s.heading}</summary>
      <ul>{s.items.map((it) => <li key={it}>{it}</li>)}</ul>
    </details>
  ))}</>;
}

export interface AiDataConsentSheetProps {
  open: boolean;
  consent: AiDataConsent;
  /** 被攔下、同意後會接續送出的訊息（有才顯示「已保留」提示） */
  message?: string;
  busy?: boolean;
  error?: string | null;
  onAccept: () => void;
  onDecline: () => void;
}

export default function AiDataConsentSheet({ open, consent, message, busy = false, error = null, onAccept, onDecline }: AiDataConsentSheetProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const { panelRef, backdropRef, handlePanelKeyDown } = useSheetBehavior(open, onDecline, { initialFocusRef: primaryRef, canDismiss: !busy });
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <style>{CONSENT_STYLES}</style>
      <div ref={backdropRef} className="tp-dc-backdrop" role="presentation" onClick={busy ? undefined : onDecline}>
        <div ref={panelRef} tabIndex={-1} className="tp-dc-sheet" role="dialog" aria-modal="true" aria-labelledby="tp-dc-title"
          onClick={(e) => e.stopPropagation()} onKeyDown={handlePanelKeyDown} data-testid="ai-data-consent-sheet">
          <h2 className="tp-dc-title" id="tp-dc-title">{consent.text.title}</h2>
          <ConsentStatusBanner status={consent.status} />
          <p className="tp-dc-lead">{consent.text.intro}</p>
          <ConsentSections consent={consent} />
          <div className="tp-dc-row">
            <button type="button" className="tp-dc-btn" onClick={onDecline} disabled={busy} data-testid="ai-data-consent-decline">暫不使用</button>
            <button ref={primaryRef} type="button" className="tp-dc-btn primary" onClick={onAccept} disabled={busy} data-testid="ai-data-consent-accept">{busy ? '處理中⋯' : '同意'}</button>
          </div>
          {message && <p className="tp-dc-keep" data-testid="ai-data-consent-keep">你輸入的內容已保留，同意後會自動接續送出</p>}
          <div className="tp-dc-ver" data-testid="ai-data-consent-version">版本 {consent.currentVersion}</div>
          {error && <p className="tp-dc-err" role="alert" data-testid="ai-data-consent-error">{error}</p>}
        </div>
      </div>
    </>,
    document.body,
  );
}
