/**
 * tripExport.test.ts — source-grep guard for security hardening
 * v2.33.53 round 9: src/lib zero-test catch-up
 *
 * `downloadTripFormat` 對 DOM + apiFetch + html2pdf 依賴重，
 * 內部 helper `safeFileBase` / `csvSafe` 不 export → 用 source-grep
 * 鎖死 v2.33.36 security audit round 1 的 mitigation 不被回退。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/lib/tripExport.ts'),
  'utf-8',
);

describe('tripExport.ts — safeFileBase (path traversal)', () => {
  it('strip 控制字元 / 路徑分隔符 / windows 保留字', () => {
    // eslint-disable-next-line no-control-regex
    expect(SRC).toMatch(/\[\\\\\/\\x00-\\x1f<>:"\|\?\*\]/);
  });

  it('slice 80 字元上限', () => {
    expect(SRC).toContain('.slice(0, 80)');
  });

  it("fallback 'trip' 當完全是不合法字元", () => {
    expect(SRC).toContain("|| 'trip'");
  });

  it('用於 download filename（防 Safari 路徑遍歷）', () => {
    expect(SRC).toMatch(/safeFileBase\(/);
  });
});

describe('tripExport.ts — csvSafe (CSV injection)', () => {
  it('偵測 = + - @ \\t \\r 開頭', () => {
    expect(SRC).toMatch(/\^\[=\+\\-@\\t\\r\]/);
  });

  it('prefix 單引號 mitigation', () => {
    expect(SRC).toMatch(/"'" \+ s/);
  });

  it('csvCell wrapper 用 csvSafe 包', () => {
    expect(SRC).toContain('csvSafe(s(v))');
  });
});

describe('tripExport.ts — error handling', () => {
  it('catch 區塊 console.error 記錄底層 error', () => {
    expect(SRC).toContain("console.error('[downloadTripFormat]'");
  });

  it('catch 區塊清掉 print-mode class', () => {
    expect(SRC).toContain("document.body.classList.remove('print-mode')");
  });

  it('catch 區塊 showToast 通知 user', () => {
    expect(SRC).toContain("showToast('下載失敗");
  });
});

describe('tripExport.ts — CSV schema', () => {
  it('CSV BOM 開頭（\\uFEFF）以利 Excel 顯示中文', () => {
    expect(SRC).toContain("'\\uFEFF'");
  });

  it('17 欄 headers（CSV v2 schema R19）', () => {
    expect(SRC).toMatch(/'Day', '日期', '星期'/);
    expect(SRC).toContain("'購物店名'");
    expect(SRC).toContain("'購物必買'");
  });
});

describe('tripExport.ts — format dispatch', () => {
  it('支援 4 種 format: json / md / csv / pdf', () => {
    expect(SRC).toContain("format === 'json'");
    expect(SRC).toContain("format === 'md'");
    expect(SRC).toContain("format === 'csv'");
    expect(SRC).toContain("format === 'pdf'");
  });

  it('PDF 走 html2pdf lazy import', () => {
    expect(SRC).toContain("await import('html2pdf.js')");
  });
});
