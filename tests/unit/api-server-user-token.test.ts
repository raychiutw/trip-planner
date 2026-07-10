/**
 * api-server user-token wiring — v2.55.54
 *
 * tp-request 可選用 user 身份 token（能寫行程內容）。source-grep 鎖住關鍵不變式：
 *   - 從 get-tripline-user-token helper 取 getUserToken
 *   - kill-switch：TP_REQUEST_USER_TOKEN=1/true 且 skill 為 /tp-request 才啟用（預設 OFF）
 *   - 失敗 fallback 回 service token（read-only），不 crash spawn
 *   - spawnTmuxRequest 走 acquireToken（非直接 tokenHelper.getToken）
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
    expect(SRC).toMatch(/return await tokenHelper\.getToken\(\)/);
  });

  it('user token 失敗發 throttledAlert（usertoken- 前綴）提示 re-seed', () => {
    expect(SRC).toMatch(/throttledAlert\(\s*`usertoken-/);
    expect(SRC).toMatch(/seed-user-refresh-token/);
  });

  it('spawnTmuxRequest 走 acquireToken（非直接 tokenHelper.getToken）', () => {
    expect(SRC).toMatch(/const token = await acquireToken\(skillCommand\)/);
    // token null（service token 也失敗）→ return false 不啟動
    expect(SRC).toMatch(/if \(token === null\)/);
  });
});
