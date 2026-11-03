/**
 * ChangePasswordPage — 已登入的「變更密碼」（flutter#529）
 *
 * Route: /account/password
 * 成功後後端會登出其他裝置、保留目前這台；這裡只負責表單、前端檢查與錯誤呈現。
 * 與「忘記密碼」（寄信重設）是兩件事。
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { apiFetch } from '../lib/apiClient';
import { ApiError } from '../lib/errors';
import { showToast } from '../components/shared/Toast';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';

const MIN_LEN = 8;

const SCOPED_STYLES = `
.tp-chgpw-shell { min-height: 100%; background: var(--color-secondary); overflow-y: auto; }
.tp-chgpw-inner { max-width: 480px; margin: 0 auto; padding: 24px 16px 64px; }
.tp-chgpw-form {
  background: var(--color-background); border: 1px solid var(--color-border);
  border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 16px;
}
.tp-chgpw-field { display: flex; flex-direction: column; gap: 6px; }
.tp-chgpw-field label { font-size: var(--font-size-callout); font-weight: 700; color: var(--color-foreground); }
.tp-chgpw-field input {
  font: inherit; padding: 10px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-md); background: var(--color-background); color: var(--color-foreground);
}
.tp-chgpw-helper, .tp-chgpw-error { font-size: var(--font-size-footnote); margin: 0; }
.tp-chgpw-helper { color: var(--color-muted); }
.tp-chgpw-error { color: var(--color-destructive); }
.tp-chgpw-toggle { align-self: flex-start; background: none; border: 0; padding: 0; font: inherit;
  font-size: var(--font-size-footnote); color: var(--color-accent); cursor: pointer; }
`;

/** 後端錯誤碼 → 畫面文案；其餘（含網路失敗）一律通用的「稍後再試」。 */
function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'CHANGE_PASSWORD_CURRENT_INVALID':
      case 'CHANGE_PASSWORD_TOO_SHORT':
      case 'CHANGE_PASSWORD_SAME':
      case 'CHANGE_PASSWORD_NO_PASSWORD':
      case 'CHANGE_PASSWORD_RATE_LIMITED':
        return err.message;
    }
  }
  return '無法變更密碼，請稍後再試';
}

export default function ChangePasswordPage() {
  useRequireAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!current) { setError('請輸入目前密碼'); return; }
    if (next.length < MIN_LEN) { setError(`新密碼至少 ${MIN_LEN} 字元`); return; }
    if (next === current) { setError('新密碼不能和目前密碼相同'); return; }
    setError(null);
    setBusy(true);
    try {
      await apiFetch('/account/password', {
        method: 'POST',
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      showToast('密碼已更新，其他裝置已登出', 'success');
      navigate('/account');
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }

  const main = (
    <div className="tp-chgpw-shell" data-testid="change-password-page">
      <TitleBar title="變更密碼" back={() => navigate('/account')} />
      <div className="tp-chgpw-inner">
        <form className="tp-chgpw-form" onSubmit={onSubmit} noValidate>
          <div className="tp-chgpw-field">
            <label htmlFor="chgpw-current">目前密碼</label>
            <input id="chgpw-current" data-testid="change-password-current" type="password"
              autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="tp-chgpw-field">
            <label htmlFor="chgpw-new">新密碼</label>
            <input id="chgpw-new" data-testid="change-password-new" type={show ? 'text' : 'password'}
              autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            <button type="button" className="tp-chgpw-toggle" data-testid="change-password-toggle"
              onClick={() => setShow((v) => !v)}>{show ? '隱藏密碼' : '顯示密碼'}</button>
            <p className="tp-chgpw-helper">至少 {MIN_LEN} 字元。變更後，其他裝置會被登出，這台維持登入。</p>
          </div>
          {error && <p className="tp-chgpw-error" role="alert">{error}</p>}
          <button type="submit" className="tp-btn tp-btn-primary" data-testid="change-password-submit" disabled={busy}>
            {busy ? '處理中…' : '變更密碼'}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <AppShell sidebar={<DesktopSidebarConnected />} main={main} bottomNav={<GlobalBottomNav authed={true} />} />
    </>
  );
}
