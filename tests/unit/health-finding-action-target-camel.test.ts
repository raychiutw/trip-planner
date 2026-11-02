// @vitest-environment node
/**
 * v2.31.14 fix: TripHealthCheckPage Finding.actionTarget camelCase。
 *
 * Bug found in prod QA：Backend response 經 deepCamel 回
 * `actionTarget: { day, entryId }` (camel)；frontend Finding type 寫
 * `action_target?: { day?, entry_id? }` (snake) + 6 處 reference 都 snake
 * → 永遠 undefined → 「前往景點」/「前往 Day」button 永不 render。
 *
 * 同 #573 EditTripPage camelCase 對齊 bug 家族。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/TripHealthCheckPage.tsx'),
  'utf8',
);

describe('v2.31.14 TripHealthCheckPage actionTarget camelCase', () => {
  it('Finding type 用 camelCase actionTarget / entryId', () => {
    const findingType = SRC.match(/interface Finding[\s\S]*?\n\}/);
    expect(findingType).not.toBeNull();
    expect(findingType![0]).toMatch(/actionTarget\?:\s*\{\s*day\?:\s*number;\s*entryId\?:\s*number/);
  });

  it('「前往景點」button 用 f.actionTarget?.entryId (不再用 action_target.entry_id)', () => {
    expect(SRC).toMatch(/typeof f\.actionTarget\?\.entryId === 'number'/);
    expect(SRC).toMatch(/goToEntry\(f\.actionTarget!\.entryId!\)/);
  });

  it('「前往 Day」button 用 f.actionTarget?.day (不再用 action_target.day)', () => {
    expect(SRC).toMatch(/typeof f\.actionTarget\?\.day === 'number'\s*&&\s*typeof f\.actionTarget\?\.entryId !== 'number'/);
    expect(SRC).toMatch(/goToDay\(f\.actionTarget!\.day!\)/);
  });

  it('舊 snake_case 在實際 JSX 已拔（comment 內描述可保留）', () => {
    // 確認 JSX 區段沒 f.action_target / f.action_target.entry_id 殘留
    expect(SRC).not.toMatch(/typeof f\.action_target\?/);
    expect(SRC).not.toMatch(/goToEntry\(f\.action_target/);
    expect(SRC).not.toMatch(/goToDay\(f\.action_target/);
  });
});
