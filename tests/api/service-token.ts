/**
 * 在進程內的 D1 建立「服務 token」（client_credentials：user_id 為 null）的 AccessToken。
 * 與 http.ts 的 `tokenFor`（使用者 token）互補，供測試服務 token 的 scope／companion／維運 gate。
 */
import { D1Adapter } from '../../src/server/oauth-d1-adapter';

export async function serviceTokenFor(
  db: D1Database,
  opts: { clientId: string; scopes: string[] },
): Promise<string> {
  const token = `svc-test-${crypto.randomUUID()}`;
  await new D1Adapter(db, 'AccessToken').upsert(
    token,
    { jti: token, client_id: opts.clientId, user_id: null, scopes: opts.scopes, grantId: `grant-${token}` },
    300,
  );
  return token;
}
