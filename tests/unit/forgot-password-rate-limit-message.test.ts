// @vitest-environment node
/**
 * v2.31.58 zh-TW grammar fix: ForgotPasswordPage rate-limit fallback message.
 *
 * Bug (prod QA found via grep)：
 *   `setWarning(\`重設請求過多。請 ${retryAfter ?? '幾分鐘'} 秒後再試。\`)`
 * retryAfter null fallback「幾分鐘」+ 後綴「秒後」直接拼接 →
 * 「請幾分鐘秒後再試」(請 [few minutes] seconds later) 文法不通。
 *
 * Fix：條件式分支，retryAfter 存在用秒、null 用「請幾分鐘後再試」。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/ForgotPasswordPage.tsx'),
  'utf8',
);

describe('v2.31.58 ForgotPasswordPage rate-limit message', () => {
  it('retryAfter 條件式分支取代原本 nullish coalescing 拼接', () => {
    expect(SRC).toMatch(
      /retryAfter\s*\n?\s*\?\s*`重設請求過多。請 \$\{retryAfter\} 秒後再試。`/,
    );
    expect(SRC).toMatch(/:\s*'重設請求過多。請幾分鐘後再試。'/);
  });

  it('原本 broken「幾分鐘秒後」拼接已移除', () => {
    expect(SRC).not.toMatch(/retryAfter \?\? '幾分鐘'/);
  });
});
