/**
 * entries.ts source forward — v2.31.94 custom-stop-location-picker
 *
 * #1257：POST /entries 的 POI 建立改走 entry intake（createEntry）。原本 grep
 * findOrCreatePoi 呼叫區塊的 source-forward 守衛改由
 * tests/api/entry-intake-handlers.integration.test.ts 走 handler 驗 pois.source。
 * 這裡只留「handler 仍讀 body.source」的最小結構鎖。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILE = resolve(__dirname, '../../functions/api/trips/[id]/days/[num]/entries.ts');

describe('entries.ts POST handler source forward (v2.31.94)', () => {
  const code = readFileSync(FILE, 'utf-8');
  it('forwards body.source with ai fallback', () => {
    expect(code).toMatch(/typeof body\.source === 'string' && body\.source\) \|\| 'ai'/);
  });
});
