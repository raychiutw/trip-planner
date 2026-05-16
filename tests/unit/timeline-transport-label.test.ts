// @vitest-environment node
/**
 * v2.31.23 fix #124: timelineUtils deriveTypeMeta transport POI label 統一為「交通」。
 *
 * Bug 取證（prod QA）：
 *   - TripPage TimelineRail 顯示「那霸機場 移動 · ★ 4.1」（poiType='transport'）
 *   - EditEntryPage 同 POI 顯示「那霸機場 交通」（用 POI_TYPE_LABEL 'transport': '交通'）
 *   - 4 處 POI_TYPE_LABEL（poiCategory.ts / TimelineRail / EditEntryPage / lib）都用「交通」，
 *     只有 timelineUtils deriveTypeMeta line 140 用「移動」造成不一致。
 *
 * Fix：line 140 改「交通」對齊 canonical mapping。line 157 (text-based 「開車/drive」
 * keyword 偵測) 保留「移動」描述 segment 行為。
 *
 * 用 import + call helper 直接驗 deriveTypeMeta return value。
 */
import { describe, it, expect } from 'vitest';
import { deriveTypeMeta } from '../../src/lib/timelineUtils';

describe('v2.31.23 deriveTypeMeta transport POI label', () => {
  it('poiType="transport" 返「交通」label（對齊 POI_TYPE_LABELS canonical）', () => {
    const meta = deriveTypeMeta({
      id: 1,
      title: '那霸機場',
      poiType: 'transport',
    } as unknown as Parameters<typeof deriveTypeMeta>[0]);
    expect(meta.label).toBe('交通');
    expect(meta.icon).toBe('car');
  });

  it('poiType="transport" 不再返「移動」（regression）', () => {
    const meta = deriveTypeMeta({
      id: 2,
      title: 'タイムズカー 美栄橋駅前店',
      poiType: 'transport',
    } as unknown as Parameters<typeof deriveTypeMeta>[0]);
    expect(meta.label).not.toBe('移動');
  });

  it('text-based「自駕/開車」keyword 仍返「移動」（描述 segment 行為，line 157 保留）', () => {
    // 注意：blob 不可含「機場/飯店/餐」等更早 match 的 keyword
    const meta = deriveTypeMeta({
      id: 3,
      title: '開車前往下一站',
      description: '自駕路線',
    } as unknown as Parameters<typeof deriveTypeMeta>[0]);
    expect(meta.label).toBe('移動');
    expect(meta.icon).toBe('car');
  });

  it('其他 poiType 行為不變（regression）', () => {
    const hotel = deriveTypeMeta({ id: 4, title: 'A', poiType: 'hotel' } as unknown as Parameters<typeof deriveTypeMeta>[0]);
    expect(hotel.label).toBe('住宿');
    const food = deriveTypeMeta({ id: 5, title: 'B', poiType: 'restaurant' } as unknown as Parameters<typeof deriveTypeMeta>[0]);
    expect(food.label).toBe('用餐');
    const attraction = deriveTypeMeta({ id: 6, title: 'C', poiType: 'attraction' } as unknown as Parameters<typeof deriveTypeMeta>[0]);
    expect(attraction.label).toBe('景點');
  });
});
