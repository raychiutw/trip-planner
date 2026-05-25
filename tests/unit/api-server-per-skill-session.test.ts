/**
 * api-server per-skill session lock — regression test for v2.33.27.
 *
 * Bug context: 2026-05-19 ~ 2026-05-22 daily-check 4 天沒 fire。Root cause：
 * `hasActiveSession()` 用共用 `tripline-request-` prefix 不分 skill，
 * `/tp-daily-check` fire 在 `/tp-request` fire 之後 1 分鐘總是撞 active session
 * → 永遠 skip。
 *
 * Fix：session name 加 skill slug + hasActiveSession + isRunning 鎖 per-skill。
 * 此 test source-grep 確保 fix 不被誤改回。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '../../scripts/tripline-api-server.ts'),
  'utf8',
);

describe('api-server v2.33.27 per-skill lock (regression)', () => {
  it('sessionPrefixForSkill 函式存在且回 tripline-{slug}- 格式', () => {
    expect(SRC).toMatch(/function sessionPrefixForSkill\(skillCommand: string\)/);
    // slug rule: 去 leading /, lowercase → tripline-tp-request- / tripline-tp-daily-check-
    expect(SRC).toMatch(/return `tripline-\$\{slug\}-`/);
  });

  it('hasActiveSession 接 skillCommand 參數 + 用 sessionPrefixForSkill 過濾', () => {
    // v2.33.110: signature required（原 optional 三元 fallback 從未 reach，dead code 已刪）
    expect(SRC).toMatch(/function hasActiveSession\(skillCommand: string\)/);
    expect(SRC).toMatch(/sessionPrefixForSkill\(skillCommand\)/);
  });

  it('hasActiveSession 保留 /tp-request legacy backward-compat', () => {
    // /tp-request 接 legacy session prefix（process restart 過渡期既有 session 還活著）
    // v2.33.110: literal `'tripline-request-'` 抽成 LEGACY_SESSION_PREFIX 常數
    expect(SRC).toMatch(/skillCommand === '\/tp-request' && line\.startsWith\(LEGACY_SESSION_PREFIX\)/);
  });

  it('spawnTmuxRequest session name 用 sessionPrefixForSkill', () => {
    expect(SRC).toMatch(/const sessionName = `\$\{sessionPrefixForSkill\(skillCommand\)\}\$\{Date\.now\(\)\}-\$\{process\.pid\}`/);
  });

  it('processLoop runningSkills set per-skill 鎖（取代 global isRunning）', () => {
    expect(SRC).toMatch(/const runningSkills = new Set<string>\(\)/);
    expect(SRC).toMatch(/runningSkills\.has\(skillCommand\)/);
    expect(SRC).toMatch(/runningSkills\.add\(skillCommand\)/);
    expect(SRC).toMatch(/runningSkills\.delete\(skillCommand\)/);
  });

  it('processLoop hasActiveSession 呼叫帶 skillCommand 參數', () => {
    expect(SRC).toMatch(/hasActiveSession\(skillCommand\)/);
  });

  it('fireSchedule 用 runningSkills.has() 取代 global isRunning', () => {
    expect(SRC).toMatch(/function fireSchedule\(skillCommand: string, label: string\): void \{\s*\n\s*if \(runningSkills\.has\(skillCommand\)\)/);
  });

  it('/health endpoint 回 runningSkills array + boolean 兼容', () => {
    expect(SRC).toMatch(/running: runningSkills\.size > 0/);
    expect(SRC).toMatch(/runningSkills: Array\.from\(runningSkills\)/);
  });

  it('/trigger lock 只擋 /tp-request 同 skill（per v2.33.27 design）', () => {
    expect(SRC).toMatch(/runningSkills\.has\('\/tp-request'\)/);
  });

  it('SRC 不再有 global `let isRunning` 變數定義', () => {
    expect(SRC).not.toMatch(/^let isRunning =/m);
  });
});
