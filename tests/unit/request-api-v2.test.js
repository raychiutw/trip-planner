import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

/**
 * requests API v2 validations — tp-request API 化 新增功能
 * GET /api/requests/:id, PATCH processed_by + updated_at + failed,
 * sort=asc, after/afterId cursor, SSE events endpoint
 */

const requestsTs = readFileSync('functions/api/requests.ts', 'utf-8');
const requestIdTs = readFileSync('functions/api/requests/[id]/index.ts', 'utf-8');
const eventsTs = readFileSync('functions/api/requests/[id]/events.ts', 'utf-8');
const useRequestsTs = readFileSync('src/hooks/useRequests.ts', 'utf-8');
const useRequestSSETs = readFileSync('src/hooks/useRequestSSE.ts', 'utf-8');
const manageTsx = readFileSync('src/pages/ManagePage.tsx', 'utf-8');
const migration = readFileSync('migrations/0023_request_status_update.sql', 'utf-8');

/* ===== GET /api/requests/:id ===== */

describe('GET /api/requests/:id', () => {
  it('exports onRequestGet handler', () => {
    expect(requestIdTs).toContain('export const onRequestGet');
  });

  it('checks hasPermission before returning', () => {
    expect(requestIdTs).toContain('hasPermission');
  });

  it('returns 404 if request not found', () => {
    expect(requestIdTs).toContain('DATA_NOT_FOUND');
  });
});

/* ===== PATCH processed_by + updated_at + failed ===== */

describe('PATCH /api/requests/:id — new fields', () => {
  it('accepts processed_by field', () => {
    expect(requestIdTs).toContain('processed_by');
  });

  it('validates processed_by as api or job', () => {
    expect(requestIdTs).toContain("'api'");
    expect(requestIdTs).toContain("'job'");
    expect(requestIdTs).toContain('VALID_PROCESSORS');
  });

  it('auto-updates updated_at on every PATCH', () => {
    expect(requestIdTs).toContain("updated_at = datetime('now')");
  });

  it('allows failed status to bypass forward-only rule', () => {
    expect(requestIdTs).toContain("body.status !== 'failed'");
  });

  it('does not contain received status', () => {
    const statusOrder = requestIdTs.match(/STATUS_ORDER\s*=\s*\[([^\]]+)\]/);
    expect(statusOrder).not.toBeNull();
    expect(statusOrder[1]).not.toContain("'received'");
  });
});

/* ===== GET sort=asc + after/afterId ===== */

describe('GET /api/requests — sort + cursor', () => {
  it('supports sort=asc param', () => {
    expect(requestsTs).toContain("sort");
    expect(requestsTs).toContain("ORDER BY created_at ASC, id ASC");
  });

  it('supports after/afterId cursor params', () => {
    expect(requestsTs).toContain('after');
    expect(requestsTs).toContain('afterId');
  });

  it('still defaults to DESC order', () => {
    expect(requestsTs).toContain("ORDER BY created_at DESC, id DESC");
  });

  it('uses context.waitUntil for webhook trigger', () => {
    expect(requestsTs).toContain('context.waitUntil');
  });

  it('guards webhook with env check', () => {
    expect(requestsTs).toContain('env.TRIPLINE_API_URL');
  });
});

/* ===== SSE Events Endpoint ===== */

describe('SSE /api/requests/:id/events', () => {
  it('returns text/event-stream content type', () => {
    expect(eventsTs).toContain('text/event-stream');
  });

  it('checks hasPermission', () => {
    expect(eventsTs).toContain('hasPermission');
  });

  it('sends keepalive pings', () => {
    expect(eventsTs).toContain('ping');
  });

  it('closes on terminal status', () => {
    expect(eventsTs).toContain("'completed'");
    expect(eventsTs).toContain("'failed'");
  });

  it('has cancel handler for cleanup', () => {
    expect(eventsTs).toContain('cancel()');
    expect(eventsTs).toContain('clearInterval');
  });

  it('has max duration limit', () => {
    expect(eventsTs).toContain('MAX_DURATION_MS');
  });
});

/* ===== useRequestSSE Hook ===== */

describe('useRequestSSE hook', () => {
  it('exports useRequestSSE function', () => {
    expect(useRequestSSETs).toContain('export function useRequestSSE');
  });

  it('uses EventSource for SSE', () => {
    expect(useRequestSSETs).toContain('EventSource');
  });

  it('falls back to polling on SSE failure', () => {
    expect(useRequestSSETs).toContain('sseFailedRef');
    expect(useRequestSSETs).toContain('startPolling');
  });

  it('uses ref for status to avoid reconnect loop', () => {
    expect(useRequestSSETs).toContain('statusRef');
  });

  it('resets on new requestId', () => {
    expect(useRequestSSETs).toContain('sseFailedRef.current = false');
  });

  it('returns processedBy field', () => {
    expect(useRequestSSETs).toContain('processedBy');
  });
});

/* ===== useRequests Hook — new methods ===== */

describe('useRequests hook — v2 methods', () => {
  it('exports appendRequest', () => {
    expect(useRequestsTs).toContain('appendRequest');
  });

  it('exports updateRequestStatus', () => {
    expect(useRequestsTs).toContain('updateRequestStatus');
  });

  it('exports refreshRequest', () => {
    expect(useRequestsTs).toContain('refreshRequest');
  });

  it('uses DESC + reverse for initial load', () => {
    expect(useRequestsTs).toContain('data.items.reverse()');
  });

  it('uses before cursor for loadMore (not after)', () => {
    // loadMore 用 before/beforeId（DESC 取更舊的再 reverse）
    const loadMoreSection = useRequestsTs.slice(useRequestsTs.indexOf('loadMore'));
    expect(loadMoreSection).toContain("before:");
  });

  it('has top sentinel for reverse scroll', () => {
    expect(useRequestsTs).toContain('rootMargin: \'200px 0px 0px 0px\'');
  });

  it('includes processed_by and updated_at in RawRequest', () => {
    expect(useRequestsTs).toContain("processed_by:");
    expect(useRequestsTs).toContain("updated_at:");
  });
});

/* ===== ManagePage — status badges + SSE + typing animation ===== */

describe('ManagePage — v2 UI', () => {
  it('uses CSS variable badge colors (not hardcoded hex)', () => {
    expect(manageTsx).toContain('var(--badge-completed-bg)');
    expect(manageTsx).toContain('var(--badge-failed-bg)');
  });

  it('has ProcessorIcon component', () => {
    expect(manageTsx).toContain('ProcessorIcon');
  });

  it('has ProcessingSpinner component', () => {
    expect(manageTsx).toContain('ProcessingSpinner');
  });

  it('has ElapsedTime component', () => {
    expect(manageTsx).toContain('ElapsedTime');
  });

  it('shows typing animation for pending replies', () => {
    expect(manageTsx).toContain('animate-bounce');
  });

  it('calls refreshRequest on completed', () => {
    expect(manageTsx).toContain('refreshRequest(sseRequestId)');
  });

  it('has SSE disconnect toast', () => {
    expect(manageTsx).toContain('連線中斷');
  });

  it('uses optimistic append (not loadRequests) after submit', () => {
    expect(manageTsx).toContain('appendRequest(newReq)');
    expect(manageTsx).toContain('setSseRequestId(newReq.id)');
  });

  it('has runtime guard for unknown status', () => {
    // getStatusStyle/getStatusLabel fallback to open style
    expect(manageTsx).toContain("|| 'bg-[var(--badge-open-bg)]");
  });
});

/* ===== Migration 0023 ===== */

describe('Migration 0023', () => {
  it('adds failed to status CHECK', () => {
    expect(migration).toContain("'failed'");
  });

  it('adds updated_at column', () => {
    expect(migration).toContain('updated_at TEXT');
  });

  it('converts received to open', () => {
    expect(migration).toContain("WHEN status = 'received' THEN 'open'");
  });

  it('converts scheduler to job', () => {
    expect(migration).toContain("WHEN processed_by = 'scheduler' THEN 'job'");
  });

  it('converts agent to api', () => {
    expect(migration).toContain("WHEN processed_by = 'agent' THEN 'api'");
  });

  it('creates stale detection index', () => {
    expect(migration).toContain('idx_trip_requests_stale');
  });
});
