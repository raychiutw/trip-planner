import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const skillPaths = [
  '.codex/skills/tp-request/SKILL.md',
];

describe('tp-request 行程筆記 AI contract', () => {
  it.each(skillPaths)('%s 將三種筆記請求回傳純 JSON，且不直接寫筆記', (path) => {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8');

    expect(source).toContain('[行程筆記-lodging-tips]');
    expect(source).toContain('[行程筆記-tips]');
    expect(source).toContain('[行程筆記-emergency]');
    expect(source).toContain('reply 必須是純 JSON array');
    expect(source).toContain('不得直接寫入行程筆記');
  });
});

/*
 * 2026-07-29 —— 筆記 AI 逾時對不上實際耗時。
 *
 * prod 實測分布（completed_at 有值的 job）：
 *   emergency  completed 3 筆（1–2 分）  timed_out 4 筆
 *   tips       completed 5 筆（2–**101** 分）timed_out 3 筆
 *   lodging    completed 2 筆（4–12 分）  timed_out 0 筆
 *   → 10 完成 vs 7 逾時，**41% 陣亡率**
 *
 * 關鍵：completed 的裡面有 101 分鐘的 —— 工作**真的會跑那麼久**。10 分鐘門檻
 * 只是因為收屍是懶惰觸發（只在有人 PATCH 時才跑）才沒把它們全殺光；撞上就被殺，
 * 而且 applyNotesGenerationCompletion 對已 timed_out 的 job 直接丟棄後續回報。
 *
 * 這跟 ADR-0007 的牆鐘是同一條推論：**逾時必須大於 contained `claude -p` 一個 tick 的最壞上限（PRINT_MAX_ROUNDS × PRINT_RUN_TIMEOUT_MS = 90 分鐘）**，
 * 否則就是在殺一個還活著、還在工作的 session —— 完全是 #237 的形狀。
 */
