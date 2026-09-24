/**
 * PR3 — import endpoint + frontend wiring (source grep).
 * Import lifecycle behavior is covered by trip-import-lifecycle.integration.test.ts.
 * These remaining checks cover validation and frontend wiring not replaced there.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const VALIDATE = read('functions/api/trips/_import.ts');
const BTN = read('src/components/trips/ImportTripButton.tsx');
const LIST = read('src/pages/TripsListPage.tsx');

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
