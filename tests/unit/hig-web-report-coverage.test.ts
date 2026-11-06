/**
 * web HIG 取證彙整報告的守門（flutter#531 / trip-planner#1568）：
 * 報告的場景數、發現編號、截圖連結不能和 `SCENES` 與實際檔案脫節。
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SCENES } = require('../e2e/hig-scene-fixtures.js') as { SCENES: { name: string }[] };

const REPORT = 'docs/qa/2026-11-04-hig-web-screenshot-review.md';
const DIR = 'docs/qa/';
const report = readFileSync(REPORT, 'utf8');

/** 取某個 `## 標題` 到下一個 `## ` 之間的內文（含 `###` 子節）。 */
function section(title: string): string {
  const start = report.indexOf(`\n## ${title}`);
  expect(start, `報告缺少「## ${title}」`).toBeGreaterThanOrEqual(0);
  const rest = report.slice(start + 1);
  const next = rest.indexOf('\n## ', 3);
  return next < 0 ? rest : rest.slice(0, next);
}

describe('HIG web 彙整報告', () => {
  it('報告宣告的場景總數等於 SCENES 實際數量', () => {
    const m = report.match(/場景總數：\*\*(\d+)\*\*/);
    expect(m, '報告缺少「場景總數：**N**」').not.toBeNull();
    expect(Number(m![1])).toBe(SCENES.length);
  });

  it('場景索引表列出的場景與 SCENES 完全一致', () => {
    const rows = section('場景索引')
      .split('\n')
      .map((l) => l.match(/^\| `([a-z0-9-]+)` \|/)?.[1])
      .filter((n): n is string => !!n);
    expect(rows.length).toBe(SCENES.length);
    expect(new Set(rows).size).toBe(rows.length);
    expect([...rows].sort()).toEqual(SCENES.map((s) => s.name).sort());
  });

  it('發現表的編號無重複、每列欄位齊全', () => {
    const lines = section('需要處理的發現').split('\n').filter((l) => /^\| \d+ \|/.test(l));
    const ids = lines.map((l) => Number(l.match(/^\| (\d+) \|/)![1]));
    expect(ids.length).toBeGreaterThan(50);
    expect(new Set(ids).size, '發現編號重複').toBe(ids.length);
    for (const l of lines) {
      const cells = l.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
      expect(cells.length, l.slice(0, 40)).toBe(7);
      expect(cells.every((c) => c.length > 0), `欄位有空白：${l.slice(0, 40)}`).toBe(true);
    }
  });

  it('報告引用的截圖檔都存在', () => {
    const refs = [...report.matchAll(/\]\((2026-11-04-hig-web-screenshots\/[^)\s]+\.png)\)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(100);
    const missing = [...new Set(refs)].filter((p) => !existsSync(DIR + decodeURI(p)));
    expect(missing).toEqual([]);
  });
});
