/** Converts a snake_case key to camelCase. */
export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Fields whose string values should be JSON-parsed. */
export const JSON_FIELDS: string[] = [
  'parking',
  'footer',
  'location',
  'attrs',
  'trip_attrs',
  'breakfast',
];

/**
 * Maps a single DB row object:
 * - JSON-parses fields listed in JSON_FIELDS
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
    // Convert snake_case to camelCase
    const outKey = snakeToCamel(key);
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
