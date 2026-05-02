/**
 * poi/enrich orchestrator unit tests — mocks all 4 OSM clients via vi.mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/server/osm/nominatim', () => ({
  geocode: vi.fn(),
}));
vi.mock('../../src/server/osm/overpass', () => ({
  fetchTags: vi.fn(),
}));
vi.mock('../../src/server/osm/opentripmap', () => ({
  lookupByLocation: vi.fn(),
}));
vi.mock('../../src/server/osm/wikidata', () => ({
  fetchEntity: vi.fn(),
}));

import { enrichPoi } from '../../src/server/poi/enrich';
import { geocode } from '../../src/server/osm/nominatim';
import { fetchTags } from '../../src/server/osm/overpass';
import { lookupByLocation } from '../../src/server/osm/opentripmap';
import { fetchEntity } from '../../src/server/osm/wikidata';

interface PoiRow {
  id: number;
  name: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  hours: string | null;
  rating: number | null;
  cuisine: string | null;
  osm_id: number | null;
  osm_type: string | null;
  wikidata_id: string | null;
  data_source: string | null;
  data_fetched_at: number | null;
}

function makeDb(poi: Partial<PoiRow> | null) {
  const row = poi ? { ...basePoi, ...poi } : null;
  const updateBindings: unknown[] = [];
  let updateSql = '';
  return {
    db: {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...args: unknown[]) => {
          if (sql.startsWith('UPDATE')) {
            updateSql = sql;
            updateBindings.push(...args);
          }
          return {
            first: () => Promise.resolve(row),
            run: () => Promise.resolve({ success: true }),
          };
        }),
      })),
    },
    updateSql: () => updateSql,
    updateBindings: () => updateBindings,
  };
}

const basePoi: PoiRow = {
  id: 42,
  name: 'Tokyo Skytree',
  lat: null,
  lng: null,
  address: null,
  phone: null,
  website: null,
  email: null,
  hours: null,
  rating: null,
  cuisine: null,
  osm_id: null,
  osm_type: null,
  wikidata_id: null,
  data_source: null,
  data_fetched_at: null,
};

beforeEach(() => {
  vi.mocked(geocode).mockReset();
  vi.mocked(fetchTags).mockReset();
  vi.mocked(lookupByLocation).mockReset();
  vi.mocked(fetchEntity).mockReset();
});

describe('enrichPoi', () => {
  it('returns "not found" when POI id missing', async () => {
    const { db } = makeDb(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await enrichPoi({ db: db as any, poiId: 999 });
    expect(result.updated).toBe(false);
    expect(result.reason).toBe('not found');
  });

  it('skips when cache fresh (< 90 days)', async () => {
    const fresh = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30d ago
    const { db } = makeDb({ data_fetched_at: fresh, lat: 35.7, lng: 139.8 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await enrichPoi({ db: db as any, poiId: 42 });
    expect(result.updated).toBe(false);
    expect(result.reason).toMatch(/cached/);
    expect(geocode).not.toHaveBeenCalled();
  });

  it('forceRefresh bypasses cache', async () => {
    const fresh = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const { db } = makeDb({ data_fetched_at: fresh, lat: 35.7, lng: 139.8, osm_id: 12345, osm_type: 'node' });
    vi.mocked(fetchTags).mockResolvedValue({ phone: '+81-3-1234' });
    vi.mocked(lookupByLocation).mockResolvedValue({ xid: 'X', name: 'X', rate: 6, hasWiki: true, kinds: '' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await enrichPoi({ db: db as any, poiId: 42, openTripMapApiKey: 'k', forceRefresh: true });
    expect(result.updated).toBe(true);
    expect(result.fieldsUpdated).toContain('phone');
    expect(result.fieldsUpdated).toContain('rating');
  });

  it('Nominatim called when lat/lng missing', async () => {
    const { db } = makeDb({});
    vi.mocked(geocode).mockResolvedValue({
      lat: 35.71, lng: 139.81, displayName: 'Tokyo Skytree, Tokyo, Japan',
      osmId: 67890, osmType: 'way',
      address: { country: 'Japan', city: 'Tokyo' },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await enrichPoi({ db: db as any, poiId: 42 });
    expect(geocode).toHaveBeenCalledWith('Tokyo Skytree');
  });

  it('Overpass called when osm_id present after Nominatim', async () => {
    const { db } = makeDb({});
    vi.mocked(geocode).mockResolvedValue({
      lat: 35.71, lng: 139.81, displayName: 'X',
      osmId: 67890, osmType: 'way',
      address: {},
    });
    vi.mocked(fetchTags).mockResolvedValue({ phone: '+81-3-5302-3470', cuisine: 'japanese' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await enrichPoi({ db: db as any, poiId: 42 });
    expect(fetchTags).toHaveBeenCalledWith(67890, 'way');
  });

  it('OpenTripMap called only when apiKey + lat/lng available', async () => {
    const { db: db1 } = makeDb({ lat: 35.7, lng: 139.8 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await enrichPoi({ db: db1 as any, poiId: 42 });
    expect(lookupByLocation).not.toHaveBeenCalled();          // no apiKey

    const { db: db2 } = makeDb({ lat: 35.7, lng: 139.8 });
    vi.mocked(lookupByLocation).mockResolvedValue({ xid: 'X', name: 'X', rate: 7, hasWiki: true, kinds: '' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await enrichPoi({ db: db2 as any, poiId: 42, openTripMapApiKey: 'k' });
    expect(lookupByLocation).toHaveBeenCalled();
  });

  it('rating from OpenTripMap always overwrites (even when poi.rating set)', async () => {
    const { db, updateBindings } = makeDb({ lat: 35.7, lng: 139.8, rating: 5 });
    vi.mocked(lookupByLocation).mockResolvedValue({ xid: 'X', name: 'X', rate: 7, hasWiki: false, kinds: '' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await enrichPoi({ db: db as any, poiId: 42, openTripMapApiKey: 'k' });
    expect(result.fieldsUpdated).toContain('rating');
    expect(updateBindings()).toContain(7);
  });

  it('phone from Overpass only fills NULL — never overwrites existing', async () => {
    const { db } = makeDb({ lat: 35.7, lng: 139.8, osm_id: 1, osm_type: 'node', phone: 'existing' });
    vi.mocked(fetchTags).mockResolvedValue({ phone: 'OVERPASS-PHONE' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await enrichPoi({ db: db as any, poiId: 42 });
    expect(result.fieldsUpdated).not.toContain('phone');
  });

  it('source = "merged" when both OSM + OpenTripMap return data', async () => {
    const { db } = makeDb({});
    vi.mocked(geocode).mockResolvedValue({
      lat: 1, lng: 1, displayName: 'X', osmId: 1, osmType: 'node', address: {},
    });
    vi.mocked(lookupByLocation).mockResolvedValue({ xid: 'X', name: 'X', rate: 5, hasWiki: false, kinds: '' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await enrichPoi({ db: db as any, poiId: 42, openTripMapApiKey: 'k' });
    expect(result.source).toBe('merged');
  });

  it('source = "opentripmap" when only OpenTripMap returns data (had osm_id already)', async () => {
    const { db } = makeDb({ lat: 35.7, lng: 139.8, osm_id: 1, osm_type: 'node' });
    vi.mocked(fetchTags).mockResolvedValue(null);
    vi.mocked(lookupByLocation).mockResolvedValue({ xid: 'X', name: 'X', rate: 7, hasWiki: false, kinds: '' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await enrichPoi({ db: db as any, poiId: 42, openTripMapApiKey: 'k' });
    expect(result.source).toBe('opentripmap');
  });

  it('returns "no data found" when all sources empty', async () => {
    const { db } = makeDb({ lat: 35.7, lng: 139.8 });    // no osm_id, no key → no calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await enrichPoi({ db: db as any, poiId: 42 });
    expect(result.updated).toBe(false);
    expect(result.reason).toBe('no data found');
  });

  it('always sets data_fetched_at + data_source on successful enrichment', async () => {
    const { db, updateSql } = makeDb({ lat: 35.7, lng: 139.8, osm_id: 1, osm_type: 'node' });
    vi.mocked(fetchTags).mockResolvedValue({ phone: '+81' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await enrichPoi({ db: db as any, poiId: 42 });
    expect(updateSql()).toMatch(/data_source/);
    expect(updateSql()).toMatch(/data_fetched_at/);
  });
});
