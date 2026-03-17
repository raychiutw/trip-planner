/** Maps snake_case DB column names to camelCase JS property names. */
export const FIELD_MAP: Record<string, string> = {
  body: 'description',
  rating: 'googleRating',
  must_buy: 'mustBuy',
  reservation_url: 'reservationUrl',
  day_of_week: 'dayOfWeek',
  self_drive: 'selfDrive',
  og_description: 'ogDescription',
  day_num: 'dayNum',
  sort_order: 'sortOrder',
  parent_type: 'parentType',
  parent_id: 'parentId',
  entry_id: 'entryId',
  trip_id: 'tripId',
  doc_type: 'docType',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  submitted_by: 'submittedBy',
  changed_by: 'changedBy',
  table_name: 'tableName',
  record_id: 'recordId',
  diff_json: 'diffJson',
  request_id: 'requestId',
  food_prefs: 'foodPrefs',
  auto_scroll: 'autoScroll',
};

/** Fields whose string values should be JSON-parsed before mapping. */
export const JSON_FIELDS: string[] = [
  'weather_json',
  'parking_json',
  'footer_json',
  'location_json',
  'breakfast',
];

/**
 * Maps a single DB row object:
 * - JSON-parses fields listed in JSON_FIELDS
 * - Strips `_json` suffix from field names
 * - Renames snake_case keys to camelCase via FIELD_MAP
 */
export function mapRow(row: Record<string, unknown>): Record<string, unknown>;
export function mapRow(row: unknown): unknown;
export function mapRow(row: unknown): unknown {
  if (!row || typeof row !== 'object') return row;
  const input = row as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    let val = input[key];
    // JSON-parse string fields
    if (JSON_FIELDS.indexOf(key) >= 0 && typeof val === 'string') {
      try {
        val = JSON.parse(val);
      } catch (_e) {
        // keep original string value on parse failure
      }
    }
    // Strip _json suffix after parsing
    let outKey = key.replace(/_json$/, '');
    // Rename snake_case to camelCase
    if (FIELD_MAP[outKey]) outKey = FIELD_MAP[outKey];
    result[outKey] = val;
  }
  return result;
}

/**
 * Maps an array of DB rows. Returns an empty array for non-array input.
 */
export function mapRows(rows: unknown): Record<string, unknown>[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => mapRow(r) as Record<string, unknown>);
}
