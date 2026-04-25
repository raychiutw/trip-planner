/**
 * ConsentPage — V2-P5 OAuth consent screen
 *
 * URL: /oauth/consent?client_id=...&scope=...&redirect_uri=...&state=...&response_type=code
 *
 * V2-P5 first slice — UI placeholder render，fetch client info + scopes from
 * URL params。Real consent flow integration 留 V2-P5 next slice（server-authorize
 * 改成 redirect 來這頁，user 決定後再 redirect 回 client with code）。
 *
 * Allow → POST /api/oauth/consent { client_id, scope, decision: 'allow' }
 *   → 200 + redirect to original authorize endpoint with consent flag
 * Deny → 302 redirect_uri?error=access_denied&state=
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const SCOPED_STYLES = `
.tp-consent-shell {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 100dvh; padding: 48px 24px; gap: 32px;
}
.tp-consent-card {
  max-width: 480px; width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-background);
  padding: 32px 28px;
  display: flex; flex-direction: column; gap: 20px;
}
.tp-consent-header {
  display: flex; flex-direction: column; gap: 6px; text-align: center;
}
.tp-consent-eyebrow {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--color-muted);
}
.tp-consent-title {
  font-size: var(--font-size-title2); font-weight: 700;
  letter-spacing: -0.01em; color: var(--color-foreground);
}
.tp-consent-app-name { color: var(--color-accent); }
.tp-consent-scopes {
  display: flex; flex-direction: column; gap: 10px;
  padding: 16px;
  background: var(--color-accent-subtle);
  border-radius: var(--radius-md);
}
.tp-consent-scope-row {
  display: flex; align-items: flex-start; gap: 8px;
  font-size: var(--font-size-callout);
  color: var(--color-foreground);
}
.tp-consent-scope-icon {
  width: 18px; height: 18px; flex-shrink: 0;
  color: var(--color-accent); margin-top: 2px;
}
.tp-consent-actions {
  display: flex; gap: 12px;
  margin-top: 8px;
}
.tp-consent-btn {
  flex: 1; padding: 12px 20px;
  font: inherit; font-size: var(--font-size-callout); font-weight: 600;
  border-radius: var(--radius-md);
  cursor: pointer; min-height: var(--spacing-tap-min);
  transition: opacity 120ms;
}
.tp-consent-btn-allow {
  background: var(--color-accent); color: var(--color-accent-foreground);
  border: 1px solid var(--color-accent);
}
.tp-consent-btn-deny {
  background: var(--color-background); color: var(--color-foreground);
  border: 1px solid var(--color-border);
}
.tp-consent-btn:hover { opacity: 0.85; }
.tp-consent-btn:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.tp-consent-note {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  text-align: center; max-width: 380px;
}
.tp-consent-error {
  padding: 12px 16px; border-radius: var(--radius-md);
  background: #fee2e2; color: #991b1b;
  font-size: var(--font-size-callout);
}
`;

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: '識別您的身分（唯一 ID）',
  profile: '基本個人資料（名稱、頭像）',
  email: '您的 email 地址',
  offline_access: '即使您離線也可存取（refresh token）',
  'trips:read': '讀取您的行程資料',
  'trips:write': '建立 / 修改您的行程',
};

interface ClientAppInfo {
  app_name: string;
  app_description: string | null;
  app_logo_url: string | null;
  homepage_url: string | null;
}

export default function ConsentPage() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('client_id') ?? '';
  const scope = searchParams.get('scope') ?? '';
  const redirectUri = searchParams.get('redirect_uri') ?? '';
  const state = searchParams.get('state') ?? '';
  const requestedScopes = scope.split(/\s+/).filter(Boolean);

  const [clientInfo, setClientInfo] = useState<ClientAppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setError('Missing client_id');
      return;
    }
    // V2-P5 next slice: fetch /api/oauth/client-info?client_id=... → app_name + logo + description
    // V2-P5 first slice (本 PR): placeholder mock
    setClientInfo({
      app_name: clientId,
      app_description: null,
      app_logo_url: null,
      homepage_url: null,
    });
  }, [clientId]);

  function handleAllow() {
    setBusy(true);
    // POST /api/oauth/consent { client_id, scope, decision: 'allow' }
    //   → server records consent + redirect to authorize URL with consent_granted flag
    //   → /authorize re-runs, this time skip consent and issue code
    // V2-P5 first slice: placeholder navigation back to /authorize
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope,
      redirect_uri: redirectUri,
      state,
      consent_granted: '1',
    });
    window.location.href = `/api/oauth/authorize?${params.toString()}`;
  }

  function handleDeny() {
    if (!redirectUri) return;
    const params = new URLSearchParams({ error: 'access_denied' });
    if (state) params.set('state', state);
    window.location.href = `${redirectUri}?${params.toString()}`;
  }

  if (error) {
    return (
      <main className="tp-consent-shell" data-testid="consent-page">
        <style>{SCOPED_STYLES}</style>
        <div className="tp-consent-card">
          <div className="tp-consent-error" role="alert">⚠ {error}</div>
        </div>
      </main>
    );
  }

  if (!clientInfo) {
    return (
      <main className="tp-consent-shell" data-testid="consent-page">
        <style>{SCOPED_STYLES}</style>
        <div className="tp-consent-card">載入中…</div>
      </main>
    );
  }

  return (
    <main className="tp-consent-shell" data-testid="consent-page">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-consent-card">
        <div className="tp-consent-header">
          <div className="tp-consent-eyebrow">授權請求</div>
          <h1 className="tp-consent-title">
            <span className="tp-consent-app-name">{clientInfo.app_name}</span>
            <br />
            想要存取您的帳號
          </h1>
        </div>

        <div className="tp-consent-scopes" data-testid="consent-scopes">
          {requestedScopes.length === 0 ? (
            <div>無 scope 請求</div>
          ) : (
            requestedScopes.map((s) => (
              <div key={s} className="tp-consent-scope-row" data-testid={`consent-scope-${s}`}>
                <svg className="tp-consent-scope-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                </svg>
                <span>
                  <strong>{s}</strong>
                  {SCOPE_DESCRIPTIONS[s] && <> — {SCOPE_DESCRIPTIONS[s]}</>}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="tp-consent-actions">
          <button
            type="button"
            className="tp-consent-btn tp-consent-btn-deny"
            onClick={handleDeny}
            disabled={busy}
            data-testid="consent-deny"
          >
            拒絕
          </button>
          <button
            type="button"
            className="tp-consent-btn tp-consent-btn-allow"
            onClick={handleAllow}
            disabled={busy}
            data-testid="consent-allow"
          >
            同意
          </button>
        </div>

        <p className="tp-consent-note">
          您可隨時在「帳號設定 → 已連結應用」撤銷授權。
        </p>
      </div>
    </main>
  );
}
