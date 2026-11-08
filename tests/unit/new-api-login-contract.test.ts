/**
 * 新 api 模式下帳密登入的契約對照（#1480 缺口 c）。
 *
 * 背景：tests/unit/web-api-contract.test.ts 的 KNOWN_GAPS 有一筆 `POST /api/oauth/login`：它掃到的是 LoginPage 旗標關閉那條
 * 舊入口分支（只送 email＋password），所以必須列為已知落差。結論（本檔把它釘住，不靠口述）：
 *   1. 新 api 仍支援帳密登入：契約有 `POST /api/oauth/login`（公開端點），只是必填欄位多了 PKCE（client_id、code_challenge、code_challenge_method）。
 *   2. 旗標開啟時 web 不走那條舊分支：LoginPage／OauthAuthorizePage 都呼叫 `auth.login()`，它送出的 body 涵蓋契約全部必填欄位，
 *      且格式合乎契約的 pattern（43 字元 base64url）。
 *   3. 所以那筆 KNOWN_GAPS 只在「旗標關閉的舊入口分支」成立；旗標移除後該分支與 KNOWN_GAPS 一併刪除（PR：移除旗標）。
 * 這裡用真的 auth client 與契約檔對照，契約改了必填欄位這個測試會紅。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAuthClient } from '../../src/lib/auth/client';
import { createMemoryAuthStorage } from '../../src/lib/auth/storage';
import { createFakeOAuthApi, FAKE_API_BASE, FAKE_EMAIL, FAKE_PASSWORD } from './__helpers__/fake-oauth-api';

const spec = JSON.parse(readFileSync(join(__dirname, '../../contracts/openapi.json'), 'utf8')) as {
  paths: Record<string, Record<string, { security?: unknown; requestBody?: { content: Record<string, { schema: { $ref: string } }> } }>>;
  components: { schemas: Record<string, { required?: string[]; properties: Record<string, { pattern?: string; enum?: string[] }> }> };
};
const op = spec.paths['/api/oauth/login']!.post!;
const schema = spec.components.schemas[op.requestBody!.content['application/json']!.schema.$ref.split('/').pop()!]!;

describe('新 api 帳密登入 ↔ contracts/openapi.json', () => {
  it('契約仍有公開的 POST /api/oauth/login（新 api 沒有移除帳密登入）', () => {
    expect(op).toBeTruthy();
    expect(op.security).toBeUndefined();
  });

  it('auth.login() 送出的 body 涵蓋契約全部必填欄位，且 PKCE 欄位格式合乎契約', async () => {
    const api = createFakeOAuthApi();
    const client = createAuthClient({ apiBase: FAKE_API_BASE, storage: createMemoryAuthStorage(), fetch: api.fetch, lock: (fn) => fn() });
    await client.login(FAKE_EMAIL, FAKE_PASSWORD);
    const req = api.requests.find((r) => r.url.endsWith('/api/oauth/login'))!;
    const body = JSON.parse(req.body) as Record<string, string>;

    expect(schema.required!.length).toBeGreaterThan(0);
    expect(schema.required!.filter((k) => !(k in body))).toEqual([]);
    for (const k of ['code_challenge', 'dpop_jkt'] as const) expect(body[k]).toMatch(new RegExp(schema.properties[k]!.pattern!));
    expect(schema.properties.code_challenge_method!.enum).toContain(body.code_challenge_method);
  });
});
