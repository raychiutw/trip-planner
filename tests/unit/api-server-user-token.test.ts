/**
 * api-server user-token wiring — v2.55.54 / v2.55.56
 *
 * tp-request 可選用 user 身份 token（能寫行程內容）。source-grep 鎖住關鍵不變式：
 *   - 從 get-tripline-user-token helper 取 getUserToken
 *   - kill-switch：TP_REQUEST_USER_TOKEN=1/true 且 skill 為 /tp-request 才啟用（預設 OFF）
 *   - 失敗 fallback 回 service token（read-only），不 crash spawn
 *   - spawnTmuxRequest 走 acquireToken（非直接 tokenHelper.getToken）
 *   - v2.55.56 trip-scope：peek 最舊 pending trip → downscope user token 到單一 trip →
 *     注入 TRIPLINE_RESTRICT_TRIP（confused-deputy：injected agent 寫不了別 trip）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, '../../scripts/tripline-api-server.ts'), 'utf8');

describe('user-token helper 接線', () => {
  it('import get-tripline-user-token helper', () => {
    expect(SRC).toMatch(/get-tripline-user-token\.js/);
    expect(SRC).toMatch(/getUserToken:\s*\(\)\s*=>\s*Promise<string>/);
  });

  it('userTokenEnabled kill-switch：需 TP_REQUEST_USER_TOKEN=1/true', () => {
    expect(SRC).toMatch(/TP_REQUEST_USER_TOKEN/);
    // 預設 OFF：flag 必須明示 '1' 或 'true' 才啟用
    expect(SRC).toMatch(/flag === '1' \|\| flag === 'true'/);
  });

  it('只有 /tp-request 用 user token（其他 skill 續用 service token）', () => {
    expect(SRC).toMatch(/skillCommand\.trim\(\)\s*===\s*'\/tp-request'/);
  });
});

describe('失敗 fallback 不 crash', () => {
  it('acquireToken：user token 失敗後 fall through 到 tokenHelper.getToken（service token）', () => {
    // acquireToken 內 user-token try/catch 後仍呼叫 service token getToken
    expect(SRC).toMatch(/userTokenHelper\.getUserToken\(\)/);
    expect(SRC).toMatch(/return \{ token: await tokenHelper\.getToken\(\) \}/);
  });

  it('user token 失敗發 throttledAlert（usertoken- 前綴）提示 re-seed', () => {
    expect(SRC).toMatch(/throttledAlert\(\s*`usertoken-/);
    expect(SRC).toMatch(/seed-user-refresh-token/);
  });

  it('spawnTmuxRequest 走 acquireToken（非直接 tokenHelper.getToken）', () => {
    expect(SRC).toMatch(/const acquired = await acquireToken\(skillCommand\)/);
    // acquired null（service token 也失敗）→ return false 不啟動
    expect(SRC).toMatch(/if \(acquired === null\)/);
  });
});

describe('v2.55.56 trip-scope（confused-deputy 緩解）', () => {
  it('peek 最舊 pending trip（processing→open 優先序）用 service token 讀', () => {
    expect(SRC).toMatch(/async function peekPendingTripId/);
    expect(SRC).toMatch(/\['processing', 'open'\]/);
    // peek 用 service token（ops:trips:read），非 user token
    expect(SRC).toMatch(/const svcToken = await tokenHelper\.getToken\(\)/);
    expect(SRC).toMatch(/\/api\/requests\?status=/);
  });

  it('downscope user token 到單一 trip（POST /api/oauth/downscope）', () => {
    expect(SRC).toMatch(/async function downscopeToken/);
    expect(SRC).toMatch(/\/api\/oauth\/downscope/);
    expect(SRC).toMatch(/trip_id: tripId/);
  });

  it('只在有 pending trip 時走 user token（否則 fallback service token）', () => {
    // peek → downscope 綁在一起：無 tripId 不 mint user token
    expect(SRC).toMatch(/const tripId = await peekPendingTripId\(\)/);
    expect(SRC).toMatch(/const restricted = await downscopeToken\(userToken, tripId\)/);
    expect(SRC).toMatch(/return \{ token: restricted, restrictTrip: tripId \}/);
  });

  it('restrict token 走 containment 路徑（非 un-contained tmux env）', () => {
    // 本 PR：restrict_trip 是 write-capable → 必走 contained spawn，不再注入
    // un-contained tmux shell env。restrictTrip truthy → containmentReady() gate。
    expect(SRC).toMatch(/if \(restrictTrip\) \{/);
    expect(SRC).toMatch(/if \(containmentReady\(\)\) \{/);
    expect(SRC).toMatch(/return spawnContainedSession\(sessionName, skillCommand, token, restrictTrip\)/);
    // restrict trip 進 MCP-config env（非 tmux shell env）— 走 buildMcpConfig
    expect(SRC).toMatch(/buildMcpConfig\(\{[^}]*token, restrictTrip \}\)/);
  });

  it('containment 未就緒 → fail-closed 降級 read-only service token（絕不 un-contained 跑 write token）', () => {
    // 拒絕以受限寫入 token 跑未隔離 session；改用 service token（寫不了行程）
    expect(SRC).toMatch(/token = await tokenHelper\.getToken\(\)/);
    expect(SRC).toMatch(/restrictTrip = undefined/);
    expect(SRC).toMatch(/throttledAlert\('containment-not-ready'/);
  });
});
