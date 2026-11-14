// @vitest-environment node
/**
 * #1717：選中行程卡的圓點不可 absolute 疊在卡身上（拿掉封面後會壓到眉標文字），
 * 改成眉標前的行內圓點。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(path.resolve(__dirname, '../../src/pages/TripsListPage.tsx'), 'utf8');

describe('#1717 選中行程卡圓點不壓字', () => {
  it('卡片本身不再用 ::before 畫 absolute 圓點', () => {
    expect(SRC).not.toMatch(/\.tp-trip-card(\[data-tone\])?\.is-active::before/);
  });

  it('圓點改畫在眉標前，跟著文字流排', () => {
    const rule = SRC.match(/\.tp-trip-card\.is-active \.tp-trip-card-eyebrow::before\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toMatch(/display:\s*inline-block/);
    expect(rule![0]).not.toMatch(/position:\s*absolute/);
  });
});
