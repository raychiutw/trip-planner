/**
 * @deprecated V2-P1 完成 OIDC Discovery + JWKS endpoints 後 spike 已過任務目標。
 *   未來 V2-P2 整合 oidc-provider Koa↔Fetch bridge 後此檔應移除。
 *   保留至 V2-P2 ship — V2 Day 0 spike result 的 prod runtime verify 仍會用到。
 *
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
 *
 * Response 加 RFC 8594 Deprecation + Sunset headers + Link to successor discovery endpoint。
 */

// @ts-expect-error — oidc-provider 在 Day 0 spike 期 types 未完整接 Workers runtime，先忽略
import Provider from 'oidc-provider';

/** Sunset date — V2-P2 Koa↔Fetch bridge ship 後 retire。預估 2026-06-30 留 2 個月 buffer。 */
const SUNSET_DATE = 'Tue, 30 Jun 2026 00:00:00 GMT';

function deprecationHeaders(request: Request): Record<string, string> {
  const origin = new URL(request.url).origin;
  return {
    'Deprecation': 'true',
    'Sunset': SUNSET_DATE,
    'Link': `<${origin}/api/oauth/.well-known/openid-configuration>; rel="successor-version"`,
  };
}

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const provider = new Provider('https://trip-planner-dby.pages.dev', {
      clients: [
        {
          client_id: 'spike-test-client',
          client_secret: 'spike-test-secret-not-for-production',
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
          deprecated: true,
          successor: '/api/oauth/.well-known/openid-configuration',
        },
        null,
        2,
      ),
      {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          ...deprecationHeaders(context.request),
        },
      },
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
        headers: {
          'content-type': 'application/json; charset=utf-8',
          ...deprecationHeaders(context.request),
        },
      },
    );
  }
};
