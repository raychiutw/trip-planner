/**
 * groupSidebarTrips 分組規則：已歸檔不列、結束日早於今天＝過去、沒日期的行程歸「即將出發」（current）。
 */
import { describe, it, expect } from 'vitest';
import { groupSidebarTrips } from '../../src/components/shell/DesktopSidebar';
import type { MyTrip } from '../../src/hooks/useMyTrips';

const trip = (over: Partial<MyTrip>): MyTrip => ({ tripId: 't', name: 'T', title: null, startDate: null, endDate: null, archivedAt: null, ...over } as unknown as MyTrip);
const TODAY = '2026-11-14';

describe('groupSidebarTrips', () => {
  it('沒有任何日期的行程歸即將出發（current），不歸過去', () => {
    const undated = trip({ tripId: 'undated', startDate: null, endDate: null });
    const { current, past } = groupSidebarTrips([undated], '', TODAY);
    expect(current.map((t) => t.tripId)).toEqual(['undated']);
    expect(past).toEqual([]);
  });

  it('只有起始日時以起始日判斷過去；結束日優先', () => {
    const { current, past } = groupSidebarTrips([
      trip({ tripId: 'old', startDate: '2026-01-01' }),
      trip({ tripId: 'ongoing', startDate: '2026-11-01', endDate: '2026-11-20' }),
    ], '', TODAY);
    expect(past.map((t) => t.tripId)).toEqual(['old']);
    expect(current.map((t) => t.tripId)).toEqual(['ongoing']);
  });

  it('已歸檔不列入', () => {
    const { current, past } = groupSidebarTrips([trip({ tripId: 'a', archivedAt: '2026-01-01' })], '', TODAY);
    expect([...current, ...past]).toEqual([]);
  });
});
