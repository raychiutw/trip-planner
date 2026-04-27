/**
 * InvitePage — V2 共編邀請接受 UI
 *
 * URL: /invite?token=<rawToken>
 *
 * 流程：
 *   1. mount → fetch GET /api/invitations?token=...（公開 endpoint，未登入也可預覽）
 *   2. parallel: useCurrentUser → 知道是否已登入 + 哪個 email
 *   3. 三種主分支：
 *      a. error (410 / 400) → 顯示錯誤 + 「請聯絡邀請者重寄」
 *      b. logged-in + email match → 「接受邀請」 button → POST /accept → redirect /trips?selected=:tripId
 *      c. logged-in + email mismatch → 「此邀請不屬於你的帳號」
 *      d. anonymous → 兩個 CTA「登入並加入」 / 「註冊並加入」（query 含 invitation token）
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useCurrentUser';

const SCOPED_STYLES = `
.tp-invite-shell {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 100dvh; padding: 48px 24px;
}
.tp-invite-card {
  max-width: 480px; width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-background);
  padding: 32px 28px;
  display: flex; flex-direction: column; gap: 20px;
}
.tp-invite-eyebrow {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--color-muted);
  text-align: center;
}
.tp-invite-title {
  font-size: var(--font-size-title2); font-weight: 800;
  line-height: 1.3; text-align: center;
}
.tp-invite-trip-name { color: var(--color-accent); }
.tp-invite-body {
  font-size: var(--font-size-callout);
  color: var(--color-muted);
  text-align: center;
}
.tp-invite-cta {
  display: flex; flex-direction: column; gap: 10px;
}
.tp-invite-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 12px 20px;
  font: inherit; font-size: var(--font-size-callout); font-weight: 700;
  border-radius: var(--radius-md);
  cursor: pointer; min-height: var(--spacing-tap-min);
  text-decoration: none;
  transition: opacity 120ms;
}
.tp-invite-btn-primary {
  background: var(--color-accent); color: var(--color-accent-foreground);
  border: 1px solid var(--color-accent);
}
.tp-invite-btn-secondary {
  background: var(--color-background); color: var(--color-foreground);
  border: 1px solid var(--color-border);
}
.tp-invite-btn:hover { opacity: 0.85; }
.tp-invite-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.tp-invite-error {
  padding: 12px 16px; border-radius: var(--radius-md);
  background: var(--color-destructive-bg, #fee2e2);
  color: var(--color-destructive, #991b1b);
  font-size: var(--font-size-callout);
}
.tp-invite-hint {
  font-size: var(--font-size-footnote);
  color: var(--color-muted); text-align: center;
}
`;

interface InvitationDetails {
  tripId: string;
  tripTitle: string;
  invitedEmail: string;
  inviterDisplayName: string | null;
  inviterEmail: string;
  expiresAt: string;
}

type FetchState =
  | { status: 'loading' }
  | { status: 'ok'; data: InvitationDetails }
  | { status: 'error'; code: string; message: string };

export default function InvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { user } = useCurrentUser();
  const [state, setState] = useState<FetchState>({ status: 'loading' });
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', code: 'INVITATION_TOKEN_MISSING', message: '邀請連結無效（缺少 token）' });
      return;
    }
    let cancelled = false;
    fetch(`/api/invitations?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (cancelled) return;
        const json = (await res.json()) as
          | InvitationDetails
          | { error: { code: string; message: string } };
        if (!res.ok) {
          const errObj = (json as { error: { code: string; message: string } }).error;
          setState({
            status: 'error',
            code: errObj?.code ?? 'INVITATION_INVALID',
            message: errObj?.message ?? '邀請連結無效',
          });
          return;
        }
        setState({ status: 'ok', data: json as InvitationDetails });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: 'error', code: 'NETWORK', message: '無法載入邀請，請稍後再試' });
        }
      });
    return () => { cancelled = true; };
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    setAcceptError(null);
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as
        | { ok: true; tripId: string; tripTitle: string }
        | { error: { code: string; message: string } };
      if (!res.ok) {
        const errObj = (data as { error: { code: string; message: string } }).error;
        setAcceptError(errObj?.message ?? '接受失敗');
        return;
      }
      // Redirect to trip
      const tripId = (data as { tripId: string }).tripId;
      window.location.href = `/trips?selected=${encodeURIComponent(tripId)}`;
    } catch {
      setAcceptError('網路錯誤，請稍後再試');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className="tp-invite-shell" data-testid="invite-page">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-invite-card">
        {state.status === 'loading' && <div className="tp-invite-body">載入中…</div>}

        {state.status === 'error' && (
          <>
            <div className="tp-invite-eyebrow">行程邀請</div>
            <div className="tp-invite-error" role="alert" data-testid="invite-error">
              {state.message}
            </div>
            <p className="tp-invite-hint">
              請聯絡邀請者重寄一份新的邀請連結。
            </p>
          </>
        )}

        {state.status === 'ok' && (
          <>
            <div className="tp-invite-eyebrow">行程邀請</div>
            <h1 className="tp-invite-title">
              {state.data.inviterDisplayName ?? state.data.inviterEmail} 邀請你加入
              <br />
              「<span className="tp-invite-trip-name">{state.data.tripTitle}</span>」
            </h1>
            <p className="tp-invite-body">
              你被邀請成為此行程的共編成員。
            </p>

            {/* Loading user state */}
            {user === undefined && <div className="tp-invite-body">確認登入狀態…</div>}

            {/* Anonymous: login or signup */}
            {user === null && (
              <div className="tp-invite-cta">
                <a
                  className="tp-invite-btn tp-invite-btn-primary"
                  href={`/signup?invitation=${encodeURIComponent(token)}`}
                  data-testid="invite-signup-btn"
                >
                  註冊並加入
                </a>
                <a
                  className="tp-invite-btn tp-invite-btn-secondary"
                  href={`/login?invitation=${encodeURIComponent(token)}`}
                  data-testid="invite-login-btn"
                >
                  登入並加入
                </a>
              </div>
            )}

            {/* Logged in but email mismatch */}
            {user && user.email.toLowerCase() !== state.data.invitedEmail.toLowerCase() && (
              <div className="tp-invite-error" role="alert" data-testid="invite-mismatch">
                此邀請不屬於你的帳號（邀請寄給 {state.data.invitedEmail}，你登入的是 {user.email}）。請改用對應 email 登入或聯絡邀請者重寄。
              </div>
            )}

            {/* Logged in + email match */}
            {user && user.email.toLowerCase() === state.data.invitedEmail.toLowerCase() && (
              <div className="tp-invite-cta">
                {acceptError && (
                  <div className="tp-invite-error" role="alert">{acceptError}</div>
                )}
                <button
                  type="button"
                  className="tp-invite-btn tp-invite-btn-primary"
                  onClick={() => void handleAccept()}
                  disabled={accepting}
                  data-testid="invite-accept-btn"
                >
                  {accepting ? '接受中…' : '接受邀請'}
                </button>
              </div>
            )}

            <p className="tp-invite-hint">
              此邀請 7 天內有效。
            </p>
          </>
        )}
      </div>
    </main>
  );
}
