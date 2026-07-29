import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const skillPaths = [
  '.claude/skills/tp-request/SKILL.md',
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
 * 這跟 ADR-0007 的牆鐘是同一條推論：**逾時必須大於 ORPHAN_MAX_AGE_MS（90 分鐘）**，
 * 否則就是在殺一個還活著、還在工作的 session —— 完全是 #237 的形狀。
 */
describe('筆記 AI 逾時必須大於 session 壽命', () => {
  const GENERATE_SRC = readFileSync(
    'functions/api/trips/[id]/notes/[type]/generate.ts', 'utf-8',
  );
  const API_SERVER_SRC = readFileSync('scripts/tripline-api-server.ts', 'utf-8');

  it('INSERT 用的逾時 > ORPHAN_MAX_AGE_MS（90 分鐘）', () => {
    const m = GENERATE_SRC.match(/datetime\('now',\s*'\+(\d+) minutes'\)/);
    expect(m, 'generate.ts 找不到 timeout_at 的 datetime 運算式').not.toBeNull();
    const minutes = Number(m![1]);
    // api-server 的 orphan cap 是 90 分鐘 —— 在那之前 session 都還可能在正常工作
    expect(API_SERVER_SRC).toContain('ORPHAN_MAX_AGE_MS = 90 * 60 * 1000');
    expect(minutes).toBeGreaterThan(90);
  });

  /*
   * migration 0091 的欄位 DEFAULT 仍是 +10 分鐘，**刻意不改**：
   *   1. 0091 早已套到 prod —— 改檔案不會改變 prod 的 schema，只會讓新建的 DB
   *      跟 prod 不一致
   *   2. 要真的改 SQLite 的 DEFAULT 得整張表 swap，而 trip_note_ai_jobs 有
   *      FK 指向 trip_requests，成本遠高於收益
   *   3. 那個 default **從來不會被用到** —— generate.ts 是唯一的 INSERT，
   *      每次都顯式給 timeout_at
   * 所以真正的 SoT 是 generate.ts，這條測試鎖住「唯一寫入點沒有其他 INSERT」。
   */
  it('trip_note_ai_jobs 的 INSERT 只有一處（default 用不到才敢不動它）', () => {
    const inserts = [
      ...GENERATE_SRC.matchAll(/INSERT INTO trip_note_ai_jobs/g),
    ].length;
    expect(inserts).toBe(1);
    const otherFiles = ['functions/api/_noteAi.ts', 'functions/api/requests/[id]/index.ts'];
    for (const f of otherFiles) {
      expect(readFileSync(f, 'utf-8')).not.toContain('INSERT INTO trip_note_ai_jobs');
    }
  });

  it('逾時訊息不再寫死「10 分鐘」', () => {
    const NOTE_AI_SRC = readFileSync('functions/api/_noteAi.ts', 'utf-8');
    expect(NOTE_AI_SRC).not.toContain('AI 生成超過 10 分鐘');
  });
});
