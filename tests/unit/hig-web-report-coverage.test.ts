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

  const findingLines = () => section('需要處理的發現').split('\n').filter((l) => /^\| \d+ \|/.test(l));
  const findingIds = () => findingLines().map((l) => Number(l.match(/^\| (\d+) \|/)![1]));

  it('發現表的編號無重複、每列欄位齊全，且總數等於報告宣告的條數', () => {
    const lines = findingLines();
    const ids = findingIds();
    const m = report.match(/發現 \*\*(\d+) 條\*\*/);
    expect(m, '報告缺少「發現 **N 條**」').not.toBeNull();
    expect(ids.length).toBe(Number(m![1]));
    expect(new Set(ids).size, '發現編號重複').toBe(ids.length);
    for (const l of lines) {
      const cells = l.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
      expect(cells.length, l.slice(0, 40)).toBe(7);
      expect(cells.every((c) => c.length > 0), `欄位有空白：${l.slice(0, 40)}`).toBe(true);
    }
  });

  it('發現編號的缺號都是報告宣告的「沒用到的編號」（預先配置給 #1565～#1567 的區段），沒有其他缺號', () => {
    const ids = findingIds();
    const declared = report.match(/沒用到的編號\*\*：([^。]+)。/);
    expect(declared, '報告缺少「**沒用到的編號**：a～b、c～d。」').not.toBeNull();
    const unused = new Set<number>();
    let top = 0;
    for (const part of declared![1].split('、')) {
      const [a, b] = part.split('～').map(Number);
      expect(Number.isInteger(a) && Number.isInteger(b) && a <= b, `無法解析的區段：${part}`).toBe(true);
      for (let n = a; n <= b; n++) unused.add(n);
      top = Math.max(top, b);
    }
    expect(Math.max(...ids), '發現編號超出預先配置的範圍').toBeLessThanOrEqual(top);
    const actualGaps: number[] = [];
    for (let n = 1; n <= top; n++) if (!ids.includes(n)) actualGaps.push(n);
    expect(actualGaps).toEqual([...unused].sort((x, y) => x - y));
  });

  it('發現表「場景」欄引用的場景名稱都存在於 SCENES', () => {
    const names = new Set(SCENES.map((s) => s.name));
    const unknown: string[] = [];
    for (const l of findingLines()) {
      const cells = l.split(/(?<!\\)\|/);
      // 「無畫面」的發現（如死碼元件）引用的是元件名，不是場景。
      if ((cells[cells.length - 2] ?? '').trim().startsWith('無畫面')) continue;
      const cell = cells[2] ?? '';
      const refs = [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      expect(refs.length, `場景欄沒有引用任何場景：${l.slice(0, 40)}`).toBeGreaterThan(0);
      for (const r of refs) if (!names.has(r)) unknown.push(`${l.slice(0, 12)} → ${r}`);
    }
    expect(unknown).toEqual([]);
  });

  it('報告引用的截圖檔都存在', () => {
    const refs = [...report.matchAll(/\]\((2026-11-04-hig-web-screenshots\/[^)\s]+\.png)\)/g)].map((m) => m[1]);
    // 每個場景至少有一張截圖被報告引用（檔名即場景名）；數量由 SCENES 導出，不寫死。
    const shot = (name: string) => refs.some((r) => r.endsWith(`/${name}.png`));
    expect(SCENES.map((s) => s.name).filter((n) => !shot(n)), '報告沒有引用任何截圖的場景').toEqual([]);
    const missing = [...new Set(refs)].filter((p) => !existsSync(DIR + decodeURI(p)));
    expect(missing).toEqual([]);
  });
});
