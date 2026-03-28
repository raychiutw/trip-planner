/** Converts a snake_case key to camelCase. */
export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Fields whose string values should be JSON-parsed before mapping. */
export const JSON_FIELDS: string[] = [
  'weather_json',
  'parking_json',
  'footer_json',
  'location_json',
  'meta_json',
  'breakfast',
];

/**
 * Maps a single DB row object:
 * - JSON-parses fields listed in JSON_FIELDS
 * - Strips `_json` suffix from field names
 * - Converts snake_case keys to camelCase via snakeToCamel
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
    // Convert snake_case to camelCase
    outKey = snakeToCamel(outKey);
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
