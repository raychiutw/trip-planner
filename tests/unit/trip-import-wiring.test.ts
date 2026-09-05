/**
 * PR3 — import endpoint + frontend wiring (source grep).
 * The D1 orchestration can't be unit-tested without a live binding (verified on
 * prod); this locks the security + structural contract.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const ENDPOINT = read('functions/api/trips/import.ts');
const VALIDATE = read('functions/api/trips/_import.ts');
// v2.40.0 PR3: orchestration primitives extracted to _tripWrite (shared with clone).
const TRIPWRITE = read('functions/api/trips/_tripWrite.ts');
const BTN = read('src/components/trips/ImportTripButton.tsx');
const LIST = read('src/pages/TripsListPage.tsx');

describe('POST /api/trips/import — endpoint', () => {
  // #1258：entries + trip_entry_pois 的 INSERT 與 master note fallback 搬進 entry intake，
  // 由 tests/api/import-entry-note.integration.test.ts 與 entry-intake.integration.test.ts 走行為驗證。
  it('runs the pure validator and rejects on failure', () => {
    expect(ENDPOINT).toMatch(/parseAndValidateImport/);
    expect(ENDPOINT).toMatch(/if \(!result\.ok\) throw new AppError/);
  });
  it('creates a NEW trip id, owner = current user, data_source imported', () => {
    // 2026-07-21：原本斷言 `crypto.randomUUID()`，那是匯入自己寫死的 `imp-<uuid>`。
    // ID 規則已收斂到 src/lib/tripId 的共用 genTripId（owner 由 demo 行程編號
    // 不合慣例而發現），這裡改鎖「用共用產生器」而非鎖特定亂數實作。
    expect(ENDPOINT).toMatch(/generateUniqueTripId\(/);
    expect(ENDPOINT).toContain("'imported'");
    expect(ENDPOINT).toMatch(/owner_user_id/);
  });
  // #1256：「既有 POI 絕不改」改由 tests/api/poi-resolver-policy.integration.test.ts
  // 走 findOrCreatePoi({ policy: 'keep' }) 的行為驗證，不再 grep resolvePoi 原始碼。
  it('rolls back (connect-root delete) on any failure (shared _tripWrite)', () => {
    expect(ENDPOINT).toMatch(/await rollbackTrip\(/);
    expect(TRIPWRITE).toMatch(/export async function rollbackTrip/);
    expect(TRIPWRITE).toMatch(/DELETE FROM trips WHERE id = \?/);
  });
  it('remaps segments by positional index to new entry ids', () => {
    expect(ENDPOINT).toMatch(/posToEntryId/);
    expect(ENDPOINT).toMatch(/from_entry_id, to_entry_id/);
  });
});

describe('_import.ts — security boundary', () => {
  it('exports the validator + dangerous-key guard + caps (incl TOTAL caps)', () => {
    expect(VALIDATE).toMatch(/export function parseAndValidateImport/);
    expect(VALIDATE).toMatch(/export function hasDangerousKey/);
    expect(VALIDATE).toMatch(/MAX_IMPORT_BYTES = 512 \* 1024/);
    expect(VALIDATE).toMatch(/MAX_TOTAL_ENTRIES/);
    expect(VALIDATE).toMatch(/MAX_TOTAL_POIS/);
  });
  it('catches non-enumerable + symbol keys (Object.getOwnPropertyNames/Symbols)', () => {
    expect(VALIDATE).toMatch(/getOwnPropertyNames/);
    expect(VALIDATE).toMatch(/getOwnPropertySymbols/);
  });
  it('rejects __proto__ / constructor / prototype', () => {
    expect(VALIDATE).toMatch(/'__proto__', 'constructor', 'prototype'/);
  });
  it('coerces every CHECK-constrained enum', () => {
    expect(VALIDATE).toMatch(/POI_TYPES/);
    expect(VALIDATE).toMatch(/SEG_MODES/);
    expect(VALIDATE).toMatch(/RESV_KINDS/);
    expect(VALIDATE).toMatch(/EMERGENCY_KINDS/);
  });
});

describe('ImportTripButton — frontend', () => {
  it('file input + shallow validate (schemaVersion + size) + POST + navigate', () => {
    expect(BTN).toMatch(/type="file"/);
    expect(BTN).toMatch(/schemaVersion\b/);
    expect(BTN).toMatch(/512 \* 1024/);
    expect(BTN).toMatch(/apiFetch[^\n]*'\/trips\/import'[^\n]*method: 'POST'/s);
    expect(BTN).toMatch(/navigate\(`\/trips\?selected=/);
  });
  it('is rendered on the trips list titlebar', () => {
    expect(LIST).toMatch(/import ImportTripButton from/);
    expect(LIST).toMatch(/<ImportTripButton \/>/);
  });
});
