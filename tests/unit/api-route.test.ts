/**
 * /api/route — CF Worker proxy unit tests
 *
 * Verifies param validation, Mapbox token secret handling, error propagation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet } from '../../functions/api/route';

function makeCtx(url: string, env: Record<string, unknown> = {}) {
  return {
    request: new Request(url),
    env: { MAPBOX_TOKEN: 'pk.test-token', ...env },
    params: {},
    data: {},
    next: vi.fn(),
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    functionPath: '/api/route',
  } as unknown as Parameters<typeof onRequestGet>[0];
}

describe('/api/route CF Worker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects missing from/to params with 400 INVALID_COORDS', async () => {
    const res = await onRequestGet(makeCtx('https://x/api/route'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_COORDS');
  });

  it('rejects non-numeric coords with 400', async () => {
    const res = await onRequestGet(makeCtx('https://x/api/route?from=abc,def&to=1,2'));
    expect(res.status).toBe(400);
  });

  it('rejects out-of-range coords with 400', async () => {
    const res = await onRequestGet(makeCtx('https://x/api/route?from=200,100&to=1,2'));
    expect(res.status).toBe(400);
  });

  it('returns 500 CONFIG_MISSING when MAPBOX_TOKEN not set', async () => {
    const res = await onRequestGet(
      makeCtx('https://x/api/route?from=127.7,26.2&to=127.9,26.5', { MAPBOX_TOKEN: undefined }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('CONFIG_MISSING');
  });

  it('does not leak token in fallback responses', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network'));
    const res = await onRequestGet(
      makeCtx('https://x/api/route?from=127.7,26.2&to=127.9,26.5', { MAPBOX_TOKEN: 'pk.SECRET123' }),
    );
    const text = await res.text();
    expect(text).not.toContain('SECRET123');
    // Network failure → server falls back to Haversine 200 (not 5xx bubble-up)
    expect(res.status).toBe(200);
    const body = JSON.parse(text);
    expect(body.approx).toBe(true);
  });

  it('forwards Mapbox 429 as 429 RATE_LIMITED', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('rate limit', { status: 429 }));
    const res = await onRequestGet(makeCtx('https://x/api/route?from=127.7,26.2&to=127.9,26.5'));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('RATE_LIMITED');
  });

  it('returns polyline with [lat,lng] order on success', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          routes: [
            {
              geometry: { coordinates: [[127.7, 26.2], [127.9, 26.5]] },
              duration: 1234,
              distance: 55555,
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const res = await onRequestGet(makeCtx('https://x/api/route?from=127.7,26.2&to=127.9,26.5'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.polyline).toEqual([[26.2, 127.7], [26.5, 127.9]]);
    expect(body.duration).toBe(1234);
    expect(body.distance).toBe(55555);
  });

  it('falls back to Haversine approx when Mapbox returns empty routes', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ routes: [] }), { status: 200 }),
    );
    const res = await onRequestGet(makeCtx('https://x/api/route?from=127.7,26.2&to=127.9,26.5'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.approx).toBe(true);
    expect(body.duration).toBeNull();
    // Straight-line polyline from→to in [lat, lng] order
    expect(body.polyline).toEqual([[26.2, 127.7], [26.5, 127.9]]);
    // Haversine distance is > 0 for two distinct points
    expect(body.distance).toBeGreaterThan(0);
  });

  it('falls back to Haversine approx when Mapbox 500s (non-429)', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('server err', { status: 500 }));
    const res = await onRequestGet(makeCtx('https://x/api/route?from=127.7,26.2&to=127.9,26.5'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.approx).toBe(true);
  });
});
