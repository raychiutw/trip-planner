/**
 * no-stale-terracotta-fallback.test.ts — design token drift guard
 * v2.33.56 round 6c residual: stale `#c0392b` / `rgba(192, 57, 43, ...)`
 * fallback rip-out.
 *
 * 之前 27+ 個 `var(--color-priority-high-dot, #c0392b)` 寫死舊 Flat UI 紅
 * (`#c0392b`)，跟現在 token `#C13515` terracotta 不一致。CSS variable 在
 * 2026 全 browser universal，fallback 純粹是 drift 來源。strip 後 token
 * miss 直接 inherit/transparent，視覺上更容易 spot 問題、不會 silent
 * 偏離 design system。
 *
 * 此 test 防止未來 PR 偷渡舊 fallback 回來。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => full.endsWith(e))) out.push(full);
  }
  return out;
}

const SRC_ROOT = path.resolve(__dirname, '../../src');
const CSS_ROOT = path.resolve(__dirname, '../../css');
const STALE_PATTERNS = [
  /#c0392b/i, // old Flat UI red — superseded by terracotta #C13515
  /rgba\(192,\s*57,\s*43/, // same RGB triplet for old red
];

describe('design token — no stale terracotta fallback', () => {
  it('no `#c0392b` / `rgba(192, 57, 43, ...)` in src/ or css/', () => {
    const files = [
      ...walk(SRC_ROOT, ['.ts', '.tsx']),
      ...walk(CSS_ROOT, ['.css']),
    ];
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      // 不掃 test 檔自己（提及 stale 字串教學用途）
      if (file.includes('no-stale-terracotta-fallback.test.ts')) continue;

      const src = readFileSync(file, 'utf-8');
      for (const pattern of STALE_PATTERNS) {
        if (pattern.test(src)) {
          violations.push(`${path.relative(SRC_ROOT, file)} — matches ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('canonical priority-high token 仍存在 css/tokens.css', () => {
    const tokens = readFileSync(path.join(CSS_ROOT, 'tokens.css'), 'utf-8');
    expect(tokens).toContain('--color-priority-high-bg: rgba(193, 53, 21, 0.12)');
    expect(tokens).toContain('--color-priority-high-dot: #C13515');
  });
});
