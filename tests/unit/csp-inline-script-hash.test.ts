import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../..');
const INDEX_HTML = readFileSync(resolve(REPO_ROOT, 'index.html'), 'utf8');
const HEADERS = readFileSync(resolve(REPO_ROOT, 'public/_headers'), 'utf8');

function extractFoucScript(html: string): string {
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1].includes('readMode') && m[1].includes('tp-color-mode')) {
      return m[1];
    }
  }
  throw new Error('FOUC inline script not found in index.html');
}

describe('CSP inline script hash (v2.33.124)', () => {
  it('public/_headers script-src 含 index.html FOUC inline script 的 sha256 hash', () => {
    const script = extractFoucScript(INDEX_HTML);
    const hash = createHash('sha256').update(script, 'utf8').digest('base64');
    const expected = `'sha256-${hash}='`.replace('==\'', '=\'');
    // 直接驗 base64 出現在 _headers
    expect(HEADERS).toContain(`sha256-${hash}`);
  });

  it('FOUC script 仍然存在 index.html（被改名 / 拔除會觸發此 fail）', () => {
    expect(() => extractFoucScript(INDEX_HTML)).not.toThrow();
  });

  it('CSP script-src 仍未開 unsafe-inline（除非未來特意 loosen）', () => {
    const cspMatch = HEADERS.match(/Content-Security-Policy:\s*([^\n]+)/);
    expect(cspMatch).toBeTruthy();
    const scriptSrcMatch = cspMatch![1].match(/script-src\s+([^;]+);/);
    expect(scriptSrcMatch).toBeTruthy();
    expect(scriptSrcMatch![1]).not.toContain("'unsafe-inline'");
  });
});
