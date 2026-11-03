/**
 * AiDataConsentSettings — 帳號設定「AI 與資料」區塊（spec #1553、ADR-0012；已簽核變體 B：卡片＋紀錄）。
 * 查看目前狀態與已同意版本、重新同意、撤回。enforced=false（旗標關或文案未填妥）整區不顯示。
 * 撤回前先確認，並照 server 文字如實說明撤回的效力範圍。
 * shortcut: 紀錄只顯示「目前已同意的版本與時間」，沒有歷史事件列表（API 只回最新狀態）；要完整時間軸需另開 history 端點。
 */
import { useRef, useState } from 'react';
import { useAiDataConsent } from '../hooks/useAiDataConsent';
import AiDataConsentSheet, { CONSENT_STYLES, ConsentSections } from './AiDataConsentSheet';

const HEAD = { valid: 'AI 助理已開啟', stale: 'AI 助理已暫停：說明已更新', withdrawn: 'AI 助理已關閉', none: 'AI 助理尚未開啟' } as const;

export default function AiDataConsentSettings() {
  const { consent, accept, withdraw } = useAiDataConsent();
  const [sheet, setSheet] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null); // 撤回的錯誤（頁面內）
  const [sheetError, setSheetError] = useState<string | null>(null); // 同意的錯誤（顯示在 sheet 內，避免頁面背後重複一份）
  const withdrawRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  if (!consent?.enforced) return null;

  async function run(fn: () => Promise<void>, done: () => void, msg: string, set: (m: string | null) => void) {
    setBusy(true); set(null);
    try { await fn(); done(); } catch { set(msg); } finally { setBusy(false); }
  }
  // 確認區出現／收起時移動焦點（原按鈕被卸載，焦點會掉到 body）
  const openConfirm = () => { setConfirming(true); setTimeout(() => confirmRef.current?.focus(), 0); };
  const closeConfirm = () => { setConfirming(false); setTimeout(() => withdrawRef.current?.focus(), 0); };
  const valid = consent.status === 'valid';
  const when = consent.acceptedAt ? new Date(consent.acceptedAt).toLocaleDateString('zh-TW') : '';

  return (
    <section className="tp-dc-settings" data-testid="ai-data-settings" aria-label="AI 與資料">
      <style>{CONSENT_STYLES}{`.tp-dc-settings { border-radius: var(--radius-xl); padding: 16px; background: var(--color-accent-subtle); display: flex; flex-direction: column; gap: 8px; }`}</style>
      <h3 className="tp-dc-title" style={{ margin: 0 }}>AI 與資料</h3>
      <div data-testid="ai-data-settings-status" style={{ fontWeight: 600 }}>
        {HEAD[consent.status]}{valid && ` · 版本 ${consent.acceptedVersion}`}
      </div>
      <p className="tp-dc-lead" style={{ margin: 0 }}>
        {valid ? `你在 ${when} 同意了這個版本。` : '同意前，AI 聊天、行程健檢與 AI 筆記無法使用；其餘功能不受影響。'}
      </p>
      <details className="tp-dc-acc" data-testid="ai-data-settings-text" style={{ background: 'var(--color-background)' }}>
        <summary>查看目前的說明（版本 {consent.currentVersion}）</summary>
        <div style={{ padding: '0 8px 8px' }}><ConsentSections consent={consent} /></div>
      </details>
      {valid ? (
        confirming ? (
          <div ref={confirmRef} tabIndex={-1} role="group" aria-label="確認撤回同意" data-testid="ai-data-withdraw-confirm">
            <p className="tp-dc-lead">撤回同意？</p>
            <ul className="tp-dc-lead" style={{ paddingLeft: 18 }}>{consent.text.withdrawal.map((w) => <li key={w}>{w}</li>)}</ul>
            <div className="tp-dc-row">
              <button type="button" className="tp-dc-btn" onClick={closeConfirm} disabled={busy}>取消</button>
              <button type="button" className="tp-dc-btn" style={{ color: 'var(--color-destructive)' }} disabled={busy} data-testid="ai-data-withdraw-confirm-yes"
                onClick={() => run(withdraw, closeConfirm, '撤回失敗，請稍後再試。', setError)}>撤回同意</button>
            </div>
          </div>
        ) : (
          <button ref={withdrawRef} type="button" className="tp-dc-btn" style={{ color: 'var(--color-destructive)' }} onClick={openConfirm} data-testid="ai-data-settings-withdraw">撤回同意</button>
        )
      ) : (
        <button type="button" className="tp-dc-btn primary" onClick={() => setSheet(true)} data-testid="ai-data-settings-open">查看說明並同意</button>
      )}
      {error && <p className="tp-dc-err" role="alert" data-testid="ai-data-settings-error">{error}</p>}
      <AiDataConsentSheet open={sheet} consent={consent} busy={busy} error={sheetError} onDecline={() => { setSheet(false); setSheetError(null); }}
        onAccept={() => run(accept, () => setSheet(false), '同意失敗，請稍後再試。', setSheetError)} />
    </section>
  );
}
