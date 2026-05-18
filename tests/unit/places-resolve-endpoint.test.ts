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
  requireAuth: vi.fn(() => ({ user: { id: 1, email: 'x@y' }, sessionId: 's' })),
}));
vi.mock('../../functions/api/_maps_lock', () => ({
  assertGoogleAvailable: vi.fn(async () => undefined),
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

beforeEach(() => mockGetPlaceDetails.mockReset());
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
    expect(mockGetPlaceDetails).toHaveBeenCalledWith('test-key', 'ChIJ_a');
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
});
