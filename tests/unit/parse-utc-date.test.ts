/**
 * parseUtcDate — D1 naive datetime → UTC parse 修正
 *
 * v2.31.6 QA 抓到 AI 完成時間戳 `formatTimestamp` 顯示「8 小時前完成」
 * 實際 7 分鐘前的 bug。Root cause: `new Date("2026-05-16 13:39:29")` 沒 Z 後綴
 * 被 Chrome 當 local 解析。本 helper 把 D1 format 正規化為 UTC。
 */
import { describe, it, expect } from 'vitest';
import { parseUtcDate } from '../../src/lib/parseUtcDate';

describe('parseUtcDate', () => {
  it('D1 naive datetime → 當作 UTC', () => {
    const d = parseUtcDate('2026-05-16 13:39:29');
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe('2026-05-16T13:39:29.000Z');
  });

  it('D1 naive with .SSS millis → 當作 UTC', () => {
    const d = parseUtcDate('2026-05-16 13:39:29.123');
    expect(d!.toISOString()).toBe('2026-05-16T13:39:29.123Z');
  });

  it('ISO 8601 with Z → pass through', () => {
    const d = parseUtcDate('2026-05-16T13:39:29Z');
    expect(d!.toISOString()).toBe('2026-05-16T13:39:29.000Z');
  });

  it('ISO 8601 with +08:00 offset → pass through', () => {
    const d = parseUtcDate('2026-05-16T21:39:29+08:00');
    expect(d!.toISOString()).toBe('2026-05-16T13:39:29.000Z');
  });

  it('null / undefined / empty → null', () => {
    expect(parseUtcDate(null)).toBeNull();
    expect(parseUtcDate(undefined)).toBeNull();
    expect(parseUtcDate('')).toBeNull();
    expect(parseUtcDate('   ')).toBeNull();
  });

  it('garbage string → null', () => {
    expect(parseUtcDate('not a date')).toBeNull();
  });

  it('不會把 ISO 8601 Z 再多補一個 Z（regression）', () => {
    const d = parseUtcDate('2026-05-16T13:39:29.500Z');
    expect(d!.toISOString()).toBe('2026-05-16T13:39:29.500Z');
  });
});
