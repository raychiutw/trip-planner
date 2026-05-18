// @vitest-environment node
/**
 * v2.31.74 AI 健檢 backend post-process sanitizer test.
 *
 * v2.31.65 prompt 強化用詞但 prod QA 仍有 leak (e.g. "新增早餐 entry 並掛具體店家")。
 * sanitizeSchemaWords 用 regex 強制替換 banword list，不靠 LLM 100% 服從。
 *
 * Test 直接 import helper + assert input → expected output。
 */
import { describe, it, expect } from 'vitest';
import { sanitizeSchemaWords } from '../../functions/api/requests/[id]/index';

describe('v2.31.74 sanitizeSchemaWords', () => {
  it('entry → 景點 (case-insensitive)', () => {
    expect(sanitizeSchemaWords('新增早餐 entry 並掛具體店家')).toBe('新增早餐 景點 並掛具體店家');
    expect(sanitizeSchemaWords('Entry 877 重疊')).toBe('景點 877 重疊');
    expect(sanitizeSchemaWords('add ENTRY here')).toBe('add 景點 here');
  });

  it('entries → 景點', () => {
    expect(sanitizeSchemaWords('multiple entries on Day 2')).toBe('multiple 景點 on Day 2');
  });

  it('POI / POIs → 景點 (case-sensitive — POI is acronym)', () => {
    expect(sanitizeSchemaWords('add the POI here')).toBe('add the 景點 here');
    expect(sanitizeSchemaWords('list of POIs')).toBe('list of 景點');
  });

  it('check-in / check in → 入住', () => {
    expect(sanitizeSchemaWords('飯店 check-in 衝突')).toBe('飯店 入住 衝突');
    expect(sanitizeSchemaWords('hotel check in late')).toBe('hotel 入住 late');
  });

  it('numbered min/km → 分鐘 / 公里', () => {
    // 'travel 30 min': numbered min rule fires first, then 'travel' rule
    expect(sanitizeSchemaWords('travel 30 min')).toBe('移動 30 分鐘');
    expect(sanitizeSchemaWords('移動 30min')).toBe('移動 30 分鐘');
    expect(sanitizeSchemaWords('距離 5km 不遠')).toBe('距離 5 公里 不遠');
    expect(sanitizeSchemaWords('繞路 18 公里')).toBe('繞路 18 公里'); // already 公里, no change
  });

  it('travel min (no number between) → 移動時間', () => {
    expect(sanitizeSchemaWords('travel min 過長')).toBe('移動時間 過長');
  });

  it('travel / polyline / buffer / rating / alt → Chinese', () => {
    expect(sanitizeSchemaWords('travel 過長')).toBe('移動 過長');
    expect(sanitizeSchemaWords('polyline 不連')).toBe('路線 不連');
    expect(sanitizeSchemaWords('check-in buffer 太短')).toBe('入住 緩衝時間 太短');
    expect(sanitizeSchemaWords('rating 偏低')).toBe('評分 偏低');
    expect(sanitizeSchemaWords('找個 alt 餐廳')).toBe('找個 替代 餐廳');
  });

  it('does NOT match word-boundary substrings (no false positives)', () => {
    // "alternate" should NOT match \balt\b
    expect(sanitizeSchemaWords('alternate route')).toBe('alternate route');
    // "minute" should not match \bmin\b (no boundary after min in "minute")
    expect(sanitizeSchemaWords('every minute')).toBe('every minute');
    // "altitude" should not match \balt\b
    expect(sanitizeSchemaWords('high altitude')).toBe('high altitude');
  });

  it('preserves Chinese / numerics / unrelated text', () => {
    expect(sanitizeSchemaWords('Day 4 第 778 號景點許田休息站')).toBe('Day 4 第 778 號景點許田休息站');
    expect(sanitizeSchemaWords('20:45-21:15')).toBe('20:45-21:15');
  });

  it('handles full real prod leak case', () => {
    // 從 prod QA 抓到的實際 leak
    const input = '新增早餐 entry 並掛具體店家（如 jef 那覇店或飯店附近便利店熱食），或併入第一站樂市超市熟食區。';
    const expected = '新增早餐 景點 並掛具體店家（如 jef 那覇店或飯店附近便利店熱食），或併入第一站樂市超市熟食區。';
    expect(sanitizeSchemaWords(input)).toBe(expected);
  });
});
