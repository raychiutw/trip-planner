/**
 * v2.33.4 polish — AddCustomStopPage Day context strip 改 M/D 短格式對齊
 * mockup「Day 3 · 7/28（一）」(不再用 ISO「Day 3 · 2026-07-31（五）」)。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/AddCustomStopPage.tsx'),
  'utf8',
);

describe('AddCustomStopPage — v2.33.4 Day label M/D 短格式', () => {
  it('import formatDateLabel from lib/mapDay', () => {
    expect(SRC).toMatch(/import \{ formatDateLabel \} from '\.\.\/lib\/mapDay'/);
  });

  it('deriveDayLabel 使用 formatDateLabel 把 ISO date 轉 M/D', () => {
    expect(SRC).toMatch(/const shortDate = date \? formatDateLabel\(date\) : ''/);
  });

  it('不再 raw 顯示 ISO `date`', () => {
    expect(SRC).not.toMatch(/Day \$\{dayNum\}\$\{date \? ` · \$\{date\}`/);
  });
});
