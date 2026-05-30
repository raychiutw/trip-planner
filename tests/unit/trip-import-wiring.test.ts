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
const BTN = read('src/components/trips/ImportTripButton.tsx');
const LIST = read('src/pages/TripsListPage.tsx');

describe('POST /api/trips/import — endpoint', () => {
  it('is a POST handler, auth-gated on a V2 user id', () => {
    expect(ENDPOINT).toMatch(/export const onRequestPost/);
    expect(ENDPOINT).toMatch(/requireAuth\(context\)/);
    expect(ENDPOINT).toMatch(/auth\.userId/);
  });
  it('enforces the REAL body size (reads text, caps, then parses — not Content-Length)', () => {
    expect(ENDPOINT).toMatch(/await context\.request\.text\(\)/);
    expect(ENDPOINT).toMatch(/text\.length > MAX_IMPORT_BYTES/);
    expect(ENDPOINT).not.toMatch(/headers\.get\('Content-Length'\)/);
  });
  it('caps trips-per-user (anti import-spam)', () => {
    expect(ENDPOINT).toMatch(/MAX_TRIPS_PER_USER/);
    expect(ENDPOINT).toMatch(/COUNT\(\*\)[\s\S]*owner_user_id/);
  });
  it('chunks batches under D1 limit + RETURNING id throws on miss', () => {
    expect(ENDPOINT).toMatch(/BATCH_CHUNK = 50/);
    expect(ENDPOINT).toMatch(/runChunked/);
    expect(ENDPOINT).toMatch(/function reqId/);
  });
  it('trip_entry_pois carries trip-specific overrides (round-trip fidelity)', () => {
    expect(ENDPOINT).toMatch(/INSERT INTO trip_entry_pois \(entry_id, poi_id, sort_order, description, note, reservation, reservation_url/);
  });
  it('runs the pure validator and rejects on failure', () => {
    expect(ENDPOINT).toMatch(/parseAndValidateImport/);
    expect(ENDPOINT).toMatch(/if \(!result\.ok\) throw new AppError/);
  });
  it('creates a NEW trip id, owner = current user, data_source imported', () => {
    expect(ENDPOINT).toMatch(/crypto\.randomUUID\(\)/);
    expect(ENDPOINT).toContain("'imported'");
    expect(ENDPOINT).toMatch(/owner_user_id/);
  });
  it('always CREATES pois (never find-or-create / mutates the shared catalog)', () => {
    expect(ENDPOINT).toMatch(/INSERT INTO pois/);
    expect(ENDPOINT).not.toMatch(/findOrCreatePoi/);
    expect(ENDPOINT).not.toMatch(/UPDATE pois/);
  });
  it('rolls back (connect-root delete) on any failure', () => {
    expect(ENDPOINT).toMatch(/async function rollback/);
    expect(ENDPOINT).toMatch(/await rollback\(/);
    expect(ENDPOINT).toMatch(/DELETE FROM trips WHERE id = \?/);
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
