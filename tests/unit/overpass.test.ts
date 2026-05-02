/**
 * Overpass API client — verify request shape that 2026-05-02 fix
 * (PR after v2.19.1 batch run) addresses.
 *
 * Bug: 原本 Content-Type: text/plain + body `data=<urlencoded>` 是格式不一致
 * → Overpass parser 回 406 Not Acceptable。100 POI batch 中 30 個撞此 bug。
 *
 * Fix: Content-Type → application/x-www-form-urlencoded，對齊 body 格式。
 * 加 Accept: application/json + User-Agent (per OSM usage policy)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchTags } from '../../src/server/osm/overpass';

describe('fetchTags — request shape (regression test for 406 fix)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ elements: [{ type: 'node', id: 123, tags: { phone: '+81-3-1234' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to overpass endpoint with form-urlencoded Content-Type', async () => {
    await fetchTags(123, 'node');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://overpass-api.de/api/interpreter');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(init.headers['Accept']).toBe('application/json');
    expect(init.headers['User-Agent']).toMatch(/Tripline/);
  });

  it('body is form-urlencoded with `data=` prefix and the OSM query', async () => {
    await fetchTags(456, 'way');
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.body).toMatch(/^data=/);
    // Decoded body should contain the way(456) query
    expect(decodeURIComponent(init.body)).toContain('way(456)');
    expect(decodeURIComponent(init.body)).toContain('[out:json]');
  });

  it('returns parsed tags from a successful response', async () => {
    const tags = await fetchTags(789, 'relation');
    expect(tags).toEqual({
      phone: '+81-3-1234',
      website: undefined,
      email: undefined,
      opening_hours: undefined,
      cuisine: undefined,
      wikidata: undefined,
      wikipedia: undefined,
      brand: undefined,
      amenity: undefined,
      tourism: undefined,
      shop: undefined,
    });
  });

  it('throws on non-OK response (the 406 case before fix)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 406, json: async () => ({}) });
    await expect(fetchTags(1, 'node')).rejects.toThrow(/Overpass HTTP 406/);
  });

  it('returns null when Overpass response has no elements', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ elements: [] }) });
    expect(await fetchTags(2, 'node')).toBeNull();
  });

  it('falls back to contact:* tags when top-level missing', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [{ type: 'node', id: 1, tags: { 'contact:phone': '+81-99', 'contact:website': 'x.com' } }],
      }),
    });
    const tags = await fetchTags(1, 'node');
    expect(tags?.phone).toBe('+81-99');
    expect(tags?.website).toBe('x.com');
  });
});
