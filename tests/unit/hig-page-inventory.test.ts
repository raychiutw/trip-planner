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

// #1566：場景與清單對照不能脫節——每個 HIG 場景名稱都必須出現在清單文件，新增場景沒登記就會紅。
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SCENES } = require('../e2e/hig-scene-fixtures.js') as { SCENES: { name: string }[] };
describe('HIG 場景登記在清單', () => {
  it.each(SCENES.map((s) => s.name))('場景 %s 已登記在清單', (name) => {
    // 必須在表格列內（行內 code、整格或頓號分隔），不是文件別處提到同一個字。
    const hit = doc.split('\n').some((line) => line.startsWith('|') && new RegExp(`(^|[\\s|、\`])${name}($|[\\s|、\`（])`).test(line));
    expect(hit, `${name} 沒有登記在清單的表格列`).toBe(true);
  });
});
