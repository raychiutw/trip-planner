export type ExistingStopPoiRow = {
  poiId: number;
  sortOrder: number;
  poiName?: string | null;
};

export type RestaurantChoiceRow = {
  poiId: number;
  tripPoiId?: number | null;
  tripPoiSortOrder?: number | null;
  poiName?: string | null;
  poiType?: string | null;
};

export type MealStopBackfillInput = {
  entryId: number;
  title?: string | null;
  description?: string | null;
  note?: string | null;
  currentEntryPoiId?: number | null;
  existingStopPois: ExistingStopPoiRow[];
  restaurants: RestaurantChoiceRow[];
};

export type MealStopPrimaryPoiPlan = {
  entryId: number;
  firstRestaurantPoiId: number;
  desiredPoiIds: number[];
  changed: boolean;
};

export const TEMP_SORT_ORDER_OFFSET = 10000;

export const MEAL_STOP_RE =
  /(早餐|早午餐|午餐|晚餐|宵夜|用餐|餐廳|食堂|美食|breakfast|brunch|lunch|dinner|supper|meal|restaurant)/i;

const MAX_SORT = Number.MAX_SAFE_INTEGER;

function asSortKey(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : MAX_SORT;
}

function isValidPoiId(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export function sqlPositiveInteger(value: number, label: string): string {
  if (!isValidPoiId(value)) {
    throw new Error(`Invalid ${label}: expected positive integer, got ${String(value)}`);
  }
  return String(value);
}

export function isMealStopText(input: Pick<MealStopBackfillInput, 'title' | 'description' | 'note'>): boolean {
  const text = `${input.title ?? ''} ${input.description ?? ''} ${input.note ?? ''}`;
  return MEAL_STOP_RE.test(text);
}

function restaurantSort(a: RestaurantChoiceRow, b: RestaurantChoiceRow): number {
  const bySortOrder = asSortKey(a.tripPoiSortOrder) - asSortKey(b.tripPoiSortOrder);
  if (bySortOrder !== 0) return bySortOrder;
  const byTripPoiId = asSortKey(a.tripPoiId) - asSortKey(b.tripPoiId);
  if (byTripPoiId !== 0) return byTripPoiId;
  return a.poiId - b.poiId;
}

function stopPoiSort(a: ExistingStopPoiRow, b: ExistingStopPoiRow): number {
  const bySortOrder = asSortKey(a.sortOrder) - asSortKey(b.sortOrder);
  if (bySortOrder !== 0) return bySortOrder;
  return a.poiId - b.poiId;
}

function sameOrder(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function planMealStopPrimaryPoiBackfill(
  input: MealStopBackfillInput,
): MealStopPrimaryPoiPlan | null {
  if (!isMealStopText(input)) return null;

  const restaurantPoiIds: number[] = [];
  const seenRestaurants = new Set<number>();
  const restaurantChoices = input.restaurants
    .filter((row) => isValidPoiId(row.poiId))
    .filter((row) => !row.poiType || row.poiType === 'restaurant')
    .sort(restaurantSort);

  for (const row of restaurantChoices) {
    if (seenRestaurants.has(row.poiId)) continue;
    seenRestaurants.add(row.poiId);
    restaurantPoiIds.push(row.poiId);
  }

  if (restaurantPoiIds.length === 0) return null;

  const desiredPoiIds = [...restaurantPoiIds];
  const seenDesired = new Set(desiredPoiIds);
  const existingStopPois = [...input.existingStopPois]
    .filter((row) => isValidPoiId(row.poiId))
    .sort(stopPoiSort);

  for (const row of existingStopPois) {
    if (seenDesired.has(row.poiId)) continue;
    seenDesired.add(row.poiId);
    desiredPoiIds.push(row.poiId);
  }

  const currentPoiIds = existingStopPois.map((row) => row.poiId);
  const firstRestaurantPoiId = restaurantPoiIds[0];
  const changed =
    input.currentEntryPoiId !== firstRestaurantPoiId ||
    !sameOrder(currentPoiIds, desiredPoiIds);

  return {
    entryId: input.entryId,
    firstRestaurantPoiId,
    desiredPoiIds,
    changed,
  };
}

export function buildMealStopPrimaryPoiApplySql(plan: MealStopPrimaryPoiPlan): string {
  if (plan.desiredPoiIds.length === 0) {
    throw new Error('Cannot build backfill SQL without desired POIs');
  }
  const entryId = sqlPositiveInteger(plan.entryId, 'entryId');
  const firstRestaurantPoiId = sqlPositiveInteger(plan.firstRestaurantPoiId, 'firstRestaurantPoiId');
  const upserts = plan.desiredPoiIds
    .map((poiId, index) => {
      const safePoiId = sqlPositiveInteger(poiId, 'desiredPoiId');
      return `
INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, added_at, updated_at)
VALUES (${entryId}, ${safePoiId}, ${index + 1}, datetime('now'), datetime('now'))
ON CONFLICT(entry_id, poi_id) DO UPDATE SET
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at`;
    })
    .join(';\n');

  return `
UPDATE trip_entry_pois
SET sort_order = sort_order + ${TEMP_SORT_ORDER_OFFSET},
    updated_at = datetime('now')
WHERE entry_id = ${entryId};
${upserts};
DELETE FROM trip_entry_pois
WHERE entry_id = ${entryId}
  AND sort_order >= ${TEMP_SORT_ORDER_OFFSET};
UPDATE trip_entries
SET poi_id = ${firstRestaurantPoiId},
    updated_at = datetime('now'),
    entry_pois_version = entry_pois_version + 1
WHERE id = ${entryId};
`;
}
