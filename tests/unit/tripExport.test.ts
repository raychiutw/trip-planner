/**
 * tripExport.test.ts — leaf-lib guards.
 *
 * v2.37.0 (PR2): CSV + Markdown export removed (unused). PDF moved to the
 * component layer (renderTripPrintPdf). This file now only builds the JSON
 * round-trip export. The safeFileBase path-traversal mitigation (v2.33.36
 * security audit) must not regress, and lib must stay a leaf (no component /
 * html2pdf import).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(path.resolve(__dirname, '../../src/lib/tripExport.ts'), 'utf-8');

describe('tripExport.ts — safeFileBase (path traversal)', () => {
  it('strip 控制字元 / 路徑分隔符 / windows 保留字', () => {
    // eslint-disable-next-line no-control-regex
    expect(SRC).toMatch(/\[\\\\\/\\x00-\\x1f<>:"\|\?\*\]/);
  });
  it('slice 80 字元上限', () => { expect(SRC).toContain('.slice(0, 80)'); });
  it("fallback 'trip' 當完全是不合法字元", () => { expect(SRC).toContain("|| 'trip'"); });
  it('用於 download filename（防 Safari 路徑遍歷）', () => { expect(SRC).toMatch(/safeFileBase\(/); });
});

describe('tripExport.ts — CSV / Markdown removed (v2.37.0 PR2)', () => {
  it('no csvSafe helper', () => { expect(SRC).not.toMatch(/csvSafe/); });
  it('no md / csv format branches', () => {
    expect(SRC).not.toContain("format === 'md'");
    expect(SRC).not.toContain("format === 'csv'");
  });
  it('no CSV BOM / 17-col schema remnants', () => {
    expect(SRC).not.toContain("'\\uFEFF'");
    expect(SRC).not.toContain("'購物必買'");
  });
  it('leaf lib does not import html2pdf (moved to renderTripPrintPdf)', () => {
    expect(SRC).not.toContain('html2pdf');
  });
  it('leaf lib does not import a React component (lib stays a leaf)', () => {
    expect(SRC).not.toMatch(/from '\.\.\/components/);
  });
});

describe('tripExport.ts — JSON round-trip export', () => {
  it('exports buildTripExportJson + downloadTripJson + tripFileBase', () => {
    expect(SRC).toMatch(/export function buildTripExportJson/);
    expect(SRC).toMatch(/export async function downloadTripJson/);
    expect(SRC).toMatch(/export function tripFileBase/);
  });
  it('freezes schemaVersion 1', () => { expect(SRC).toContain('schemaVersion: 1'); });
});
