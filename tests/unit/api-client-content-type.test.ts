/**
 * api-client-content-type.test.ts — v2.33.36 code review round 1
 *
 * apiFetch / apiFetchRaw 不應對 FormData / Blob / URLSearchParams body 強塞
 * `Content-Type: application/json` — server-side 會 fail parse。只有當 body
 * 是 string 且 method 是非 idempotent 時才補。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, apiFetchRaw } from '../../src/lib/apiClient';

vi.mock('../../src/hooks/useOnlineStatus', () => ({
  reportFetchResult: vi.fn(),
}));

const originalFetch = global.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

function lastCallHeaders(): Record<string, string> {
  const call = fetchMock.mock.calls[0];
  const init = (call?.[1] ?? {}) as RequestInit;
  return (init.headers ?? {}) as Record<string, string>;
}

describe('apiFetch — Content-Type wiring (v2.33.36)', () => {
  it('GET request has no Content-Type even with body undefined', async () => {
    await apiFetch('/trips');
    expect(lastCallHeaders()['Content-Type']).toBeUndefined();
  });

  it('POST with JSON string body sets Content-Type: application/json', async () => {
    await apiFetch('/trips', { method: 'POST', body: JSON.stringify({ x: 1 }) });
    expect(lastCallHeaders()['Content-Type']).toBe('application/json');
  });

  it('POST with FormData body does NOT set Content-Type', async () => {
    const fd = new FormData();
    fd.append('file', 'x');
    await apiFetch('/upload', { method: 'POST', body: fd });
    expect(lastCallHeaders()['Content-Type']).toBeUndefined();
  });

  it('POST with URLSearchParams body does NOT set Content-Type', async () => {
    const params = new URLSearchParams({ a: '1' });
    await apiFetch('/x', { method: 'POST', body: params });
    expect(lastCallHeaders()['Content-Type']).toBeUndefined();
  });

  it('caller-provided Content-Type is preserved', async () => {
    await apiFetch('/x', {
      method: 'POST',
      body: 'csv-payload',
      headers: { 'Content-Type': 'text/csv' },
    });
    expect(lastCallHeaders()['Content-Type']).toBe('text/csv');
  });
});

describe('apiFetchRaw — Content-Type wiring', () => {
  it('string body sets application/json', async () => {
    await apiFetchRaw('/x', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    expect(lastCallHeaders()['Content-Type']).toBe('application/json');
  });

  it('FormData body does NOT set Content-Type', async () => {
    const fd = new FormData();
    await apiFetchRaw('/x', { method: 'POST', body: fd });
    expect(lastCallHeaders()['Content-Type']).toBeUndefined();
  });
});
