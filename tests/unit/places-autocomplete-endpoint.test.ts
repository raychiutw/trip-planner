/**
 * POST /api/places/autocomplete endpoint — v2.31.94 custom-stop-location-picker
 *
 * Body validation + auth gate + Google maps lock + happy path.
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../functions/api/_auth', () => ({
  requireAuth: vi.fn(() => ({ user: { id: 1, email: 'lean.lean@gmail.com' }, sessionId: 's1' })),
}));

vi.mock('../../functions/api/_maps_lock', () => ({
  assertGoogleAvailable: vi.fn(async () => undefined),
}));

const mockAutocomplete = vi.fn();
vi.mock('../../src/server/maps/google-client', () => ({
  autocompletePlaces: (...args: unknown[]) => mockAutocomplete(...args),
}));

import { onRequestPost } from '../../functions/api/places/autocomplete';
import { requireAuth } from '../../functions/api/_auth';
import { assertGoogleAvailable } from '../../functions/api/_maps_lock';

function makeContext(body: unknown, env: Record<string, unknown> = {}): any {
  return {
    request: new Request('http://localhost/api/places/autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: {
      GOOGLE_MAPS_API_KEY: 'test-key',
      DB: {} as unknown,
      ...env,
    },
    data: {},
  };
}

beforeEach(() => {
  mockAutocomplete.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/places/autocomplete', () => {
  it('requires auth (delegates to requireAuth)', async () => {
    mockAutocomplete.mockResolvedValueOnce([]);
    await onRequestPost(makeContext({ q: 'tokyo', sessionToken: 'uuid' }));
    expect(requireAuth).toHaveBeenCalled();
  });

  it('checks google maps lock', async () => {
    mockAutocomplete.mockResolvedValueOnce([]);
    await onRequestPost(makeContext({ q: 'tokyo', sessionToken: 'uuid' }));
    expect(assertGoogleAvailable).toHaveBeenCalled();
  });

  it('returns 200 + predictions array on happy path', async () => {
    mockAutocomplete.mockResolvedValueOnce([
      { placeId: 'ChIJ_zuoying', primaryText: '高雄市左營區', secondaryText: 'Kaohsiung, Taiwan' },
    ]);
    const res = await onRequestPost(
      makeContext({ q: '高雄市左營', sessionToken: 'sess-1', regionCode: 'tw' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.predictions).toHaveLength(1);
    expect(body.predictions[0]).toEqual({
      placeId: 'ChIJ_zuoying',
      primaryText: '高雄市左營區',
      secondaryText: 'Kaohsiung, Taiwan',
    });
  });

  it('forwards sessionToken + regionCode to client', async () => {
    mockAutocomplete.mockResolvedValueOnce([]);
    await onRequestPost(
      makeContext({ q: 'shibuya', sessionToken: 'sess-XYZ', regionCode: 'JP' }),
    );
    expect(mockAutocomplete).toHaveBeenCalledWith('test-key', 'shibuya', 'sess-XYZ', 'JP');
  });

  it('omits regionCode when caller did not supply', async () => {
    mockAutocomplete.mockResolvedValueOnce([]);
    await onRequestPost(makeContext({ q: 'tokyo', sessionToken: 'sess-Y' }));
    expect(mockAutocomplete).toHaveBeenCalledWith('test-key', 'tokyo', 'sess-Y', undefined);
  });

  it('rejects q < 2 chars with 400 DATA_VALIDATION', async () => {
    await expect(
      onRequestPost(makeContext({ q: 'a', sessionToken: 'sess' })),
    ).rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('rejects missing q', async () => {
    await expect(
      onRequestPost(makeContext({ sessionToken: 'sess' })),
    ).rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('rejects q > 200 chars (DoS guard)', async () => {
    await expect(
      onRequestPost(makeContext({ q: 'a'.repeat(201), sessionToken: 'sess' })),
    ).rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('rejects missing sessionToken', async () => {
    await expect(
      onRequestPost(makeContext({ q: 'tokyo' })),
    ).rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('rejects sessionToken not a string', async () => {
    await expect(
      onRequestPost(makeContext({ q: 'tokyo', sessionToken: 123 })),
    ).rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('rejects when GOOGLE_MAPS_API_KEY missing → MAPS_UPSTREAM_FAILED', async () => {
    await expect(
      onRequestPost(makeContext({ q: 'tokyo', sessionToken: 'sess' }, { GOOGLE_MAPS_API_KEY: undefined })),
    ).rejects.toMatchObject({ code: 'MAPS_UPSTREAM_FAILED' });
  });

  it('trims whitespace from q before length check', async () => {
    await expect(
      onRequestPost(makeContext({ q: '   ', sessionToken: 'sess' })),
    ).rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });
});
