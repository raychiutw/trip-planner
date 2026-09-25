import type { UseCurrentUserResult } from '../../hooks/useCurrentUser';

/** Unknown authentication is recoverable; only the guard's confirmed 401 redirects. */
export default function AuthStatus({ auth }: { auth: Pick<UseCurrentUserResult, 'error' | 'reload'> }) {
  return (
    <div className="p-4" data-testid="auth-status">
      <p role={auth.error ? 'alert' : 'status'}>
        {auth.error ? '無法確認登入狀態，請重試。' : '確認登入狀態…'}
      </p>
      {/* Keep the same focus target while retrying; aria-disabled prevents focus loss. */}
      <button type="button" className="tp-btn tp-btn-secondary" aria-disabled={!auth.error}
        onClick={() => { if (auth.error) auth.reload(); }}>
        重試登入狀態
      </button>
    </div>
  );
}
