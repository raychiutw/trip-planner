/**
 * .github/workflows/deploy.yml — D1 migration gate 的接線鎖。
 *
 * check-migration-safety.test.ts 只證明「script 會 honour 你餵它的清單」，那從來不是
 * 問題所在。gate 從 2026-05-04 incident 後在 CI 裡從未擋下任何東西，root cause 全部在
 * 這個 yml：checkout 深度不夠 → origin/master~1 解不開 → git fatal → 被吞 → exit 0。
 *
 * 所以這裡鎖的是 script 看不到、但決定它是否有意義的那幾格接線：pending 清單真的
 * 產得出來、真的餵進去、而且排在 apply 之前。少了這一檔，把 --pending 改回
 * --since=origin/master~1 會讓所有 script 測試維持全綠而 gate 退回 git 推測。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const YML = readFileSync(path.resolve(__dirname, '../../.github/workflows/deploy.yml'), 'utf8');

/** 剝掉 # 註解 —— 解釋「為什麼不用 git 推測」的那段本身就含 origin/master~1 這些字。 */
const CODE = YML.split('\n')
  .filter((l) => !/^\s*#/.test(l))
  .join('\n');

const between = (a: string, b: string) => YML.slice(YML.indexOf(a), YML.indexOf(b));

describe('deploy.yml — migration gate 接線', () => {
  it('pending 清單來自 d1_migrations，不是 git 推測', () => {
    const step = between('Compute pending migrations', 'D1 migration safety check');
    expect(step).toContain('SELECT name FROM d1_migrations');
    expect(step).toContain('node scripts/d1-pending-migrations.js migrations');
  });

  it('gate 吃的是那份 pending 清單', () => {
    const step = between('D1 migration safety check', 'Apply pending migrations');
    expect(step).toMatch(/check-migration-safety\.sh --pending=/);
  });

  it('不可以退回 git 推測 —— 那條路有三種洗白', () => {
    // 被擋下的 migration 之後有 commit 動到 migrations/ 就降級成 pre-existing、
    // git mv 換編號也會、一次推多個 commit 也會。三種都實測過。
    expect(CODE).not.toContain('origin/master~1');
    expect(CODE).not.toContain('github.event.before');
    expect(CODE).not.toMatch(/check-migration-safety\.sh --since=/);
  });

  it('gate 步驟不可被 continue-on-error / || true 弱化', () => {
    const step = between('D1 migration safety check', 'Apply pending migrations');
    expect(step).not.toMatch(/continue-on-error|\|\| true/);
  });

  it('產清單那步也不可以被吞錯 —— 空清單 = 全部放行', () => {
    // 這步掛掉而被吞的話，> pending.txt 還是會留下一個空檔，gate 讀到 0 pending →
    // 全部判 pre-existing → PASS。跟本 workflow 修掉的原始 bug 是同一個形狀，
    // 只是換個地方發生。（現況是 fail-closed：wrangler 掛 → node 拿到空 stdin →
    // JSON 解析失敗 → exit 2 → 整步紅。這條鎖住的是別人手賤加 || true。）
    const step = between('Compute pending migrations', 'D1 migration safety check');
    expect(step).not.toMatch(/continue-on-error|\|\| true/);
  });

  it('產清單 → gate → apply，順序不可亂（gate 排在 apply 後面等於沒有 gate）', () => {
    const compute = YML.indexOf('Compute pending migrations');
    const gate = YML.indexOf('D1 migration safety check');
    const apply = YML.indexOf('Apply pending migrations');
    expect(compute).toBeGreaterThan(-1);
    expect(compute).toBeLessThan(gate);
    expect(gate).toBeLessThan(apply);
  });

  it('產清單那步要有 CF credential，否則 wrangler 查不到 d1_migrations', () => {
    const step = between('Compute pending migrations', 'D1 migration safety check');
    expect(step).toContain('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}');
  });
});
