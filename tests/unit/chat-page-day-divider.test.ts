/**
 * buildMessagesWithDividers unit test — Section 4.8 (terracotta-mockup-parity-v2)
 *
 * 純函式測試，不 mount React。驗 day-divider inject 邏輯：
 *   1. 同一日連續 message 不 inject
 *   2. 跨日 message 之間 inject 一筆 day-divider
 *   3. 第一筆有 createdAt 也會 inject (initial divider)
 *   4. 無 createdAt 的 message 不觸發 divider
 */
import { describe, expect, it } from 'vitest';
import { buildMessagesWithDividers } from '../../src/pages/ChatPage';

interface InputMsg {
  id: number | string;
  role: 'user' | 'assistant';
  text: string;
  createdAt?: string | null;
}

const baseUser = { role: 'user' as const, text: 'q' };
const baseAi = { role: 'assistant' as const, text: 'a' };

describe('buildMessagesWithDividers', () => {
  it('同一日連續 message 只 inject 1 個 divider (初始)', () => {
    const input: InputMsg[] = [
      { id: 1, ...baseUser, createdAt: '2026-04-27T10:00:00' },
      { id: 2, ...baseAi, createdAt: '2026-04-27T10:01:00' },
      { id: 3, ...baseUser, createdAt: '2026-04-27T14:00:00' },
    ];
    const out = buildMessagesWithDividers(input);
    const dividers = out.filter((m) => m.role === 'day-divider');
    expect(dividers).toHaveLength(1);
    expect(out).toHaveLength(4); // 1 divider + 3 message
  });

  it('跨日 message 之間 inject divider', () => {
    // 用 local-time ISO (no Z) 避免 TZ 偏差讓兩 timestamps 落在同一 local day。
    const input: InputMsg[] = [
      { id: 1, ...baseUser, createdAt: '2026-04-26T10:00:00' },
      { id: 2, ...baseAi, createdAt: '2026-04-26T10:30:00' },
      { id: 3, ...baseUser, createdAt: '2026-04-28T10:00:00' },
      { id: 4, ...baseAi, createdAt: '2026-04-28T10:01:00' },
    ];
    const out = buildMessagesWithDividers(input);
    const dividers = out.filter((m) => m.role === 'day-divider');
    expect(dividers).toHaveLength(2); // 1 initial + 1 跨日
    // divider 應出現在 26 之前 + 28 之前
    const firstDividerIdx = out.findIndex((m) => m.role === 'day-divider');
    expect(firstDividerIdx).toBe(0);
    const secondDividerIdx = out.indexOf(dividers[1]!);
    expect(secondDividerIdx).toBeGreaterThan(2);
  });

  it('無 createdAt 的 message 不觸發 divider', () => {
    const input: InputMsg[] = [
      { id: 1, ...baseUser },
      { id: 2, ...baseAi },
    ];
    const out = buildMessagesWithDividers(input);
    expect(out.filter((m) => m.role === 'day-divider')).toHaveLength(0);
    expect(out).toHaveLength(2);
  });

  it('mixed createdAt + 無 → 只在有 createdAt 處挑 divider', () => {
    const input: InputMsg[] = [
      { id: 1, ...baseUser, createdAt: '2026-04-27T10:00:00' },
      { id: 2, ...baseAi },
      { id: 3, ...baseUser, createdAt: '2026-04-28T10:00:00' },
    ];
    const out = buildMessagesWithDividers(input);
    const dividers = out.filter((m) => m.role === 'day-divider');
    expect(dividers).toHaveLength(2);
  });

  it('divider id 含 dateKey 字串，便於 React key', () => {
    const input: InputMsg[] = [
      { id: 1, ...baseUser, createdAt: '2026-04-27T10:00:00' },
    ];
    const out = buildMessagesWithDividers(input);
    const divider = out.find((m) => m.role === 'day-divider');
    expect(divider).toBeTruthy();
    expect(String(divider!.id)).toMatch(/^day-divider-/);
  });

  it('divider text 含日期 + 中文週幾', () => {
    const input: InputMsg[] = [
      // 2026-04-27 週一 in local time（測試會在 system local TZ 下跑，
      // 但 weekday 對應依 new Date.getDay 解 ISO 後 local；只驗格式 + 含週X）
      { id: 1, ...baseUser, createdAt: '2026-04-27T10:00:00' },
    ];
    const out = buildMessagesWithDividers(input);
    const divider = out.find((m) => m.role === 'day-divider');
    expect(divider!.text).toMatch(/週(日|一|二|三|四|五|六)/);
    expect(divider!.text).toMatch(/\d{4}\/\d{2}\/\d{2}/);
  });
});
