// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildMealStopPrimaryPoiApplySql,
  planMealStopPrimaryPoiBackfill,
  TEMP_SORT_ORDER_OFFSET,
} from '../../scripts/lib/meal-stop-primary-poi-backfill';

describe('planMealStopPrimaryPoiBackfill', () => {
  it('promotes the first restaurant choice to stop_pois order=1 and demotes the old wrapper POI', () => {
    const plan = planMealStopPrimaryPoiBackfill({
      entryId: 783,
      title: '午餐',
      currentEntryPoiId: 10,
      existingStopPois: [
        { poiId: 10, sortOrder: 1, poiName: '美國村 wrapper' },
        { poiId: 99, sortOrder: 2, poiName: '停車場' },
      ],
      restaurants: [
        { poiId: 21, tripPoiId: 3, tripPoiSortOrder: 0, poiName: '第一順位燒肉' },
        { poiId: 22, tripPoiId: 4, tripPoiSortOrder: 1, poiName: '備選沖繩麵' },
      ],
    });

    expect(plan).not.toBeNull();
    expect(plan!.firstRestaurantPoiId).toBe(21);
    expect(plan!.desiredPoiIds).toEqual([21, 22, 10, 99]);
    expect(plan!.changed).toBe(true);
  });

  it('is idempotent after the first restaurant is already the canonical stop POI', () => {
    const plan = planMealStopPrimaryPoiBackfill({
      entryId: 784,
      title: '晚餐',
      currentEntryPoiId: 21,
      existingStopPois: [
        { poiId: 21, sortOrder: 1, poiName: '第一順位燒肉' },
        { poiId: 22, sortOrder: 2, poiName: '備選沖繩麵' },
        { poiId: 10, sortOrder: 3, poiName: '美國村 wrapper' },
      ],
      restaurants: [
        { poiId: 22, tripPoiId: 4, tripPoiSortOrder: 1, poiName: '備選沖繩麵' },
        { poiId: 21, tripPoiId: 3, tripPoiSortOrder: 0, poiName: '第一順位燒肉' },
      ],
    });

    expect(plan).not.toBeNull();
    expect(plan!.desiredPoiIds).toEqual([21, 22, 10]);
    expect(plan!.changed).toBe(false);
  });

  it('does not migrate non-meal entries that happen to have restaurant suggestions', () => {
    const plan = planMealStopPrimaryPoiBackfill({
      entryId: 785,
      title: '美國村散步',
      currentEntryPoiId: 10,
      existingStopPois: [{ poiId: 10, sortOrder: 1, poiName: '美國村' }],
      restaurants: [
        { poiId: 21, tripPoiId: 3, tripPoiSortOrder: 0, poiName: '附近餐廳' },
      ],
    });

    expect(plan).toBeNull();
  });

  it('deduplicates restaurant choices already present in stop_pois', () => {
    const plan = planMealStopPrimaryPoiBackfill({
      entryId: 786,
      title: '早餐',
      currentEntryPoiId: 10,
      existingStopPois: [
        { poiId: 10, sortOrder: 1, poiName: '飯店' },
        { poiId: 21, sortOrder: 2, poiName: '第一順位早餐' },
      ],
      restaurants: [
        { poiId: 21, tripPoiId: 3, tripPoiSortOrder: 0, poiName: '第一順位早餐' },
        { poiId: 22, tripPoiId: 4, tripPoiSortOrder: 1, poiName: '備選咖啡' },
      ],
    });

    expect(plan).not.toBeNull();
    expect(plan!.desiredPoiIds).toEqual([21, 22, 10]);
    expect(plan!.changed).toBe(true);
  });

  it('refuses to build SQL with non-integer IDs', () => {
    expect(() => buildMealStopPrimaryPoiApplySql({
      entryId: 786,
      firstRestaurantPoiId: 21,
      desiredPoiIds: [21, Number.NaN],
      changed: true,
    })).toThrow(/Invalid desiredPoiId/);
  });

  it('builds D1-remote-compatible SQL without explicit transaction statements', () => {
    const sql = buildMealStopPrimaryPoiApplySql({
      entryId: 786,
      firstRestaurantPoiId: 21,
      desiredPoiIds: [21, 22, 10],
      changed: true,
    });

    expect(sql).not.toMatch(/BEGIN|COMMIT|SAVEPOINT/i);
    expect(sql).toContain(`sort_order + ${TEMP_SORT_ORDER_OFFSET}`);
    expect(sql).toContain('ON CONFLICT(entry_id, poi_id) DO UPDATE');
    expect(sql).toContain(`AND sort_order >= ${TEMP_SORT_ORDER_OFFSET}`);
    expect(sql).toContain('UPDATE trip_entries');
  });
});
