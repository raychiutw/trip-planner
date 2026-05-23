/**
 * lib-no-reverse-import.test.ts — architectural guard
 * v2.33.54 round 10: src/lib runtime reverse imports rip-out
 *
 * `src/lib/` 是架構 leaf — 不允許 import from hooks / components / pages /
 * App / main / store / providers / context。任何違反此規則的 import 都會被
 * 此 test 抓到。
 *
 * 違反時 fix 路徑：把被 import 的 pure logic 拆到 lib/，原檔改 re-export
 * 維持 backward compat。範例：
 *   - hooks/useOnlineStatus → lib/networkBus + hook re-export
 *   - components/shared/Toast → lib/toastBus + component re-export
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const LIB_DIR = path.resolve(__dirname, '../../src/lib');

const FORBIDDEN = [
  '../hooks/',
  '../components/',
  '../pages/',
  '../App',
  '../main',
  '../store/',
  '../providers/',
  '../context/',
  '../contexts/',
];

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkTs(full));
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

describe('src/lib reverse import guard', () => {
  it('no file in src/lib imports from hooks/components/pages/App/main/store/providers/context', () => {
    const files = walkTs(LIB_DIR);
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf-8');
      for (const forbidden of FORBIDDEN) {
        // Match: from '../hooks/foo' or from "../hooks/foo"
        const pattern = new RegExp(`from\\s+['"]${forbidden.replace(/\//g, '\\/')}`, 'm');
        if (pattern.test(src)) {
          violations.push(`${path.relative(LIB_DIR, file)} → ${forbidden}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
