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

  it('inserts message column without mode (migration 0049 phase 2: column dropped)', () => {
    expect(requestsTs).toContain('INSERT INTO trip_requests (trip_id, message');
    expect(requestsTs).not.toMatch(/INSERT INTO trip_requests \([^)]*\bmode\b/);
  });

  it('does NOT reference mode column anywhere (rip-out complete)', () => {
    // Phase 2 (migration 0049) DROP COLUMN trip_requests.mode 後 code 完全不該 reference mode。
    expect(requestsTs).not.toContain("body.mode");
    expect(requestsTs).not.toContain("'trip-edit'");
    expect(requestsTs).not.toContain("'trip-plan'");
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
  // RequestStatus 曾長期與 D1 對不上 —— 帶著 v2.21.3 就退場的 'received'、缺了
  // 'failed'。這條原本斷言 'received' 存在，等於把漂移鎖進測試。
  it('RequestStatus 對齊 D1 CHECK 的四值（無退場的 received、有 failed）', () => {
    const line = apiTypes.match(/export type RequestStatus = ([^;]+);/);
    expect(line).not.toBeNull();
    expect(line[1]).toContain("'open'");
    expect(line[1]).toContain("'processing'");
    expect(line[1]).toContain("'completed'");
    expect(line[1]).toContain("'failed'");
    expect(line[1]).not.toContain("'received'");
  });

  it('Request 帶 terminalReason（ADR-0007 終結原因）', () => {
    expect(apiTypes).toContain('terminalReason');
  });

  it('has message field in Request interface', () => {
    expect(apiTypes).toContain('message: string');
  });

  it('legacy title/body/processedBy fields purged from Request interface', () => {
    // v2.17.16:deprecated 欄位整批刪除。Request 不再有 title? / body? / processedBy?。
    expect(apiTypes).not.toMatch(/^\s*title\?:/m);
    expect(apiTypes).not.toMatch(/^\s*body\?:/m);
    expect(apiTypes).not.toMatch(/^\s*processedBy\?:/m);
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
