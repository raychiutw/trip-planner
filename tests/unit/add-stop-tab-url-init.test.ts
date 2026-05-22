/**
 * v2.32.2 fix — AddStopPage tab 初值從 URL param 讀取。
 *
 * Bug context：direct URL `/trip/:id/add-stop?tab=custom` 進來 hardcode
 * `useState<Tab>('search')` 忽略 URL param → 永遠 land 在搜尋 tab。
 *
 * Fix：初值用 IIFE 讀 `searchParams.get('tab')`，allowlist favorites/custom，
 * fallback search。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ADD_STOP_SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/AddStopPage.tsx'),
  'utf8',
);

describe('AddStopPage — tab 初值讀 URL param', () => {
  it('useState<Tab> 不再 hardcoded "search"', () => {
    expect(ADD_STOP_SRC).not.toMatch(/useState<Tab>\('search'\)/);
  });

  it('useState<Tab>(initialTab) 用 derived 初值', () => {
    expect(ADD_STOP_SRC).toMatch(/useState<Tab>\(initialTab\)/);
  });

  it('initialTab 讀 searchParams.get(\'tab\')', () => {
    expect(ADD_STOP_SRC).toMatch(/const initialTab: Tab[\s\S]{0,200}searchParams\.get\('tab'\)/);
  });

  it('allowlist favorites/custom/search 三個值（避免任意值 forward）', () => {
    expect(ADD_STOP_SRC).toMatch(
      /raw === 'favorites' \? 'favorites' : raw === 'custom' \? 'custom' : 'search'/,
    );
  });
});
