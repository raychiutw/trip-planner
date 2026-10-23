/**
 * Sentry 11 預設 traceLifecycle 'stream'，beforeSendTransaction 會被忽略，
 * HeadlessChrome / localhost 的 pageload 雜訊會復發。只要還用 beforeSendTransaction，
 * 就必須同時設 traceLifecycle: 'static'。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SENTRY = readFileSync(join(__dirname, '../../src/lib/sentry.ts'), 'utf8');
// 守衛讀原始碼要先剝註解，避免註解裡的字面值造成假綠
const CODE = SENTRY.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('sentry.ts traceLifecycle', () => {
  it("使用 beforeSendTransaction 時必須設 traceLifecycle: 'static'", () => {
    expect(CODE).toMatch(/beforeSendTransaction\(/);
    expect(CODE).toMatch(/traceLifecycle:\s*'static'/);
  });
});
