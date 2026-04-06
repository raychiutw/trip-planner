import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

/**
 * requests API structural validations — source checks for
 * functions/api/requests.ts and functions/api/requests/[id].ts
 */

const requestsTs = readFileSync('functions/api/requests.ts', 'utf-8');
const requestIdTs = readFileSync('functions/api/requests/[id]/index.ts', 'utf-8');
const apiTypes = readFileSync('src/types/api.ts', 'utf-8');

/* ===== POST /api/requests — message 欄位 ===== */

describe('POST /api/requests', () => {
  it('accepts message field in POST body', () => {
    expect(requestsTs).toContain('message');
  });

  it('has title/body fallback for legacy compatibility', () => {
    // Should reference both title and body for backward compat
    expect(requestsTs).toContain('body.title');
    expect(requestsTs).toContain('body.body');
  });

  it('inserts message column (not title + body)', () => {
    expect(requestsTs).toContain('INSERT INTO trip_requests (trip_id, mode, message');
    expect(requestsTs).not.toContain("INSERT INTO trip_requests (trip_id, mode, title, body");
  });

  it('validates mode as trip-edit or trip-plan', () => {
    expect(requestsTs).toContain("trip-edit");
    expect(requestsTs).toContain("trip-plan");
  });
});

/* ===== PATCH /api/requests/:id — 四態 status ===== */

describe('PATCH /api/requests/:id', () => {
  it('validates four status values', () => {
    expect(requestIdTs).toContain('open');
    expect(requestIdTs).toContain('processing');
    expect(requestIdTs).toContain('completed');
    expect(requestIdTs).toContain('failed');
  });

  it('does NOT accept legacy "closed" status', () => {
    // The valid statuses array should not contain 'closed'
    const validLine = requestIdTs.match(/STATUS_ORDER\s*=\s*\[([^\]]+)\]/);
    expect(validLine).not.toBeNull();
    expect(validLine[1]).not.toContain("'closed'");
  });

  it('validates status with AppError', () => {
    expect(requestIdTs).toContain('DATA_VALIDATION');
  });
});

/* ===== src/types/api.ts — Request interface ===== */

describe('Request type definition', () => {
  it('exports RequestStatus type with four values', () => {
    expect(apiTypes).toContain('RequestStatus');
    expect(apiTypes).toContain("'open'");
    expect(apiTypes).toContain("'received'");
    expect(apiTypes).toContain("'processing'");
    expect(apiTypes).toContain("'completed'");
  });

  it('has message field in Request interface', () => {
    expect(apiTypes).toContain('message: string');
  });

  it('marks title and body as deprecated', () => {
    // Should have @deprecated annotations for legacy fields
    const titleDeprecated = apiTypes.includes('@deprecated') && apiTypes.includes('title?');
    expect(titleDeprecated).toBe(true);
  });

  it('uses RequestStatus type for status field', () => {
    expect(apiTypes).toContain('status: RequestStatus');
  });
});

/* ===== Migration 檔案驗證 ===== */

describe('Migration 0009', () => {
  const migration = readFileSync('migrations/0009_request_message.sql', 'utf-8');
  const rollback = readFileSync('migrations/_archived/0009_rollback_request_message.sql', 'utf-8');

  it('creates requests_new table with message column', () => {
    expect(migration).toContain('CREATE TABLE requests_new');
    expect(migration).toContain('message TEXT NOT NULL');
  });

  it('has four-state status CHECK constraint', () => {
    expect(migration).toContain("'open'");
    expect(migration).toContain("'received'");
    expect(migration).toContain("'processing'");
    expect(migration).toContain("'completed'");
  });

  it('migrates closed to completed', () => {
    expect(migration).toContain("WHEN status = 'closed' THEN 'completed'");
  });

  it('drops old table and renames new', () => {
    expect(migration).toContain('DROP TABLE requests');
    expect(migration).toContain('ALTER TABLE requests_new RENAME TO requests');
  });

  it('rebuilds indexes', () => {
    expect(migration).toContain('CREATE INDEX idx_requests_trip_id');
    expect(migration).toContain('CREATE INDEX idx_requests_status');
    expect(migration).toContain('CREATE INDEX idx_requests_trip_status');
  });

  it('has a rollback script that reverses the migration', () => {
    expect(rollback).toContain('CREATE TABLE requests_old');
    expect(rollback).toContain('DROP TABLE requests');
    expect(rollback).toContain('ALTER TABLE requests_old RENAME TO requests');
  });
});
