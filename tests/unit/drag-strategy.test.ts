import { describe, expect, it } from 'vitest';
import {
  findFirstTimeConflict,
  getExplicitSlotPlacement,
  getSmartPlacement,
  hasTimeConflict,
  parseClockToMinutes,
} from '../../src/lib/drag-strategy';

describe('drag-strategy smart placement', () => {
  it('defaults an empty day to 09:00 for one hour', () => {
    expect(getSmartPlacement([])).toEqual({
      startTime: '09:00',
      endTime: '10:00',
      time: '09:00-10:00',
      startMinutes: 540,
      endMinutes: 600,
      sortOrder: 0,
      orderInDay: 0,
    });
  });

  it('places a Day-header drop one hour after the latest ending entry', () => {
    const placement = getSmartPlacement([
      { id: 1, time: '09:00-10:30', sortOrder: 0 },
      { id: 2, time: '12:00-13:00', sortOrder: 1 },
      { id: 3, time: '10:45-11:30', sortOrder: 2 },
    ]);

    expect(placement.time).toBe('14:00-15:00');
    expect(placement.sortOrder).toBe(3);
    expect(placement.orderInDay).toBe(3);
  });

  it('uses a one-hour duration when the last entry has only a start time', () => {
    expect(getSmartPlacement([{ time: '15:30', sortOrder: 0 }]).time).toBe('17:30-18:30');
  });

  it('detects overlapping time ranges but allows touching boundaries', () => {
    const entries = [{ time: '14:00-16:00' }, { time: '18:00-19:00' }];

    expect(hasTimeConflict({ startMinutes: 870, endMinutes: 930 }, entries)).toBe(true);
    expect(hasTimeConflict({ startMinutes: 960, endMinutes: 1020 }, entries)).toBe(false);
  });

  it('returns the first conflicting entry for modal copy', () => {
    const conflict = findFirstTimeConflict(
      { startMinutes: 870, endMinutes: 930 },
      [{ title: '午餐', time: '12:00-13:00' }, { title: '水族館', time: '14:00-16:00' }],
    );

    expect(conflict?.title).toBe('水族館');
  });

  it('validates clock input instead of accepting malformed times', () => {
    expect(parseClockToMinutes('08:05')).toBe(485);
    expect(parseClockToMinutes('24:00')).toBeNull();
    expect(parseClockToMinutes('abc')).toBeNull();
  });

  it('uses an explicit Day slot as the placement start time', () => {
    expect(getExplicitSlotPlacement('14:00', [{ time: '09:00-10:00', sortOrder: 0 }])).toEqual({
      startTime: '14:00',
      endTime: '15:00',
      time: '14:00-15:00',
      startMinutes: 840,
      endMinutes: 900,
      sortOrder: 1,
      orderInDay: 1,
    });
  });
});
