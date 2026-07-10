/**
 * api-server spawn 提交 skill command wiring — regression for v2.55.52。
 *
 * Bug：spawnTmuxRequest 用 `send-keys '/tp-request' Enter` 合併送給 detached claude
 * REPL。新版 TUI 開機變慢（MCP auth 檢查 + plugin sync）超過硬編碼 2.5s 等待，且
 * slash-command autocomplete 選單攔截同 burst 的 Enter → 指令打進 input 但沒提交
 * （$0.000 stuck session），blocking 後續所有 spawn ~40min、佇列不處理。
 *
 * Fix：readiness poll + type/Enter 拆開 + capture verify + retry，orchestration 抽到
 * ./lib/tmux-pane（有行為測試 tmux-pane.test.ts）。本 test source-grep 鎖 server 端
 * wiring：不被誤改回一行合併 send-keys（tripline-api-server import 即啟動 server，無法
 * 直接 import 執行 → server 層只能 source-grep）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '../../scripts/tripline-api-server.ts'),
  'utf8',
);

describe('api-server v2.55.52 spawn submit wiring (regression)', () => {
  it('不再用合併 `send-keys ... skillCommand, \'Enter\'` 一次送出（會被 autocomplete 吞）', () => {
    expect(SRC).not.toMatch(/skillCommand,\s*'Enter'\s*\]/);
  });

  it('不再用硬編碼 2500ms 固定等待 REPL 啟動', () => {
    expect(SRC).not.toMatch(/setTimeout\(r,\s*2500\)/);
  });

  it('從 ./lib/tmux-pane import waitForRepl + submitSkillCommand', () => {
    expect(SRC).toMatch(/import\s*\{[^}]*waitForRepl[^}]*submitSkillCommand[^}]*\}\s*from\s*'\.\/lib\/tmux-pane'/);
  });

  it('tmuxDeps 注入 tmux 副作用（capture / sendKeys / sleep / log）', () => {
    expect(SRC).toMatch(/const tmuxDeps: TmuxDeps = \{/);
    expect(SRC).toMatch(/capture:.*capture-pane/);
    expect(SRC).toMatch(/sendKeys:.*send-keys/);
  });

  it('sleep 用 _lib/cron-shared 既有 export（非內聯 new Promise setTimeout）', () => {
    expect(SRC).toMatch(/import\s*\{[^}]*sleep[^}]*\}\s*from\s*'\.\/_lib\/cron-shared'/);
  });

  it('spawnTmuxRequest 用 waitForRepl + submitSkillCommand，兩者失敗都 kill session', () => {
    expect(SRC).toMatch(/await waitForRepl\(tmuxDeps, sessionName\)/);
    expect(SRC).toMatch(/await submitSkillCommand\(tmuxDeps, sessionName, skillCommand\)/);
    // 兩個失敗分支都 kill-session（消除 stuck-session-marked-active 阻塞）
    const killCount = (SRC.match(/kill-session', '-t', sessionName\]/g) || []).length;
    expect(killCount).toBeGreaterThanOrEqual(2);
  });
});
