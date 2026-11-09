import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

describe('legacy trip_entries.title is dropped', () => {
  it('drops legacy entry titles in migration 0081 without adding the column back', () => {
    const migration = read('migrations/0081_clear_trip_entry_titles.sql');
    expect(migration).toMatch(/ALTER\s+TABLE\s+trip_entries\s+DROP\s+COLUMN\s+title/i);
    expect(migration).not.toMatch(/ADD\s+COLUMN\s+title/i);
  });


  it('does not fall back from POI display name to raw entry title', () => {
    const display = read('src/lib/stopDisplay.ts');
    expect(display).toMatch(/return poiName;/);
    expect(display).not.toMatch(/poiName\s*\?\?\s*title/);
  });


});
