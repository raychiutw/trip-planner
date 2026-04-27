/**
 * isGarbledMessage detection helper — F7 design-review safe-render guard。
 *
 * 對應 backend functions/api/_validate.ts:detectGarbledText 的 3 條規則，
 * 在 frontend render chat history 前 bail out 已存在 D1 的 mojibake row。
 */
import { describe, expect, it } from 'vitest';
import { isGarbledMessage } from '../../src/pages/ChatPage';

describe('isGarbledMessage', () => {
  it('正常中文不視為亂碼', () => {
    expect(isGarbledMessage('您好，這是正常訊息')).toBe(false);
    expect(isGarbledMessage('沖繩五日自駕遊行程表')).toBe(false);
  });

  it('Rule 1: 含 U+FFFD replacement char 視為亂碼', () => {
    expect(isGarbledMessage('hello � world')).toBe(true);
    expect(isGarbledMessage('�')).toBe(true);
  });

  it('Rule 2: 連續 3+ Latin Extended (CP950 / Big5 誤解碼特徵) 視為亂碼', () => {
    // 連續 3 個 -ÿ 內字元 → 亂碼
    expect(isGarbledMessage('Â Ãhello')).toBe(true);
    expect(isGarbledMessage('ÿþý')).toBe(true);
  });

  it('Rule 3: 單個 C1 控制字元 (U+0080-U+009F) 視為亂碼', () => {
    expect(isGarbledMessage('testrest')).toBe(true);
    expect(isGarbledMessage('')).toBe(true);
  });

  it('空字串 / 非字串 / null 返回 false', () => {
    expect(isGarbledMessage('')).toBe(false);
    expect(isGarbledMessage(null as unknown as string)).toBe(false);
    expect(isGarbledMessage(undefined as unknown as string)).toBe(false);
    expect(isGarbledMessage(123 as unknown as string)).toBe(false);
  });

  it('正常英文 + 標點 + 數字不視為亂碼', () => {
    expect(isGarbledMessage('Hello, world! 12345')).toBe(false);
    expect(isGarbledMessage('Email: user@example.com')).toBe(false);
  });

  it('混合語言但 ASCII + valid UTF-8 中文不誤判', () => {
    expect(isGarbledMessage('Day 1: 北谷 09:00-11:00')).toBe(false);
    expect(isGarbledMessage('預算 ¥10,000')).toBe(false);
  });
});
