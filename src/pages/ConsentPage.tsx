/**
 * ConsentPage — V2-P5 OAuth consent screen
 *
 * URL: /oauth/consent?client_id=...&scope=...&redirect_uri=...&state=...&response_type=code
 *
 * Both Allow and Deny submit native HTML forms to /api/oauth/consent. The
 * server records consent (Allow) or validates redirect_uri against the client
 * allowlist before issuing the 302 (Deny). Native form POST avoids the
 * client-side open-redirect vector and gives us SameSite=Lax CSRF protection
 * for free.
 *
 * Allow → POST /api/oauth/consent { decision: 'allow', ... }
 *   → server upserts Consent row + 302 to /api/oauth/authorize → issues code
 * Deny  → POST /api/oauth/consent { decision: 'deny', ... }
 *   → server validates redirect_uri ∈ client_apps.redirect_uris + 302 with error=access_denied
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ErrorBanner from '../components/shared/ErrorBanner';

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
  background: var(--color-accent-fill); color: var(--color-accent-foreground);
  border: 1px solid var(--color-accent-fill);
}
.tp-consent-btn-deny {
  background: var(--color-background); color: var(--color-foreground);
  border: 1px solid var(--color-border);
}
.tp-consent-btn:hover { opacity: 0.85; }
.tp-consent-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--color-background); }
.tp-consent-note {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  text-align: center; max-width: 380px;
}
.tp-consent-error {
  padding: 12px 16px; border-radius: var(--radius-md);
  /* v2.31.58 fix：原本 hardcoded #fee2e2/#991b1b 不跟 dark mode token，
     用 destructive token 對應 light/dark 自動切換。 */
  background: var(--color-destructive-bg); color: var(--color-destructive);
  font-size: var(--font-size-callout);
}
`;

const SCOPE_DETAILS: Record<string, { name: string; description: string }> = {
  openid: { name: '身分識別', description: '識別您的身分（唯一 ID）' },
  profile: { name: '基本資料', description: '基本個人資料（名稱、頭像）' },
  email: { name: '電子郵件', description: '您的電子郵件地址' },
  offline_access: { name: '離線存取', description: '即使您離線也可存取（refresh token）' },
  'trips:read': { name: '查看行程', description: '讀取您的行程資料' },
  'trips:write': { name: '修改行程', description: '建立 / 修改您的行程' },
};

// v2.33.46 round 7a: redirect_uri 客戶端基本驗證 (defense in depth — server
// 是 source of truth)。拒 javascript: / data: / file: 等 dangerous scheme。
function isPlausibleRedirectUri(uri: string): boolean {
  if (!uri) return false;
  try {
    const url = new URL(uri);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

interface ClientAppInfo {
  app_name: string;
  app_description: string | null;
  // 目前只 render app_name。這兩個來自已註冊 app、屬 attacker-influenced 值：
  // TODO 未來若顯示 <img src={app_logo_url}> / <a href={homepage_url}> 必先過 escUrl（見 EditEntryPage）。
  app_logo_url: string | null;
  homepage_url: string | null;
}

export default function ConsentPage() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('client_id') ?? '';
  const scope = searchParams.get('scope') ?? '';
  const redirectUri = searchParams.get('redirect_uri') ?? '';
  const state = searchParams.get('state') ?? '';
  const responseType = searchParams.get('response_type') ?? '';
  const codeChallenge = searchParams.get('code_challenge') ?? '';
  const codeChallengeMethod = searchParams.get('code_challenge_method') ?? '';
  const requestedScopes = scope.split(/\s+/).filter(Boolean);

  const [clientInfo, setClientInfo] = useState<{ id: string; info: ClientAppInfo } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // deps 若 invalid→valid 轉換，清掉上一輪 latch 的 error（否則 `if (error) return` 卡住）。
    setError(null);
    setClientInfo(null);
    if (!clientId) {
      // v2.31.58 zh-TW fix：原本英文「Missing client_id」 — user 看不懂、不一致。
      setError('授權連結缺少必要參數 client_id，請從應用商家提供的連結重新進入。');
      return;
    }
    // v2.33.46 round 7a: client-side redirect_uri sanity check (defense in
    // depth — backend 仍是 source of truth)。
    if (redirectUri && !isPlausibleRedirectUri(redirectUri)) {
      setError('授權連結的 redirect_uri 不合法（必須 https:// 或 http://）。請聯繫應用程式提供者。');
      return;
    }
    // Phase 2：從 /api/oauth/client-info 取已註冊 active client 的公開品牌（app_name/logo/…）。
    // 只有取得已註冊 active client 的名稱，才顯示授權動作。
    let cancelled = false;
    fetch(`/api/oauth/client-info?client_id=${encodeURIComponent(clientId)}`)
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setError(res.status === 404
            ? '找不到可授權的應用程式，請從應用程式重新發起授權。'
            : '無法確認應用程式資訊，請稍後再試。');
          return;
        }
        const info = await res.json() as ClientAppInfo;
        if (!cancelled) {
          if (typeof info.app_name === 'string' && info.app_name.trim()) setClientInfo({ id: clientId, info });
          else setError('無法確認應用程式資訊，請稍後再試。');
        }
      })
      .catch(() => {
        if (!cancelled) setError('無法確認應用程式資訊，請稍後再試。');
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, redirectUri]);

  if (error) {
    return (
      <main className="tp-consent-shell" data-testid="consent-page">
        <style>{SCOPED_STYLES}</style>
        <div className="tp-consent-card">
          <ErrorBanner message={error} testId="consent-error" />
        </div>
      </main>
    );
  }

  if (!clientInfo || clientInfo.id !== clientId) {
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
            <span className="tp-consent-app-name">{clientInfo.info.app_name}</span>
            <br />
            想要存取您的帳號
          </h1>
        </div>

        <div className="tp-consent-scopes" role="group" aria-label="要求以下權限" data-testid="consent-scopes">
          {requestedScopes.length === 0 ? (
            <div>無 scope 請求</div>
          ) : (
            // v2.33.46 round 7a: scope 顯示加 allowlist guard — 未知 scope 標警告，
            // 字串長度 cap 64 char 避免破壞 layout。
            requestedScopes.map((sRaw) => {
              const s = sRaw.slice(0, 64);
              const details = SCOPE_DETAILS[s];
              return (
                <div
                  key={s}
                  className={`tp-consent-scope-row${details ? '' : ' unknown'}`}
                  data-testid={`consent-scope-${s}`}
                  data-unknown={details ? undefined : 'true'}
                >
                  <svg className="tp-consent-scope-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                  </svg>
                  <span>
                    <strong>{details?.name ?? s}</strong>
                    {details ? (
                      <> — {details.description}</>
                    ) : (
                      <> — <span className="tp-consent-scope-warning">⚠ 未知範圍 — 請勿授權</span></>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="tp-consent-actions">
          <form method="POST" action="/api/oauth/consent" style={{ flex: 1 }}>
            <input type="hidden" name="decision" value="deny" />
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="response_type" value={responseType} />
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="state" value={state} />
            {codeChallenge && <input type="hidden" name="code_challenge" value={codeChallenge} />}
            {codeChallengeMethod && <input type="hidden" name="code_challenge_method" value={codeChallengeMethod} />}
            <button
              type="submit"
              className="tp-consent-btn tp-consent-btn-deny"
              data-testid="consent-deny"
              style={{ width: '100%' }}
            >
              拒絕授權
            </button>
          </form>
          <form method="POST" action="/api/oauth/consent" style={{ flex: 1 }}>
            <input type="hidden" name="decision" value="allow" />
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="response_type" value={responseType} />
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="state" value={state} />
            {codeChallenge && <input type="hidden" name="code_challenge" value={codeChallenge} />}
            {codeChallengeMethod && <input type="hidden" name="code_challenge_method" value={codeChallengeMethod} />}
            <button
              type="submit"
              className="tp-consent-btn tp-consent-btn-allow"
              data-testid="consent-allow"
              style={{ width: '100%' }}
            >
              同意授權
            </button>
          </form>
        </div>

        <p className="tp-consent-note">
          您可隨時在「帳號設定 → 已連結應用」撤銷授權。
        </p>
      </div>
    </main>
  );
}
