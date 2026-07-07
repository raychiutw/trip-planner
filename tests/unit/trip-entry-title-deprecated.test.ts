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

  it('does not allow PATCH /entries to update title', () => {
    const endpoint = read('functions/api/trips/[id]/entries/[eid].ts');
    const allowed = endpoint.match(/const ALLOWED_FIELDS = \[([^\]]+)\]/)?.[1] ?? '';
    expect(allowed).not.toContain('title');
  });

  it('does not fall back from POI display name to raw entry title', () => {
    const display = read('src/lib/stopDisplay.ts');
    expect(display).toMatch(/return poiName;/);
    expect(display).not.toMatch(/poiName\s*\?\?\s*title/);
  });

  it('does not keep title column in API entry INSERT SQL', () => {
    const files = [
      'functions/api/trips/[id]/days/[num].ts',
      'functions/api/trips/[id]/days/[num]/entries.ts',
      'functions/api/trips/[id]/entries/[eid]/copy.ts',
      'functions/api/trips/import.ts',
      'functions/api/share/[token]/clone.ts',
      'functions/api/poi-favorites/[id]/add-to-trip.ts',
    ];
    for (const file of files) {
      const src = read(file);
      expect(src).not.toMatch(/INSERT\s+INTO\s+trip_entries\s*\([^)]*\btitle\b/i);
    }
  });

  it('does not use legacy title as the entry-create display input', () => {
    const postEntry = read('functions/api/trips/[id]/days/[num]/entries.ts');
    const putDay = read('functions/api/trips/[id]/days/[num].ts');
    expect(postEntry).not.toMatch(/\bbody\.title\b/);
    expect(postEntry).toMatch(/\bbody\.name\b/);
    expect(putDay).not.toMatch(/\be\.title\b/);
    expect(putDay).toMatch(/title 已移除/);
  });
});
