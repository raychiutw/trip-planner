/**
 * trip-export-safety.test.ts — filename sanitize hardening (v2.33.36 audit).
 *
 * v2.37.0 (PR2): CSV export + the `csvSafe` injection guard were removed (CSV
 * unused). This file now only guards `safeFileBase` (path-traversal /
 * Content-Disposition injection mitigation), which still protects the JSON + PDF
 * download filenames.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(path.resolve(__dirname, '../../src/lib/tripExport.ts'), 'utf8');

describe('tripExport.ts — safeFileBase hardening', () => {
  it('defines safeFileBase helper that strips path/Windows-reserved chars', () => {
    expect(SRC).toMatch(/function\s+safeFileBase/);
    expect(SRC).toMatch(/\[\\\\\/\\x00-\\x1f<>:"\|\?\*\]/);
    expect(SRC).toMatch(/\.slice\(0,\s*80\)/);
  });

  it('fileBase 經 safeFileBase 套用', () => {
    expect(SRC).toMatch(/safeFileBase\(`\$\{tripName\}-\$\{today\}`\)/);
  });
});

describe('safeFileBase regex behavior', () => {
  it('strips slash / colon / pipe / asterisk', () => {
    // eslint-disable-next-line no-control-regex
    const stripped = '../../etc/passwd:1'.replace(/[\\/\x00-\x1f<>:"|?*]/g, '_');
    expect(stripped).not.toMatch(/[\\/:|*?<>"]/);
  });

  it('strips CR/LF (Content-Disposition injection)', () => {
    // eslint-disable-next-line no-control-regex
    const stripped = 'trip\r\nContent-Disposition: x'.replace(/[\\/\x00-\x1f<>:"|?*]/g, '_');
    expect(stripped).not.toMatch(/[\r\n]/);
  });
});
