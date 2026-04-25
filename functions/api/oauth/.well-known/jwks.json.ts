/**
 * GET /api/oauth/.well-known/jwks.json — JWKS (JSON Web Key Set)
 * (V2-P1 stub — empty keys array)
 *
 * V2-P1 階段：沒簽 JWT，故無 public keys 可發。返回 empty `keys` array
 * 讓 OAuth client library 不 crash，但實際 verification 會 fail（這是 expected
 * — V2-P2 會生 RS256 keypair 存 D1 (oauth_models name='SigningKey')，由
 * oidc-provider 簽 ID Token + access_token JWT，再從這 endpoint 發出 public key）。
 */

interface JsonWebKey {
  kty: string;       // 'RSA'
  use: string;       // 'sig'
  kid: string;       // key id
  alg: string;       // 'RS256'
  n: string;         // RSA modulus (base64url)
  e: string;         // RSA exponent (base64url)
}

interface JsonWebKeySet {
  keys: JsonWebKey[];
}

export const onRequestGet: PagesFunction = async () => {
  // V2-P2 將從 D1 oauth_models name='SigningKey' 取出 active keys 轉 JWK 格式。
  // V2-P6 加 key rotation：retire old key 但 keep in JWKS 一段時間（grace period）
  // 讓既有 token 仍能 verify。
  const jwks: JsonWebKeySet = { keys: [] };

  return new Response(JSON.stringify(jwks, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // 1h CDN cache — V2-P6 key rotation 後 invalidate 才需要更短 TTL
      'cache-control': 'public, max-age=3600',
    },
  });
};
