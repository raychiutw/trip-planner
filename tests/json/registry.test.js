import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');

describe('trips.json registry', () => {
  let trips;

  it('parses as valid JSON', () => {
    const raw = readFileSync(resolve(ROOT, 'data/trips.json'), 'utf8');
    trips = JSON.parse(raw);
    expect(trips).toBeDefined();
  });

  it('is a non-empty array', () => {
    expect(Array.isArray(trips)).toBe(true);
    expect(trips.length).toBeGreaterThan(0);
  });

  it('each entry has name and file', () => {
    trips.forEach((entry) => {
      expect(entry.name).toBeTruthy();
      expect(entry.file).toBeTruthy();
    });
  });

  it('each file reference points to an existing file', () => {
    trips.forEach((entry) => {
      const filePath = resolve(ROOT, entry.file);
      expect(existsSync(filePath), `File not found: ${entry.file}`).toBe(true);
    });
  });

  it('each referenced file is valid JSON', () => {
    trips.forEach((entry) => {
      const filePath = resolve(ROOT, entry.file);
      const raw = readFileSync(filePath, 'utf8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  });
});
