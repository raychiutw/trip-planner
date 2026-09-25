/** Inline chat consent layout selected in #1348 prototype C. Content comes from the server. */
import { useEffect, useState } from 'react';

export interface AiDataDisclosure {
  version: string;
  title: string;
  processor: string;
  dataCategories: string[];
  purpose: string;
  revocation: string;
}
export interface AiDataConsentState {
  disclosure: AiDataDisclosure | null;
  status: 'unconfigured' | 'not_accepted' | 'current' | 'outdated' | 'revoked' | 'declined';
  acceptedVersion: string | null;
  acceptedAt: string | null;
  decidedAt: string | null;
}

const STYLES = `
.tp-ai-data-card{margin:8px 14px 0;padding:18px;background:var(--color-background);border:1px solid var(--color-border);border-radius:var(--radius-xl);box-shadow:0 4px 16px rgba(42,31,24,.08);color:var(--color-foreground);flex-shrink:0;max-height:60vh;overflow-y:auto}
.tp-ai-data-card h2{font-size:var(--font-size-headline);margin:0 0 8px;font-weight:700}
.tp-ai-data-card p{font-size:var(--font-size-footnote);line-height:1.5;margin:0 0 12px;color:var(--color-muted)}
.tp-ai-data-details{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin:12px 0}
.tp-ai-data-details div{border-bottom:1px solid var(--color-border);padding:8px 0;font-size:var(--font-size-footnote);line-height:1.5}
.tp-ai-data-details strong{display:block;font-weight:700;color:var(--color-foreground)}
.tp-ai-data-quote{background:var(--color-secondary);padding:10px;border-radius:var(--radius-lg);overflow-wrap:anywhere}
.tp-ai-data-check{display:flex;gap:9px;align-items:flex-start;margin:14px 0;font-size:var(--font-size-footnote);line-height:1.5}
.tp-ai-data-check input{flex:none;width:20px;height:20px;accent-color:var(--color-accent-fill)}
.tp-ai-data-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
.tp-ai-data-actions button{min-height:44px;border-radius:var(--radius-lg);padding:8px 14px;font:inherit;font-weight:700}
.tp-ai-data-primary{border:0;background:var(--color-accent-fill);color:var(--color-accent-foreground)}
.tp-ai-data-primary:disabled{opacity:.55}.tp-ai-data-secondary{border:1px solid var(--color-border);background:transparent;color:var(--color-foreground)}
.tp-ai-data-error{color:var(--color-destructive)!important}
.tp-ai-data-revoke{border:1px solid var(--color-destructive)!important;color:var(--color-destructive)!important;background:transparent!important}
@media(max-width:600px){.tp-ai-data-details{grid-template-columns:1fr}.tp-ai-data-card{padding:15px;margin:8px 10px 0}}
`;

export default function AiDataConsentCard({ state, message, busy, error, onAccept, onDecline, onRevoke, onRetry, onCancel }: {
  state: AiDataConsentState | null;
  message: string;
  busy: boolean;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onRevoke: () => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState(false);
  useEffect(() => setChecked(false), [state?.disclosure?.version]);
  const disclosure = state?.disclosure;
  return <section className="tp-ai-data-card" aria-labelledby="tp-ai-data-title" data-testid="ai-data-consent-card">
    <style>{STYLES}</style>
    <h2 id="tp-ai-data-title">{message ? '送出前，先確認 AI 資料使用' : 'AI 資料同意管理'}</h2>
    {!disclosure ? <>
      <p>目前無法取得資料處理說明。訊息會保留，請稍後重試。</p>
      <div className="tp-ai-data-actions"><button className="tp-ai-data-secondary" type="button" onClick={onCancel}>稍後再說</button><button className="tp-ai-data-primary" type="button" onClick={onRetry} disabled={busy}>重新載入</button></div>
    </> : <>
      <p>{disclosure.title} · 版本 {disclosure.version}</p>
      {state?.status === 'current' && <p>你已同意目前版本；撤回後，新的 AI 請求將停止接受。</p>}
      <div className="tp-ai-data-details">
        <div><strong>處理方</strong>{disclosure.processor}</div>
        <div><strong>資料類別</strong>{disclosure.dataCategories.join('、')}</div>
        <div><strong>用途</strong>{disclosure.purpose}</div>
        <div><strong>撤回方式</strong>{disclosure.revocation}</div>
      </div>
      {message && <p className="tp-ai-data-quote">待送出：「{message}」</p>}
      {state?.status !== 'current' && <label className="tp-ai-data-check"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} disabled={busy} />我已閱讀並同意此版本 AI 資料處理說明</label>}
      {error && <p role="alert" className="tp-ai-data-error">{error}</p>}
      <div className="tp-ai-data-actions">
        {state?.status === 'current' ? <><button className="tp-ai-data-secondary" type="button" onClick={onCancel}>返回聊天</button><button className="tp-ai-data-revoke" type="button" onClick={onRevoke} disabled={busy}>撤回 AI 資料同意</button></> : <><button className="tp-ai-data-secondary" type="button" onClick={onDecline} disabled={busy}>拒絕，保留訊息</button><button className="tp-ai-data-primary" type="button" onClick={onAccept} disabled={!checked || busy}>{busy ? '儲存中⋯' : message ? '同意並送出' : '同意此版本'}</button></>}
      </div>
    </>}
  </section>;
}
