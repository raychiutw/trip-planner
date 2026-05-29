/**
 * Regression: trip-notes edit forms use canonical input components
 * Found by /qa on 2026-05-30 (input height inconsistency + native date/time chrome)
 * Report: .gstack/qa-reports/qa-report-trip-notes-inputs-2026-05-30.md
 *
 * The 5 trip-notes section edit forms originally used raw native
 * `<input type="datetime-local">` + `<select>` + ad-hoc `.tp-notes-*-edit-grid
 * input` CSS (no min-height) → date/time controls rendered taller than text
 * inputs (row height mismatch) and showed native browser chrome, violating the
 * design spec. Fix aligns them to the canonical system:
 *   - text/textarea → .tp-input-long (44px min-height)
 *   - native <select> → <TripSelect>
 *   - native datetime-local → <NoteDateTimeField> (TripDatePicker + TripTimePicker)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { splitDateTime, combineDateTime } from '../../src/components/trip-notes/NoteDateTimeField';

const SECTION_DIR = join(__dirname, '..', '..', 'src/components/trip-notes');
const SECTIONS = [
  'FlightsSection.tsx',
  'LodgingsSection.tsx',
  'ReservationsSection.tsx',
  'PretripSection.tsx',
  'EmergencySection.tsx',
];
const read = (f: string) => readFileSync(join(SECTION_DIR, f), 'utf8');

describe('trip-notes inputs — canonical components (no native date/time/select)', () => {
  it('no section uses native type="datetime-local"', () => {
    for (const f of SECTIONS) {
      expect(read(f), `${f} 不該有原生 datetime-local`).not.toMatch(/type=["']datetime-local["']/);
    }
  });

  it('no section uses raw <select> (use TripSelect)', () => {
    for (const f of SECTIONS) {
      expect(read(f), `${f} 不該有原生 <select>`).not.toMatch(/<select[\s>]/);
    }
  });

  it('sections with date/time fields wire NoteDateTimeField', () => {
    for (const f of ['FlightsSection.tsx', 'LodgingsSection.tsx', 'ReservationsSection.tsx']) {
      const src = read(f);
      expect(src, `${f} import NoteDateTimeField`).toMatch(/import NoteDateTimeField/);
      expect(src, `${f} render <NoteDateTimeField`).toMatch(/<NoteDateTimeField/);
    }
  });

  it('sections with a type dropdown wire TripSelect', () => {
    for (const f of ['ReservationsSection.tsx', 'EmergencySection.tsx']) {
      const src = read(f);
      expect(src, `${f} import TripSelect`).toMatch(/import \{ TripSelect \}/);
      expect(src, `${f} render <TripSelect`).toMatch(/<TripSelect/);
    }
  });

  it('no section keeps the ad-hoc edit-grid input height CSS (relies on .tp-input-long)', () => {
    for (const f of SECTIONS) {
      // The old ad-hoc rule styled `.tp-notes-*-edit-grid input { padding: 8px 10px ... }`.
      expect(read(f), `${f} 不該再有 ad-hoc edit-grid input CSS`).not.toMatch(/-edit-grid input,/);
    }
  });
});

describe('NoteDateTimeField — split/combine datetime helpers', () => {
  it('splits "YYYY-MM-DDTHH:MM" into date + time', () => {
    expect(splitDateTime('2026-07-29T10:45')).toEqual({ date: '2026-07-29', time: '10:45' });
  });

  it('splits date-only / time-only / empty', () => {
    expect(splitDateTime('2026-07-29')).toEqual({ date: '2026-07-29', time: '' });
    expect(splitDateTime('10:45')).toEqual({ date: '', time: '10:45' });
    expect(splitDateTime('')).toEqual({ date: '', time: '' });
  });

  it('combines date + time (and partials) back to a storable string', () => {
    expect(combineDateTime('2026-07-29', '10:45')).toBe('2026-07-29T10:45');
    expect(combineDateTime('2026-07-29', '')).toBe('2026-07-29');
    expect(combineDateTime('', '10:45')).toBe('10:45');
    expect(combineDateTime('', '')).toBe('');
  });

  it('round-trips: combine(split(v)) === v for a full datetime', () => {
    const v = '2026-08-02T09:00';
    const { date, time } = splitDateTime(v);
    expect(combineDateTime(date, time)).toBe(v);
  });

  it('drops the seconds tail from a longer ISO time', () => {
    expect(splitDateTime('2026-07-29T10:45:30')).toEqual({ date: '2026-07-29', time: '10:45' });
  });
});
