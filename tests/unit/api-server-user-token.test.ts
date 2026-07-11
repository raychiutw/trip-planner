/**
 * api-server owner-token wiring — Option E (v2.55.62)
 *
 * tp-request 用 owner 身份 token 寫行程。Option E：不存/rotate refresh token，改由 OAuth
 * server 從既有 Consent 直接簽發受限 token（POST /api/oauth/mint-restricted）。source-grep
 * 鎖住關鍵安全不變式：
 *   - kill-switch：TP_REQUEST_USER_TOKEN=1/true 且 skill 為 /tp-request 才啟用（預設 OFF）
 *   - peek 最舊 pending request（id+trip）→ mint-restricted(request_id) → 受限 owner token
 *   - **mint 失敗 → 不 spawn（return null）**：絕不 fallback 到未-contained service-token session
 *   - restrict token 必走 containment 路徑；containment 未就緒 → 不 spawn（不降級 uncontained）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { json } from '../../functions/api/_utils';

const SRC = readFileSync(join(__dirname, '../../scripts/tripline-api-server.ts'), 'utf8');

describe('kill-switch', () => {
  it('userTokenEnabled：需 TP_REQUEST_USER_TOKEN=1/true（預設 OFF）', () => {
    expect(SRC).toMatch(/TP_REQUEST_USER_TOKEN/);
    expect(SRC).toMatch(/flag === '1' \|\| flag === 'true'/);
  });

  it('只有 /tp-request 用 owner token（其他 skill 續用 service token）', () => {
    expect(SRC).toMatch(/skillCommand\.trim\(\)\s*===\s*'\/tp-request'/);
  });
});

describe('Option E：mint-restricted 取 owner token（無 refresh vault）', () => {
  it('退役 refresh-token 流程（不再 require helper / 呼叫 getUserToken / downscope）', () => {
    // 鎖實際使用（非禁止 comment 提及退役）：helper 變數 + 呼叫 + 舊 fn 全移除
    expect(SRC).not.toMatch(/userTokenHelper/);
    expect(SRC).not.toMatch(/\.getUserToken\(/);
    expect(SRC).not.toMatch(/async function downscopeToken/);
  });

  it('peek 最舊 pending request（id+trip，processing→open）用 service token 讀', () => {
    expect(SRC).toMatch(/async function peekPendingRequest/);
    expect(SRC).toMatch(/\['processing', 'open'\]/);
    expect(SRC).toMatch(/const svcToken = await tokenHelper\.getToken\(\)/);
    expect(SRC).toMatch(/\/api\/requests\?status=/);
    // 回傳帶 requestId（供 mint-restricted）
    expect(SRC).toMatch(/requestId: string; tripId: string/);
  });

  it('mint-restricted(request_id) 用 API_SECRET（非 owner Bearer、非 downscope）', () => {
    expect(SRC).toMatch(/async function mintRestricted/);
    expect(SRC).toMatch(/\/api\/oauth\/mint-restricted/);
    expect(SRC).toMatch(/request_id: requestId/);
    expect(SRC).toMatch(/Authorization: `Bearer \$\{API_SECRET\}`/);
  });

  it('acquireToken /tp-request：peek→mint→{token, restrictTrip}', () => {
    expect(SRC).toMatch(/const pending = await peekPendingRequest\(\)/);
    expect(SRC).toMatch(/await mintRestricted\(pending\.requestId\)/);
    expect(SRC).toMatch(/return \{ token, restrictTrip: tripId \}/);
  });
});

describe('DOA 迴歸：peek 讀 API 實際 emit 的欄名（camelCase）', () => {
  // 曾 DOA：peek 讀 item?.trip_id，但 /api/requests 經 json()→deepCamel 回 camelCase，
  // trip_id 永遠 undefined → 永不 mint。flag OFF 時沒被發現，Option E 讓它變 load-bearing。
  it('peek 讀 item?.tripId，不讀 trip_id（source lock）', () => {
    expect(SRC).toMatch(/item\?\.tripId/);
    expect(SRC).not.toMatch(/item\?\.trip_id/);
  });

  it('契約：/api/requests 的 json() 把 trip_id → tripId（peek 依賴的不變式）', async () => {
    // 這條才是根因鎖：peek 讀 tripId 只有在 API 真的 emit tripId 時才對。id 無底線不變。
    const body = (await json({ items: [{ id: 42, trip_id: 'trip-x', status: 'processing' }] }).json()) as {
      items: Array<Record<string, unknown>>;
    };
    expect(body.items[0]).toHaveProperty('tripId', 'trip-x');
    expect(body.items[0]).not.toHaveProperty('trip_id');
    expect(body.items[0]).toHaveProperty('id', 42);
  });
});

describe('fail-closed：mint 失敗絕不起未-contained session', () => {
  it('mint 失敗 → return null（不 fallback service token），發 mint- alert', () => {
    // user-token 分支 catch 後 return null（非 fall through 到 service token）
    expect(SRC).toMatch(/throttledAlert\(\s*`mint-/);
    expect(SRC).toMatch(/return null; \/\/ 關鍵：不 fallback service token/);
  });

  it('無 pending request → return null（不 spawn 閒置 uncontained session）', () => {
    expect(SRC).toMatch(/if \(!pending\) \{/);
  });

  it('非-/tp-request skill 仍用 service token（trusted，uncontained OK）', () => {
    expect(SRC).toMatch(/return \{ token: await tokenHelper\.getToken\(\) \}/);
  });

  it('spawnTmuxRequest 走 acquireToken；null → 不 spawn', () => {
    expect(SRC).toMatch(/const acquired = await acquireToken\(skillCommand\)/);
    expect(SRC).toMatch(/if \(acquired === null\)/);
  });
});

describe('containment gate（confused-deputy + 不可信輸入隔離）', () => {
  it('restrict token 走 contained spawn（token+restrictTrip 進 MCP-config env）', () => {
    expect(SRC).toMatch(/if \(restrictTrip\) \{/);
    expect(SRC).toMatch(/if \(containmentReady\(\)\) \{/);
    expect(SRC).toMatch(/return await spawnContainedSession\(sessionName, skillCommand, token, restrictTrip\)/);
    expect(SRC).toMatch(/buildMcpConfig\(\{[^}]*token, restrictTrip \}\)/);
  });

  it('containment 未就緒 → 不 spawn（不降級 uncontained；堵 fallback 外洩洞）', () => {
    expect(SRC).toMatch(/throttledAlert\('containment-not-ready'/);
    // 關鍵：不再 degrade（不設 restrictTrip=undefined、不改跑 service token），直接 return false
    expect(SRC).not.toMatch(/restrictTrip = undefined/);
    // containment-not-ready 區塊末端 return false
    expect(SRC).toMatch(/不 spawn（拒絕未隔離 session 處理不可信輸入）[\s\S]*?return false;/);
  });
});
