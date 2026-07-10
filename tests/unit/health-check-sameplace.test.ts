/**
 * v2.55.46 — 健檢 prompt 的「同一地點/免交通」段呈現。
 *
 * formatSegmentRecords 是餵給 Claude 的「唯一權威來源」travel 區塊。no_travel=1 段的
 * min=NULL，若不特判會落入「移動時間未記錄」分支 → 把使用者刻意的免交通誤報成缺資料
 * （健檢 prompt 準確性一向敏感）。此測試鎖定 no_travel 分支優先於 min==null 分支。
 */
import { describe, it, expect } from 'vitest';
import { formatSegmentRecords } from '../../functions/api/trips/[id]/health-check';

type Row = Parameters<typeof formatSegmentRecords>[0][number];
const row = (over: Partial<Row>): Row => ({
  day_num: 1, from_name: 'A', to_name: 'B', from_id: 1, to_id: 2,
  mode: 'driving', min: null, distance_m: null, no_travel: null, ...over,
});

describe('formatSegmentRecords — 同一地點/免交通 (v2.55.46)', () => {
  it('no_travel=1 → 輸出「同一地點（免交通」而非「移動時間未記錄」', () => {
    const out = formatSegmentRecords([row({ no_travel: 1 })]);
    expect(out).toContain('同一地點（免交通');
    expect(out).not.toContain('移動時間未記錄');
  });

  it('min=null 但非 no_travel → 仍是「移動時間未記錄」（分支未被搶）', () => {
    const out = formatSegmentRecords([row({ min: null, no_travel: null })]);
    expect(out).toContain('移動時間未記錄');
    expect(out).not.toContain('同一地點');
  });

  it('正常段照舊：label + 分鐘 + 距離', () => {
    const out = formatSegmentRecords([row({ mode: 'driving', min: 21, distance_m: 9400, no_travel: null })]);
    expect(out).toContain('21 分鐘');
    expect(out).toContain('9.4 公里');
    expect(out).not.toContain('同一地點');
  });
});
