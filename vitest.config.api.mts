import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/api/**/*.test.ts'],
    exclude: ['node_modules/**'],
    testTimeout: 30000,
    // v2.33.83 Round 32: 嘗試過 `isolate: false + singleFork: true` 解
    // EADDRNOTAVAIL port exhaustion，**net effect ~baseline**（21 fail vs
    // 22 fail）— 因為 root cause 不是 Miniflare instance 數，而是 per-test
    // fetch() round-trip 在 Miniflare 內部 HTTP layer 累 socket TIME_WAIT。
    // 已 revert：把 isolate: false 留著只多 mock spillover footgun，不解問題。
    // Round 32 留下：tests/api/invitations-accept.test.ts 改 scoped doMock
    // (本來就該做的 test hygiene)。
  },
});
