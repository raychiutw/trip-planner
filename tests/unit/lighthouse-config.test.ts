/**
 * F001 — lighthouserc.json 結構驗證
 * 確保 Lighthouse CI config 存在且包含必要的 perf budget 設定
 */

import fs from 'fs';
import path from 'path';

const configPath = path.resolve(__dirname, '../../lighthouserc.json');

describe('lighthouserc.json', () => {
  let config: { ci: { collect: { url: string[]; numberOfRuns: number }; assert: { assertions: Record<string, unknown> }; upload: { target: string } } };

  beforeAll(() => {
    const raw = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(raw);
  });

  it('檔案存在且可被 JSON.parse 解析', () => {
    expect(() => {
      const raw = fs.readFileSync(configPath, 'utf-8');
      JSON.parse(raw);
    }).not.toThrow();
  });

  it('numberOfRuns >= 3（確保結果穩定）', () => {
    expect(config.ci.collect.numberOfRuns).toBeGreaterThanOrEqual(3);
  });

  it('包含 5 個目標 URL（root / trip / stop detail / explore / login — task 6.3 後新 IA public routes）', () => {
    expect(config.ci.collect.url).toHaveLength(5);
    const urls = config.ci.collect.url.join('\n');
    expect(urls).toMatch(/\/$/m); // root
    expect(urls).toContain('/trip/');
    expect(urls).toContain('/stop/');
    expect(urls).toContain('/explore');
    expect(urls).toContain('/login');
  });

  it('a11y threshold ≥ 0.9（task 6.2 — 新 IA public routes 必達標）', () => {
    const a11y = config.ci.assert.assertions['categories:accessibility'] as [string, { minScore: number }] | undefined;
    expect(a11y, 'lighthouserc.json 必須含 categories:accessibility').toBeTruthy();
    expect(a11y?.[1]?.minScore).toBeGreaterThanOrEqual(0.9);
  });

  it('assertions 含 largest-contentful-paint（LCP）', () => {
    expect(config.ci.assert.assertions).toHaveProperty('largest-contentful-paint');
  });

  it('assertions 含 total-blocking-time（TBT）', () => {
    expect(config.ci.assert.assertions).toHaveProperty('total-blocking-time');
  });

  it('assertions 含 cumulative-layout-shift（CLS）', () => {
    expect(config.ci.assert.assertions).toHaveProperty('cumulative-layout-shift');
  });

  it('所有 assertion 均為 warn 模式（non-blocking）', () => {
    const assertions = config.ci.assert.assertions;
    for (const [key, value] of Object.entries(assertions)) {
      const arr = value as [string, unknown];
      expect(arr[0]).toBe('warn');
    }
  });
});
