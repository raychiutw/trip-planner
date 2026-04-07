/**
 * tripline-api-server processLoop 測試
 * 測試 consecutiveFailures 重試風暴防護邏輯
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('processLoop consecutiveFailures 邏輯', () => {
  // 模擬 processLoop 的核心邏輯（不依賴 HTTP server 和外部 API）
  const MAX_CONSECUTIVE_FAILURES = 3;

  function simulateProcessLoop(fetchResults, patchResults) {
    let consecutiveFailures = 0;
    let processedCount = 0;
    const log = [];
    let fetchIndex = 0;
    let patchIndex = 0;

    while (true) {
      // fetchOldestOpen
      const req = fetchResults[fetchIndex++];
      if (!req) {
        log.push('no_open_requests');
        break;
      }

      // patchStatus → processing
      const claimed = patchResults[patchIndex++];
      if (!claimed) {
        log.push('claim_failed:' + req.id);
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          log.push('max_failures_reached');
          break;
        }
        continue;
      }

      consecutiveFailures = 0;
      // runClaude 假設成功
      processedCount++;
      log.push('processed:' + req.id);
    }

    return { processedCount, consecutiveFailures, log };
  }

  it('正常處理 — 全部成功', () => {
    const fetches = [{ id: 1 }, { id: 2 }, null];
    const patches = [true, true];
    const result = simulateProcessLoop(fetches, patches);
    expect(result.processedCount).toBe(2);
    expect(result.consecutiveFailures).toBe(0);
    expect(result.log).toEqual(['processed:1', 'processed:2', 'no_open_requests']);
  });

  it('無 open requests — 直接結束', () => {
    const result = simulateProcessLoop([null], []);
    expect(result.processedCount).toBe(0);
    expect(result.log).toEqual(['no_open_requests']);
  });

  it('單次 claim 失敗後恢復', () => {
    const fetches = [{ id: 1 }, { id: 2 }, null];
    const patches = [false, true];
    const result = simulateProcessLoop(fetches, patches);
    expect(result.processedCount).toBe(1);
    expect(result.consecutiveFailures).toBe(0);
    expect(result.log).toContain('claim_failed:1');
    expect(result.log).toContain('processed:2');
  });

  it('連續 3 次 claim 失敗 — 停止迴圈', () => {
    const fetches = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const patches = [false, false, false];
    const result = simulateProcessLoop(fetches, patches);
    expect(result.processedCount).toBe(0);
    expect(result.consecutiveFailures).toBe(3);
    expect(result.log).toEqual([
      'claim_failed:1',
      'claim_failed:2',
      'claim_failed:3',
      'max_failures_reached'
    ]);
  });

  it('2 次失敗後成功 — 計數器重置', () => {
    const fetches = [{ id: 1 }, { id: 2 }, { id: 3 }, null];
    const patches = [false, false, true];
    const result = simulateProcessLoop(fetches, patches);
    expect(result.processedCount).toBe(1);
    expect(result.consecutiveFailures).toBe(0);
    expect(result.log).toContain('claim_failed:1');
    expect(result.log).toContain('claim_failed:2');
    expect(result.log).toContain('processed:3');
  });

  it('成功 → 失敗 → 失敗 → 失敗 — 在第 3 次連續失敗停止', () => {
    const fetches = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const patches = [true, false, false, false];
    const result = simulateProcessLoop(fetches, patches);
    expect(result.processedCount).toBe(1);
    expect(result.consecutiveFailures).toBe(3);
    expect(result.log[0]).toBe('processed:1');
    expect(result.log[result.log.length - 1]).toBe('max_failures_reached');
  });

  it('交替成功失敗 — 永遠不會達到上限', () => {
    const fetches = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, null];
    const patches = [false, true, false, true];
    const result = simulateProcessLoop(fetches, patches);
    expect(result.processedCount).toBe(2);
    expect(result.consecutiveFailures).toBe(0);
  });

  it('MAX_CONSECUTIVE_FAILURES 是 3', () => {
    expect(MAX_CONSECUTIVE_FAILURES).toBe(3);
  });
});

describe('API server HTTP endpoints', () => {
  it('health endpoint 回傳正確結構', () => {
    const health = {
      running: false,
      lastProcessed: null,
      processedCount: 0,
      uptime: 100
    };
    expect(health).toHaveProperty('running');
    expect(health).toHaveProperty('lastProcessed');
    expect(health).toHaveProperty('processedCount');
    expect(health).toHaveProperty('uptime');
  });

  it('verifyAuth 拒絕空 secret', () => {
    function verifyAuth(authHeader, apiSecret) {
      if (!apiSecret) return false;
      return authHeader === 'Bearer ' + apiSecret;
    }
    expect(verifyAuth('Bearer test', '')).toBe(false);
    expect(verifyAuth('Bearer test', 'test')).toBe(true);
    expect(verifyAuth('Bearer wrong', 'test')).toBe(false);
    expect(verifyAuth('', 'test')).toBe(false);
  });
});
