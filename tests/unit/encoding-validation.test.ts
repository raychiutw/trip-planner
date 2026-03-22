import { describe, it, expect } from 'vitest';
import { detectGarbledText } from '../../functions/api/_validate';

describe('detectGarbledText', () => {
  it('偵測 U+FFFD replacement character', () => {
    expect(detectGarbledText('約\uFFFD分鐘')).toBe(true);
  });
  it('偵測連續 Latin Extended bytes', () => {
    expect(detectGarbledText('\xC0\xC1\xC2\xC3')).toBe(true);
  });
  it('正常中文不誤判', () => {
    expect(detectGarbledText('約15分鐘')).toBe(false);
  });
  it('正常英文不誤判', () => {
    expect(detectGarbledText('about 15 minutes')).toBe(false);
  });
  it('空字串不誤判', () => {
    expect(detectGarbledText('')).toBe(false);
  });
  it('null 不誤判', () => {
    expect(detectGarbledText(null as any)).toBe(false);
  });
  it('混合中英數不誤判', () => {
    expect(detectGarbledText('Day 3 那霸 2026-07-04')).toBe(false);
  });
  it('偵測 CP950 亂碼模式', () => {
    // 模擬 CP950 亂碼: "約" 的 Big5 是 0xAC 0xFC，被當 Latin-1 解讀
    expect(detectGarbledText('\u00AC\u00FC15\u00A4\u00C0\u00C1\u00F6')).toBe(true);
  });
});
