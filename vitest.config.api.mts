import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/api/**/*.test.ts'],
    exclude: ['node_modules/**'],
    testTimeout: 90000,
    hookTimeout: 60000,
    // v2.33.84 Round 33: 解 EADDRNOTAVAIL port exhaustion。
    //
    // Root cause（深調發現）：
    //   1. setup.ts `let _mf` 是 module-level，Vitest 4 即使 isolate: false 仍
    //      會 per-file re-evaluate module → `_mf = null` 重置
    //   2. 36 個 test file 在 afterAll(disposeMiniflare) → 每檔結束 dispose
    //      singleton → 下一檔 createTestDb 再 new Miniflare
    //   3. 每 new Miniflare spawn workerd child process + 內部 HTTP server
    //      → 累積 35+ workerd 同時跑 → ephemeral port (49152-65535) 耗盡
    //   4. 觸發 EADDRNOTAVAIL 隨機 fail 20-30 個 test
    //
    // 配對修法：
    //   - setup.ts 改 globalThis cache（跨 module re-eval 維持）
    //   - disposeMiniflare 改 no-op（per-file dispose 是 anti-pattern）
    //   - 單 worker（maxWorkers: 1 + fileParallelism: false + pool: forks）
    //   - isolate: false（讓 module 真共用）
    //
    // 實測：Miniflare 35 instances → 1 instance；EADDRNOTAVAIL 25+ → 0；
    // 失敗 test 從「20-30 隨機 port noise + 7 pre-existing」→ 0 port noise +
    // 同 27 pre-existing。Real bugs 暴露出來。
    pool: 'forks',
    isolate: false,
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,
  },
});
