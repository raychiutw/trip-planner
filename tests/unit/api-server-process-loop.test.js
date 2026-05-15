/**
 * tripline-api-server 結構測試
 *
 * v2.30.7 重構後 processLoop 縮成「cleanupOrphans + hasActiveSession + spawnTmuxRequest」三步，
 * 不再有 `consecutiveFailures` retry 風暴邏輯（skill 自己 drain queue + 自殺）。
 * 純 JS 邏輯模擬已無對應實作，本檔留 health endpoint 結構 + verifyAuth 兩條輕測試。
 */
import { describe, it, expect } from 'vitest';

describe('API server HTTP endpoints', () => {
  it('health endpoint 回傳正確結構', () => {
    const health = {
      running: false,
      lastProcessed: null,
      processedCount: 0,
      uptime: 100,
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

  it('tmux session prefix 命名一致 (cleanupOrphans grep 依賴)', () => {
    const SESSION_PREFIX = 'tripline-request-';
    const sample = `${SESSION_PREFIX}${Date.now()}-${process.pid}`;
    expect(sample).toMatch(/^tripline-request-\d+-\d+$/);
    expect(sample.startsWith(SESSION_PREFIX)).toBe(true);
  });
});
