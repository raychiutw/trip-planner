/**
 * GET /api/oauth/.well-known/openid-configuration — OpenID Connect Discovery
 * (V2-P1 hand-written，per https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata)
 *
 * 為何 hand-written 而不用 oidc-provider 動態生成：
 *   - oidc-provider Koa app 的 callback handler 需要 Node HTTP req/res，CF Workers
 *     是 Fetch API → 需要 Koa↔Fetch bridge (~100 行 work)，留 V2-P2
 *   - Discovery doc 是 spec-defined 靜態結構，hand-write 對齊 spec 即可
 *   - Risk：authorize/token endpoint 真實上線時要 cross-check 此 doc 跟實作的
 *     scope/grant_types/response_types 是否同步（test 部分驗）
 *
 * V2-P2 計畫：用 oidc-provider runtime metadata 取代 hand-written，避免 drift。
 *
 * Issuer 從 request URL origin derive，避免 hardcode prod URL（local dev /
 * preview / prod 都能正確）。
 */

interface OpenIDProviderMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  registration_endpoint?: string;
  revocation_endpoint: string;
  end_session_endpoint?: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  code_challenge_methods_supported: string[];
  claims_supported: string[];
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const origin = url.origin; // e.g. https://trip-planner-dby.pages.dev or http://localhost:8788
  const base = `${origin}/api/oauth`;

  const metadata: OpenIDProviderMetadata = {
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    userinfo_endpoint: `${base}/userinfo`,
    jwks_uri: `${base}/.well-known/jwks.json`,
    revocation_endpoint: `${base}/revoke`,
    // V2-P1：暫不開 dynamic client registration（V2-P4 才考慮）
    // registration_endpoint: `${base}/register`,
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    code_challenge_methods_supported: ['S256'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'email', 'email_verified', 'name', 'picture'],
  };

  return new Response(JSON.stringify(metadata, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // 24h CDN cache — discovery doc 變動極少，cache 大幅減少 cold-start cost
      'cache-control': 'public, max-age=86400',
    },
  });
};
