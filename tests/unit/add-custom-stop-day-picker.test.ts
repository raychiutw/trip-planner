// @vitest-environment node
/**
 * 2026-07-07 AddCustomStopPage day picker（user 要求：新增景點可選加入哪天）
 *
 * 原本 URL ?day 鎖死不可切（AddStopPage v2.31.99 起有 chips，本頁漏）。
 * source-grep 鎖：chips render + handlePickDay 切天 + allDays 存全列表。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/AddCustomStopPage.tsx'),
  'utf8',
);

describe('AddCustomStopPage day picker chips', () => {
  it('render day picker chips（testid + tablist a11y）', () => {
    expect(SRC).toContain('data-testid="add-custom-stop-daypicker"');
    expect(SRC).toContain('add-custom-stop-daypicker-chip-${d.dayNum}');
    expect(SRC).toMatch(/role="tablist"[\s\S]{0,80}aria-label="選擇加入哪天"/);
  });

  it('handlePickDay 切天走 URL replaceState（對齊 AddStopPage pattern）', () => {
    expect(SRC).toMatch(/sp\.set\('day', String\(next\)\)/);
    expect(SRC).toContain('setSearchParams(sp, { replace: true })');
  });

  it('days fetch 存 allDays 全列表（chips 資料源）', () => {
    expect(SRC).toContain('setAllDays(days)');
  });
});
