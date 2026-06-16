/**
 * GET /api/places/resolve?placeId=... — v2.31.94 custom-stop-location-picker
 *
 * Lightweight wrapper of getPlaceDetails returning coord + display fields.
 * Used by typeahead pick → map flyTo flow (one Place Details call closes the
 * autocomplete session per Google billing semantics).
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../functions/api/_auth', () => ({
  requireAuth: vi.fn(() => ({
    email: 'x@y',
    userId: 'u-1',
        isServiceToken: false,
  })),
}));
vi.mock('../../functions/api/_maps_lock', () => ({
  assertGoogleAvailable: vi.fn(async () => undefined),
}));

const mockBumpRateLimit = vi.fn(async () => ({ ok: true, count: 1 }));
vi.mock('../../functions/api/_rate_limit', () => ({
  bumpRateLimit: (...args: unknown[]) => mockBumpRateLimit(...args),
}));

const mockGetPlaceDetails = vi.fn();
vi.mock('../../src/server/maps/google-client', () => ({
  getPlaceDetails: (...args: unknown[]) => mockGetPlaceDetails(...args),
}));

import { onRequestGet } from '../../functions/api/places/resolve';

function makeContext(qs: string, env: Record<string, unknown> = {}): any {
  return {
    request: new Request(`http://localhost/api/places/resolve${qs}`),
    env: { GOOGLE_MAPS_API_KEY: 'test-key', DB: {}, ...env },
    data: {},
  };
}

beforeEach(() => {
  mockGetPlaceDetails.mockReset();
  mockBumpRateLimit.mockReset();
  mockBumpRateLimit.mockResolvedValue({ ok: true, count: 1 });
});
afterEach(() => vi.clearAllMocks());

describe('GET /api/places/resolve', () => {
  it('happy path → 200 + coord + name + address', async () => {
    mockGetPlaceDetails.mockResolvedValueOnce({
      place_id: 'ChIJ_a',
      name: '高雄市左營區',
      address: '高雄市左營區',
      lat: 22.6724,
      lng: 120.2932,
      business_status: 'OPERATIONAL',
    });
    const res = await onRequestGet(makeContext('?placeId=ChIJ_a'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      placeId: 'ChIJ_a',
      lat: 22.6724,
      lng: 120.2932,
      name: '高雄市左營區',
      address: '高雄市左營區',
    });
  });

  it('forwards sessionToken when supplied (closes Google session)', async () => {
    mockGetPlaceDetails.mockResolvedValueOnce({
      place_id: 'ChIJ_a',
      name: 'A',
      address: 'A',
      lat: 1,
      lng: 2,
      business_status: 'OPERATIONAL',
    });
    await onRequestGet(makeContext('?placeId=ChIJ_a&sessionToken=sess-1'));
    expect(mockGetPlaceDetails).toHaveBeenCalledWith('test-key', 'ChIJ_a', 'sess-1');
  });

  it('omits sessionToken when not supplied', async () => {
    mockGetPlaceDetails.mockResolvedValueOnce({
      place_id: 'ChIJ_a',
      name: 'A',
      address: 'A',
      lat: 1,
      lng: 2,
      business_status: 'OPERATIONAL',
    });
    await onRequestGet(makeContext('?placeId=ChIJ_a'));
    expect(mockGetPlaceDetails).toHaveBeenCalledWith('test-key', 'ChIJ_a', undefined);
  });

  it('missing placeId → 400 DATA_VALIDATION', async () => {
    await expect(onRequestGet(makeContext(''))).rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('Place Details returns null → 404 DATA_NOT_FOUND', async () => {
    mockGetPlaceDetails.mockResolvedValueOnce(null);
    await expect(onRequestGet(makeContext('?placeId=ChIJ_missing'))).rejects.toMatchObject({
      code: 'DATA_NOT_FOUND',
    });
  });

  it('API key missing → MAPS_UPSTREAM_FAILED', async () => {
    await expect(
      onRequestGet(makeContext('?placeId=ChIJ_a', { GOOGLE_MAPS_API_KEY: undefined })),
    ).rejects.toMatchObject({ code: 'MAPS_UPSTREAM_FAILED' });
  });

  it('bumps per-user rate limit for resolve quota cap', async () => {
    mockGetPlaceDetails.mockResolvedValueOnce({
      place_id: 'ChIJ_a', name: 'A', address: 'A', lat: 1, lng: 2,
      business_status: 'OPERATIONAL',
    });
    await onRequestGet(makeContext('?placeId=ChIJ_a'));
    expect(mockBumpRateLimit).toHaveBeenCalledOnce();
    const [, key, config] = mockBumpRateLimit.mock.calls[0]!;
    expect(key).toBe('places-resolve:user-u-1');
    expect(config.maxAttempts).toBe(500);
  });

  it('returns 429 RATE_LIMITED when resolve quota exceeded', async () => {
    mockBumpRateLimit.mockResolvedValueOnce({
      ok: false, retryAfter: 3600, count: 501,
    });
    const res = await onRequestGet(makeContext('?placeId=ChIJ_a'));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('3600');
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(mockGetPlaceDetails).not.toHaveBeenCalled();
  });

  it('rejects placeId > 256 chars', async () => {
    await expect(
      onRequestGet(makeContext(`?placeId=${'a'.repeat(257)}`)),
    ).rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('rejects sessionToken > 128 chars', async () => {
    await expect(
      onRequestGet(makeContext(`?placeId=ChIJ_a&sessionToken=${'b'.repeat(129)}`)),
    ).rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });
});
