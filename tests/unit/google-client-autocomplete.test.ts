/**
 * google-client autocompletePlaces unit tests — v2.31.94 custom-stop-location-picker
 *
 * Places API (New) POST /v1/places:autocomplete — used by /api/places/autocomplete
 * endpoint to provide typeahead suggestions in AddStopPage custom-stop UI.
 *
 * Note: Places API (New) autocomplete responses do NOT include lat/lng directly;
 * coords are resolved via a follow-up getPlaceDetails call when user picks a
 * suggestion. This client returns placeId + primaryText + secondaryText only.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { autocompletePlaces } from '../../src/server/maps/google-client';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function fetchOk(body: unknown): void {
  mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body });
}

function fetch4xx(status: number, body?: unknown): void {
  mockFetch.mockResolvedValueOnce({ ok: false, status, json: async () => body || {} });
}

describe('autocompletePlaces', () => {
  it('POSTs to /v1/places:autocomplete with FieldMask + body', async () => {
    fetchOk({
      suggestions: [
        {
          placePrediction: {
            placeId: 'ChIJ_zuoying',
            text: { text: '高雄市左營區, Kaohsiung City, Taiwan' },
            structuredFormat: {
              mainText: { text: '高雄市左營區' },
              secondaryText: { text: 'Kaohsiung City, Taiwan' },
            },
          },
        },
      ],
    });

    const results = await autocompletePlaces(
      'test-key',
      '高雄市左營',
      'session-uuid-123',
      'tw',
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toContain('places.googleapis.com/v1/places:autocomplete');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Goog-Api-Key']).toBe('test-key');
    expect(init.headers['X-Goog-FieldMask']).toContain('suggestions.placePrediction.placeId');
    expect(init.headers['X-Goog-FieldMask']).toContain('suggestions.placePrediction.structuredFormat');

    const body = JSON.parse(init.body);
    expect(body.input).toBe('高雄市左營');
    expect(body.sessionToken).toBe('session-uuid-123');
    expect(body.languageCode).toBe('zh-TW');
    expect(body.includedRegionCodes).toEqual(['tw']);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      placeId: 'ChIJ_zuoying',
      primaryText: '高雄市左營區',
      secondaryText: 'Kaohsiung City, Taiwan',
    });
  });

  it('omits regionCode when not provided', async () => {
    fetchOk({ suggestions: [] });
    await autocompletePlaces('k', 'q', 'sess');
    const init = mockFetch.mock.calls[0]![1];
    const body = JSON.parse(init.body);
    expect(body.includedRegionCodes).toBeUndefined();
  });

  it('normalizes regionCode to lowercase (per existing searchPlaces convention)', async () => {
    fetchOk({ suggestions: [] });
    await autocompletePlaces('k', 'q', 'sess', 'JP');
    const init = mockFetch.mock.calls[0]![1];
    const body = JSON.parse(init.body);
    expect(body.includedRegionCodes).toEqual(['jp']);
  });

  it('empty suggestions → []', async () => {
    fetchOk({ suggestions: [] });
    const results = await autocompletePlaces('k', 'q', 'sess');
    expect(results).toEqual([]);
  });

  it('missing suggestions field → []', async () => {
    fetchOk({});
    const results = await autocompletePlaces('k', 'q', 'sess');
    expect(results).toEqual([]);
  });

  it('non-placePrediction suggestions (e.g., queryPrediction) are filtered out', async () => {
    fetchOk({
      suggestions: [
        { queryPrediction: { text: { text: 'some query' } } },
        {
          placePrediction: {
            placeId: 'ChIJ_a',
            structuredFormat: {
              mainText: { text: 'A' },
              secondaryText: { text: 'A2' },
            },
          },
        },
      ],
    });
    const results = await autocompletePlaces('k', 'q', 'sess');
    expect(results).toHaveLength(1);
    expect(results[0].placeId).toBe('ChIJ_a');
  });

  it('missing structuredFormat → fallback to empty strings (still surfaces placeId)', async () => {
    fetchOk({
      suggestions: [
        {
          placePrediction: {
            placeId: 'ChIJ_minimal',
            text: { text: 'fallback' },
          },
        },
      ],
    });
    const results = await autocompletePlaces('k', 'q', 'sess');
    expect(results).toEqual([
      { placeId: 'ChIJ_minimal', primaryText: 'fallback', secondaryText: '' },
    ]);
  });

  it('4xx response → throws MAPS_UPSTREAM_FAILED', async () => {
    fetch4xx(400, { error: { message: 'bad input' } });
    await expect(autocompletePlaces('k', 'q', 'sess')).rejects.toMatchObject({
      code: 'MAPS_UPSTREAM_FAILED',
    });
  });

  it('invalid JSON response → throws MAPS_UPSTREAM_FAILED', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('parse');
      },
    });
    await expect(autocompletePlaces('k', 'q', 'sess')).rejects.toMatchObject({
      code: 'MAPS_UPSTREAM_FAILED',
    });
  });

  it('fetch network error → throws MAPS_UPSTREAM_FAILED', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(autocompletePlaces('k', 'q', 'sess')).rejects.toMatchObject({
      code: 'MAPS_UPSTREAM_FAILED',
    });
  });
});
