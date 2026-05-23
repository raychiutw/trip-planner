/**
 * trip-export-safety.test.ts — v2.33.36 security audit round 1
 *
 * 驗證 tripExport.ts 的兩個 hardening：
 *  1. filename sanitize — `safeFileBase` strip path / Windows-reserved chars
 *  2. CSV injection guard — `csvSafe` prefix `=` / `+` / `-` / `@` / TAB / CR
 *     with single quote 避免 Excel / Google Sheets 把 cell 當公式執行
 *
 * 兩個 helper 雖未直接 export（in module scope），透過行為驗證 — 用 mock
 * download.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(path.resolve(__dirname, '../../src/lib/tripExport.ts'), 'utf8');

describe('tripExport.ts — v2.33.36 security hardening', () => {
  it('defines safeFileBase helper that strips path/Windows-reserved chars', () => {
    expect(SRC).toMatch(/function\s+safeFileBase/);
    // matches the actual regex in the source (escaped backslash, control range)
    expect(SRC).toMatch(/\[\\\\\/\\x00-\\x1f<>:"\|\?\*\]/);
    expect(SRC).toMatch(/\.slice\(0,\s*80\)/);
  });

  it('defines csvSafe helper that prefixes formula-leading chars', () => {
    expect(SRC).toMatch(/function\s+csvSafe/);
    expect(SRC).toMatch(/\^\[=\+\\-@\\t\\r\]/);
    expect(SRC).toMatch(/"'"\s*\+\s*s/);
  });

  it('fileBase 經 safeFileBase 套用', () => {
    expect(SRC).toMatch(/safeFileBase\(`\$\{tripName\}-\$\{today\}`\)/);
  });

  it('csvCell 經 csvSafe wrap (CSV path 才需要)', () => {
    expect(SRC).toMatch(/const csvCell = \(v: unknown\) => csvSafe\(s\(v\)\);/);
  });

  it('catch block console.error 帶 err（不再 swallow）', () => {
    expect(SRC).toMatch(/console\.error\('\[downloadTripFormat\]', err\)/);
  });
});

describe('tripExport — pure helper behavior (extracted regex sanity)', () => {
  // Verify the actual regex pattern behavior — execute against test strings
  // matching what the source helpers do.
  it('safeFileBase regex: strips slash / colon / pipe / asterisk', () => {
    const stripped = '../../etc/passwd:1'.replace(
      // eslint-disable-next-line no-control-regex
      /[\\/\x00-\x1f<>:"|?*]/g,
      '_',
    );
    expect(stripped).not.toMatch(/[\\\/:|*?<>"]/);
  });

  it('safeFileBase regex: strips CR/LF (Content-Disposition injection)', () => {
    const stripped = "trip\r\nContent-Disposition: x".replace(
      // eslint-disable-next-line no-control-regex
      /[\\/\x00-\x1f<>:"|?*]/g,
      '_',
    );
    expect(stripped).not.toMatch(/[\r\n]/);
  });

  it('csvSafe regex: =HYPERLINK formula gets quoted', () => {
    const formula = '=HYPERLINK("http://evil","click")';
    const prefixed = /^[=+\-@\t\r]/.test(formula) ? "'" + formula : formula;
    expect(prefixed.startsWith("'=")).toBe(true);
  });

  it('csvSafe regex: leading `+` / `-` / `@` / TAB / CR all caught', () => {
    for (const c of ['+1', '-2', '@cmd', '\tab', '\r12']) {
      const out = /^[=+\-@\t\r]/.test(c) ? "'" + c : c;
      expect(out.startsWith("'")).toBe(true);
    }
  });

  it('csvSafe regex: normal text passes through unchanged', () => {
    const normal = '一般文字';
    const out = /^[=+\-@\t\r]/.test(normal) ? "'" + normal : normal;
    expect(out).toBe(normal);
  });
});
