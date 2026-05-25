/**
 * cleanupOrphans prefix 必須 cover 所有 session 命名世代 — regression for v2.33.110.
 *
 * Bug context: v2.33.27 per-skill rename 後 session 命名是 `tripline-tp-request-*` /
 * `tripline-tp-daily-check-*`，但 `cleanupOrphans` 仍用 `SESSION_PREFIX = 'tripline-request-'`
 * filter → `name.startsWith(SESSION_PREFIX)` 永遠 false → orphan 完全不被清。
 *
 * 實證：2026-05-25 一個 `tripline-tp-request-1779683905609-1669` orphan 卡 9h+ 未清，
 * 後續 cron 每 10 min fire 都因 `hasActiveSession()` 命中 → skip，AI 健檢 request 209
 * 卡 1h21m 才完成。
 *
 * Fix：cleanupOrphans 用「ALLOWED_SKILLS-derived prefix set + legacy `tripline-request-`」
 * 自動跟著新 skill 走，並避免誤殺 `tripline-debug` 等人類 ad-hoc session。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '../../scripts/tripline-api-server.ts'),
  'utf8',
);

describe('cleanupOrphans v2.33.110 allowlist-driven prefix (regression)', () => {
  it('LEGACY_SESSION_PREFIX 常數仍存在（過渡期向後相容）', () => {
    expect(SRC).toMatch(/const LEGACY_SESSION_PREFIX = 'tripline-request-'/);
  });

  it('getKnownSessionPrefixes 從 ALLOWED_SKILLS derive + 加 LEGACY_SESSION_PREFIX', () => {
    expect(SRC).toMatch(/function getKnownSessionPrefixes\(\): string\[\]/);
    expect(SRC).toMatch(/Array\.from\(ALLOWED_SKILLS\)\.map\(sessionPrefixForSkill\)/);
    expect(SRC).toMatch(/LEGACY_SESSION_PREFIX,?\s*\]/);
  });

  it('cleanupOrphans 用 getKnownSessionPrefixes() + .some()-based prefix match', () => {
    const fn = SRC.match(/async function cleanupOrphans[\s\S]+?return killed;[\s\S]+?\n\}/);
    expect(fn, 'cleanupOrphans function body not found').toBeTruthy();
    expect(fn![0]).toMatch(/getKnownSessionPrefixes\(\)/);
    // looser regex — variable rename 或 extract-helper refactor 不該 false-fail
    expect(fn![0]).toMatch(/\.some\(\s*\w+\s*=>\s*\w+\.startsWith\(\s*\w+\s*\)\s*\)/);
    // 確保不再 hardcode 單一 prefix
    expect(fn![0]).not.toMatch(/startsWith\(SESSION_PREFIX\)/);
    expect(fn![0]).not.toMatch(/startsWith\(ORPHAN_SCAN_PREFIX\)/);
  });

  it('cleanupOrphans 用 `|` delimiter 而非 space（session name 含空格的 defense in depth）', () => {
    const fn = SRC.match(/async function cleanupOrphans[\s\S]+?return killed;[\s\S]+?\n\}/);
    expect(fn![0]).toMatch(/#\{session_name\}\|#\{session_created\}/);
    expect(fn![0]).toMatch(/\.split\('\|'\)/);
    expect(fn![0]).not.toMatch(/'#\{session_name\} #\{session_created\}'/);
  });

  it('SESSION_PREFIX 死碼已刪（hasActiveSession 三元 fallback 從未 reach）', () => {
    // 只剩 comment / docstring 內提（歷史說明），不再有 const definition 或 runtime 引用
    expect(SRC).not.toMatch(/^const SESSION_PREFIX = /m);
    // hasActiveSession 簽名 required
    expect(SRC).toMatch(/function hasActiveSession\(skillCommand: string\): string \| null/);
  });
});

describe('cleanupOrphans prefix match logic (sample-based)', () => {
  // 模擬 getKnownSessionPrefixes 的輸出（ALLOWED_SKILLS = /tp-request, /tp-daily-check）
  const knownPrefixes = [
    'tripline-tp-request-',
    'tripline-tp-daily-check-',
    'tripline-request-', // LEGACY_SESSION_PREFIX
  ];
  const match = (name: string) => knownPrefixes.some(p => name.startsWith(p));

  it.each([
    ['legacy /tp-request (v2.33.26 前)', 'tripline-request-1779683905609-1669'],
    ['per-skill /tp-request (v2.33.27+)', 'tripline-tp-request-1779697106164-1669'],
    ['per-skill /tp-daily-check (v2.33.27+)', 'tripline-tp-daily-check-1779700000000-1669'],
  ])('應 match: %s', (_label, sessionName) => {
    expect(match(sessionName)).toBe(true);
  });

  it.each([
    ['user 手動 tripline-debug shell（quality agent 點名）', 'tripline-debug'],
    ['未知 tripline-* 前綴 (allowlist 不收)', 'tripline-foo-bar-123'],
    ['別 user 的 tmux session', 'my-shell'],
    ['Asana/Slack agent session', 'asana-agent-123'],
    ['空字串', ''],
  ])('不該 match: %s', (_label, sessionName) => {
    expect(match(sessionName)).toBe(false);
  });
});
