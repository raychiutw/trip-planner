/**
 * tripViewState — 記住最後檢視行程+天的 localStorage SoT（v2.55.x bug 1 還原）。
 * jsdom env 由 vitest.config.js TS_DOM_FILES 指定（需 localStorage）。
 * 純 input→output：round-trip、壞資料 fail-closed、dayNum 預設。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readTripView, writeTripView } from '../../src/lib/tripViewState';

beforeEach(() => localStorage.clear());

describe('tripViewState', () => {
  it('write → read round-trip', () => {
    writeTripView({ tripId: 'okinawa', dayNum: 3 });
    expect(readTripView()).toEqual({ tripId: 'okinawa', dayNum: 3 });
  });

  it('無資料 → null', () => {
    expect(readTripView()).toBeNull();
  });

  it('壞 JSON → null（fail-closed，不丟例外）', () => {
    localStorage.setItem('tp-last-trip-view', '{{{ not json');
    expect(readTripView()).toBeNull();
  });

  it('tripId 空字串 → null（不還原無效行程）', () => {
    writeTripView({ tripId: '', dayNum: 5 });
    expect(readTripView()).toBeNull();
  });

  it('dayNum 缺或非數字 → 預設 0', () => {
    writeTripView({ tripId: 'x', dayNum: undefined as unknown as number });
    expect(readTripView()).toEqual({ tripId: 'x', dayNum: 0 });
  });
});
