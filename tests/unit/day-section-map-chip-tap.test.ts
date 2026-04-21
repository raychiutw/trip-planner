/**
 * day-section-map-chip-tap.test.ts — F010 TDD test
 *
 * 驗證 DaySection 的 .day-map-chip CSS 含 min-height: 44px，
 * 符合 Apple HIG 最小 tap target 要求。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const DAY_SECTION_SRC = resolve(__dirname, '../../src/components/trip/DaySection.tsx');
const source = readFileSync(DAY_SECTION_SRC, 'utf-8');

describe('F010 — 看地圖 chip tap target 44px', () => {
  it('.day-map-chip 含 min-height: 44px（Apple HIG 最小 tap target）', () => {
    // 在 MAP_CHIP_STYLES 中找到 .day-map-chip 的 min-height: 44px
    expect(source).toMatch(/\.day-map-chip[^}]*min-height\s*:\s*44px/s);
  });
});
