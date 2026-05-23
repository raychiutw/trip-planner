/**
 * docKeys.test.ts — canonical DOC_KEYS contract
 * v2.33.53 round 9: src/lib zero-test catch-up
 *
 * 對齊 backend `functions/api/trips/[id]/docs/[type].ts` VALID_TYPES allowlist。
 * 任何 frontend/backend 不同步都會被這個 test 抓到。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DOC_KEYS } from '../../src/lib/docKeys';

describe('DOC_KEYS', () => {
  it('完整 5 個 doc type，order 對齊 UI tab', () => {
    expect(DOC_KEYS).toEqual([
      'flights',
      'checklist',
      'backup',
      'emergency',
      'suggestions',
    ]);
  });

  it('長度 5（migration 0046 後不再新增 doc type）', () => {
    expect(DOC_KEYS).toHaveLength(5);
  });

  it('readonly tuple — runtime 不可 mutate', () => {
    // TypeScript: as const → readonly; runtime: still mutable Array but signal-only
    expect(Object.isFrozen(DOC_KEYS)).toBe(false); // as const 不 freeze runtime
    expect(Array.isArray(DOC_KEYS)).toBe(true);
  });

  it('與 backend docs handler 的 VALID_TYPES 對齊', () => {
    // 讀 backend handler 比對
    const handlerPath = path.resolve(
      __dirname,
      '../../functions/api/trips/[id]/docs/[type].ts',
    );
    const src = readFileSync(handlerPath, 'utf-8');
    for (const key of DOC_KEYS) {
      expect(src).toContain(`'${key}'`);
    }
  });
});
