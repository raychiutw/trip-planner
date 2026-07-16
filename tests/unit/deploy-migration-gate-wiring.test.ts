/**
 * .github/workflows/deploy.yml — D1 migration gate 的接線鎖。
 *
 * check-migration-safety.test.ts 只證明「script 會honour 你給它的 --since」，那從來不是
 * 問題所在。gate 從 2026-05-04 incident 後在 CI 裡從未擋下任何東西，root cause 全部在
 * 這個 yml：checkout 深度不夠 → ref 解不開 → git fatal → 被吞 → exit 0。
 *
 * 所以這裡鎖的是 script 看不到、但決定它是否有意義的那幾格接線。少了這一檔，把
 * --since 改回 origin/master~1 會讓所有 26 條 script 測試維持全綠，而多 commit push
 * 的盲區原封不動回來（此 repo 三種 merge 策略都開著，rebase-merge 會讓 master 一次前進多格）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const YML = readFileSync(path.resolve(__dirname, '../../.github/workflows/deploy.yml'), 'utf8');

/** gate 步驟到 apply 步驟之間那段 —— 弱化 gate 的手腳都會落在這裡。 */
const gateStep = () =>
  YML.slice(YML.indexOf('D1 migration safety check'), YML.indexOf('Apply pending migrations'));

describe('deploy.yml — migration gate 接線', () => {
  it('checkout 要深到看得見 event.before（fetch-depth: 0）', () => {
    expect(YML).toMatch(/uses: actions\/checkout@[\s\S]{0,400}?fetch-depth: 0/);
  });

  it('gate 用 github.event.before，不是固定回看一格的 origin/master~1', () => {
    expect(YML).toContain('PUSH_BEFORE: ${{ github.event.before }}');
    expect(gateStep()).toMatch(/check-migration-safety\.sh --since="\$\{PUSH_BEFORE:-/);
  });

  it('回落值不可以是 origin/master~1 —— 那正是本 workflow 修掉的東西', () => {
    // 這條分開寫：上面那條只確認有 PUSH_BEFORE，回落成 ~1 一樣會過。
    expect(gateStep()).not.toContain('origin/master~1');
  });

  it('workflow_dispatch 必須自己帶 since，不能靜默退化成較弱的基準', () => {
    const dispatch = YML.slice(YML.indexOf('workflow_dispatch:'), YML.indexOf('concurrency:'));
    expect(dispatch).toMatch(/inputs:[\s\S]*since:[\s\S]*required: true/);
    expect(YML).toContain('SINCE_INPUT: ${{ inputs.since }}');
  });

  it('gate 步驟不可被 continue-on-error / || true 弱化', () => {
    expect(gateStep()).not.toMatch(/continue-on-error|\|\| true/);
  });

  it('gate 必須排在 apply 之前 —— 排在後面等於沒有 gate', () => {
    expect(YML.indexOf('D1 migration safety check')).toBeLessThan(
      YML.indexOf('Apply pending migrations'),
    );
  });
});
