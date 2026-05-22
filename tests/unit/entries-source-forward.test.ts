/**
 * entries.ts source forward — v2.31.94 custom-stop-location-picker
 *
 * POST /api/trips/:id/days/:n/entries 內 findOrCreatePoi 呼叫之前 hardcode
 * `source: 'ai'`（entries.ts:87），導致 frontend POST body source 永不 reach
 * pois.source。本 PR 改 forward `body.source` 進 pois.source 作為 dedup 信號
 * 與 audit metadata（'custom' / 'google' / 'favorite' / etc.）。
 *
 * Source-grep test 驗證 code shape — 沒實際 D1 setup。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILE = resolve(__dirname, '../../functions/api/trips/[id]/days/[num]/entries.ts');

describe('entries.ts POST handler source forward (v2.31.94)', () => {
  const code = readFileSync(FILE, 'utf-8');
  const findOrCreateCall = code.match(/poiId\s*=\s*await\s+findOrCreatePoi\(db,\s*\{[\s\S]*?\}\);/);

  it('findOrCreatePoi call exists', () => {
    expect(findOrCreateCall).not.toBeNull();
  });

  it('findOrCreatePoi block no longer hardcodes source: \'ai\'', () => {
    const block = findOrCreateCall?.[0] ?? '';
    // Old: source: 'ai'
    // New: source: (typeof body.source === 'string' && body.source) || 'ai'
    expect(block).not.toMatch(/source:\s*['"]ai['"]\s*,?\s*\}\)/);
  });

  it('findOrCreatePoi block forwards body.source via string guard with \'ai\' fallback', () => {
    const block = findOrCreateCall?.[0] ?? '';
    // Accept either of the canonical forward patterns:
    //   source: (typeof body.source === 'string' && body.source) || 'ai',
    //   source: typeof body.source === 'string' && body.source ? body.source : 'ai',
    const forwardPattern =
      /source:\s*\(?\s*typeof\s+body\.source\s*===?\s*['"]string['"]\s*&&\s*body\.source\s*\)?\s*(\|\||\?\s*body\.source\s*:)\s*['"]ai['"]/;
    expect(block).toMatch(forwardPattern);
  });

  it('trip_entries.source INSERT path 仍維持 body.source ?? \'ai\'（未影響 row record source）', () => {
    // trip_entries.source col 早就接受 body.source (line ~103), 本 PR 不動該行
    expect(code).toMatch(/body\.source\s*\?\?\s*['"]ai['"]/);
  });
});
