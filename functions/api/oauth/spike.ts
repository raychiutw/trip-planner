/**
 * V2 Day 0 spike endpoint — 驗 oidc-provider 在 CF Pages Functions 能否 import + instantiate
 *
 * 跑法：
 *   1. `npm run dev`
 *   2. `curl http://localhost:8788/api/oauth/spike`
 *
 * 成功判定：
 *   - 200 + `{ ok: true, issuer: '...' }` → oidc-provider 能在 nodejs_compat 下跑
 *
 * 失敗判定：
 *   - 500 + `{ ok: false, error: '...' }` → 看 error 決定 debug 還是 fallback
 *   - import 本身失敗（wrangler 啟動就 crash）→ fallback 到 @openauthjs/openauth + KV
 *
 * 結果寫到 docs/v2-oauth-spike-result.md
 */

// @ts-expect-error — oidc-provider 在 Day 0 spike 期 types 未完整接 Workers runtime，先忽略
import Provider from 'oidc-provider';

export const onRequestGet: PagesFunction = async () => {
  try {
    const provider = new Provider('https://trip-planner-dby.pages.dev', {
      clients: [
        {
          client_id: 'test-client',
          client_secret: 'test-secret-change-me',
          redirect_uris: ['https://example.com/cb'],
        },
      ],
    });

    return new Response(
      JSON.stringify(
        {
          ok: true,
          message: 'oidc-provider imported + instantiated inside CF Pages Functions (nodejs_compat)',
          issuer: provider.issuer,
        },
        null,
        2,
      ),
      { headers: { 'content-type': 'application/json; charset=utf-8' } },
    );
  } catch (err: unknown) {
    const e = err as Error;
    return new Response(
      JSON.stringify(
        {
          ok: false,
          error: e?.message ?? String(err),
          stack: e?.stack?.split('\n').slice(0, 15),
          hint: '看 error trace：若是 http.Server / net.Server 等 Node-only API → 需要 fallback',
        },
        null,
        2,
      ),
      {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      },
    );
  }
};
