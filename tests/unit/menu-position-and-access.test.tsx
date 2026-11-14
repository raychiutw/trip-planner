/** 整合分支 code-review 修正：選單座標 clamp 共用、canEditTrip。 */
import { describe, it, expect } from 'vitest';
import { clampToViewport } from '../../src/lib/menuPosition';
import { canEditTrip, isTripOwner, type MyTrip } from '../../src/hooks/useMyTrips';

describe('clampToViewport', () => {
  it('夾在 viewport 內並保留邊距', () => {
    expect(clampToViewport(10, 10, 200, 100, 1000, 800, 8)).toEqual({ left: 10, top: 10 });
    expect(clampToViewport(990, 790, 200, 100, 1000, 800, 8)).toEqual({ left: 792, top: 692 });
    expect(clampToViewport(-5, -5, 200, 100, 1000, 800, 8)).toEqual({ left: 8, top: 8 });
  });
});

describe('canEditTrip（規則同後端 role != viewer）', () => {
  const trip = (p: Partial<MyTrip>): MyTrip => ({ tripId: 't', name: 'n', ...p });
  it('owner / member 可編輯', () => {
    expect(canEditTrip(trip({ role: 'owner' }), 'u')).toBe(true);
    expect(canEditTrip(trip({ role: 'member' }), 'u')).toBe(true);
  });
  it('沒帶 role 時，ownerUserId 是自己就可編輯', () => {
    expect(canEditTrip(trip({ ownerUserId: 'u' }), 'u')).toBe(true);
    expect(canEditTrip(trip({ ownerUserId: 'x' }), 'u')).toBe(false);
  });
  it('viewer、找不到行程、沒登入都不可', () => {
    expect(canEditTrip(trip({ role: 'viewer', ownerUserId: 'x' }), 'u')).toBe(false);
    expect(canEditTrip(undefined, 'u')).toBe(false);
    expect(canEditTrip(trip({ ownerUserId: 'u' }), null)).toBe(false);
  });
  it('isTripOwner 仍只給擁有者（旅伴不行）', () => {
    expect(isTripOwner(trip({ role: 'member' }), 'u')).toBe(false);
    expect(isTripOwner(trip({ role: 'owner' }), 'u')).toBe(true);
  });
});
