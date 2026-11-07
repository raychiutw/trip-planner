/**
 * ChangePasswordPage — 已登入的「變更密碼」（flutter#529）
 *
 * Route: /account/password
 * 版面：設定列式（inset grouped）＋標題列右上角主要動作（本 repo 表單頁慣例；owner 選定的變體 B，
 * 並依 Apple HIG／WCAG 研究調整，見 docs/research/2026-11-03-change-password-apple-hig.md）。
 * 成功後後端會登出其他裝置、保留目前這台；這裡只負責表單、前端檢查與錯誤呈現。
 * 與「忘記密碼」（寄信重設）是兩件事。
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { apiFetch } from '../lib/apiClient';
import { ApiError, formatWait } from '../lib/errors';
import { isNewApiAuthEnabled } from '../lib/auth';
import { useAccountPreview } from '../hooks/useAccountPreview';
import { CHANGE_PASSWORD_MIN_LENGTH, ERROR_MESSAGES } from '../types/api';
import { showToast } from '../components/shared/Toast';
import PasswordToggle, { usePasswordVisibility } from '../components/auth/PasswordToggle';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import TitleBarPrimaryAction from '../components/shell/TitleBarPrimaryAction';

const SCOPED_STYLES = `
.tp-chgpw-shell { min-height: 100%; background: var(--color-secondary); overflow-y: auto; }
.tp-chgpw-inner { max-width: 640px; margin: 0 auto; padding: 16px 16px 64px; }
.tp-chgpw-group { background: var(--color-background); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
.tp-chgpw-row { display: grid; grid-template-columns: 7rem 1fr auto; align-items: center; gap: 8px; padding: 4px 16px; min-height: 52px; }
.tp-chgpw-row + .tp-chgpw-row { border-top: 1px solid var(--color-border); }
/* 群組不裁切（outline 要畫在列外），圓角改由首尾列自己負責 */
.tp-chgpw-row:first-child { border-radius: var(--radius-lg) var(--radius-lg) 0 0; }
.tp-chgpw-row:last-child { border-radius: 0 0 var(--radius-lg) var(--radius-lg); }
/* 輸入框自己不畫外框，焦點指示畫在整列上（WCAG 2.4.7：焦點必須看得見，不能只靠底色） */
.tp-chgpw-row:focus-within { position: relative; z-index: 1; background: var(--color-accent-subtle); outline: 2px solid var(--color-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--color-background); }
.tp-chgpw-row label { font-weight: 600; }
/* 16px：iOS Safari 對小於 16px 的輸入框聚焦時會自動放大頁面 */
.tp-chgpw-row input { border: 0; background: transparent; font: inherit; font-size: 16px; color: inherit; padding: 12px 0; outline: none; min-width: 0; }
.tp-chgpw-row .tp-pw-toggle { align-self: center; }
.tp-chgpw-foot, .tp-chgpw-error { margin: 8px 16px 0; font-size: var(--font-size-footnote); }
.tp-chgpw-foot { color: var(--color-muted); }
.tp-chgpw-error { color: var(--color-destructive); }
@media (max-width: 480px) { .tp-chgpw-row { grid-template-columns: 5.5rem 1fr auto; } }
`;

/** 後端的 CHANGE_PASSWORD_* 錯誤碼已登記人話文案（types/api.ts）；429 帶 Retry-After 時告訴使用者要等多久。 */
function messageFor(err: unknown): string {
  if (err instanceof ApiError && err.code === 'CHANGE_PASSWORD_RATE_LIMITED' && err.retryAfter) {
    return `嘗試次數過多，請在 ${formatWait(err.retryAfter)}後再試`;
  }
  if (err instanceof ApiError && err.code.startsWith('CHANGE_PASSWORD_')) return err.message;
  return '無法變更密碼，請稍後再試';
}

export default function ChangePasswordPage() {
  const { user } = useRequireAuth();
  const navigate = useNavigate();
  // 進入守衛：端點只存在於新 api（旗標開啟），而且只有有 local 密碼的帳號能改；
  // 其餘（含預覽取失敗，無法確認）一律導回帳號頁，不顯示一張必定失敗的表單。
  const newApi = isNewApiAuthEnabled();
  const { status, preview } = useAccountPreview(!!user && newApi);
  const allowed = newApi && preview?.hasPassword === true;
  const denied = !newApi || (status === 'error' && !preview) || (status === 'ready' && preview?.hasPassword !== true);
  useEffect(() => { if (denied) navigate('/account', { replace: true }); }, [denied, navigate]);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const pw = usePasswordVisibility();
  const [busy, setBusy] = useState(false);
  /** 後端回的錯誤與它屬於哪一欄（目前密碼錯標在目前密碼，其餘標在新密碼）；使用者改動任一欄就清掉。 */
  const [server, setServer] = useState<{ message: string; field: 'current' | 'next' } | null>(null);
  /** 本地規則（過短、與目前相同）離開新密碼欄位後，或按下主要動作後才顯示；打字中不跳錯。 */
  const [showLocal, setShowLocal] = useState(false);

  const localError = !next ? null
    : next.length < CHANGE_PASSWORD_MIN_LENGTH ? ERROR_MESSAGES.CHANGE_PASSWORD_TOO_SHORT
    : next === current ? ERROR_MESSAGES.CHANGE_PASSWORD_SAME
    : null;
  const shown = server ?? (showLocal && localError ? { message: localError, field: 'next' as const } : null);

  function edit(setter: (v: string) => void, v: string) {
    setter(v);
    setServer(null);
  }

  async function submit() {
    if (busy || !current || !next) return;
    if (localError) { setShowLocal(true); return; }
    setBusy(true);
    try {
      await apiFetch('/account/password', {
        method: 'POST',
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      showToast('密碼已更新，其他裝置已登出', 'success');
      navigate('/account');
    } catch (err) {
      setServer({
        message: messageFor(err),
        field: err instanceof ApiError && err.code === 'CHANGE_PASSWORD_CURRENT_INVALID' ? 'current' : 'next',
      });
      setBusy(false);
    }
  }

  const invalid = (field: 'current' | 'next') => (shown?.field === field ? true : undefined);
  const describedBy = (field: 'current' | 'next') => (shown?.field === field ? 'chgpw-error' : undefined);

  if (!allowed) return null;

  const main = (
    <div className="tp-chgpw-shell" data-testid="change-password-page">
      <TitleBar
        title="變更密碼"
        back={() => navigate('/account')}
        actions={(
          <TitleBarPrimaryAction
            label="變更"
            busyLabel="處理中…"
            busy={busy}
            disabled={!current || !next}
            onClick={() => void submit()}
            testId="change-password-submit"
          />
        )}
      />
      <div className="tp-chgpw-inner">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); void submit(); }} noValidate>
          <div className="tp-chgpw-group">
            <div className="tp-chgpw-row">
              <label htmlFor="chgpw-current">目前密碼</label>
              <input id="chgpw-current" data-testid="change-password-current" type="password" placeholder="必填"
                autoComplete="current-password" value={current} onChange={(e) => edit(setCurrent, e.target.value)}
                aria-invalid={invalid('current')} aria-describedby={describedBy('current')} />
            </div>
            <div className="tp-chgpw-row">
              <label htmlFor="chgpw-new">新密碼</label>
              <input id="chgpw-new" data-testid="change-password-new" type={pw.type} placeholder="必填"
                autoComplete="new-password" value={next} onChange={(e) => edit(setNext, e.target.value)}
                onBlur={() => setShowLocal(true)}
                aria-invalid={invalid('next')} aria-describedby={describedBy('next')} />
              <PasswordToggle {...pw.toggleProps} testId="change-password-toggle" />
            </div>
          </div>
          {/* 表單的預設送出鈕：主要動作在標題列（表單外），這顆讓 Enter 鍵可以送出 */}
          <button type="submit" hidden tabIndex={-1} />
        </form>
        {shown && <p id="chgpw-error" className="tp-chgpw-error" role="alert">{shown.message}</p>}
        {/* 常駐說明：規則不能只放在 placeholder（輸入後就消失） */}
        <p className="tp-chgpw-foot">新密碼至少 {CHANGE_PASSWORD_MIN_LENGTH} 字元。變更後，其他裝置會被登出，這台維持登入。</p>
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
