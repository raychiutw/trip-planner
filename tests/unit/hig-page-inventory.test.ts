/**
 * HIG 取證用的頁面清單守門（flutter#531 / trip-planner#1564）：
 * 路由表每一條路徑都必須出現在清單文件裡，新增路由而沒登記就會紅。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const main = readFileSync('src/entries/main.tsx', 'utf8');
const doc = readFileSync('docs/qa/2026-11-04-hig-page-inventory.md', 'utf8');

const routePaths = [...new Set([...main.matchAll(/<Route[^>]*?\spath="([^"]+)"/gs)].map((m) => m[1]))];

describe('HIG 頁面清單涵蓋路由表', () => {
  it('路由表至少解析出 40 條（解析器沒壞）', () => {
    expect(routePaths.length).toBeGreaterThanOrEqual(40);
  });

  it.each(routePaths)('路由 %s 已登記在清單', (p) => {
    expect(doc).toContain(`\`${p}\``);
  });
});
