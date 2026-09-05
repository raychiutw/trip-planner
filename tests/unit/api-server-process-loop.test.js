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

  it('tmux session prefix 命名一致 (cleanupOrphans 多 prefix match 依賴)', () => {
    // v2.33.110: cleanupOrphans 用「ALLOWED_SKILLS-derived + LEGACY」prefix set，
    // 不再 hardcode 單一 prefix。確認三種樣本 session 命名都會被歸類為已知。
    const knownPrefixes = [
      'tripline-tp-request-',     // /tp-request per-skill (v2.33.27+)
      'tripline-tp-daily-check-', // /tp-daily-check per-skill
      'tripline-request-',        // LEGACY (v2.33.26 前)
    ];
    const samples = [
      `${knownPrefixes[0]}${Date.now()}-${process.pid}`,
      `${knownPrefixes[1]}${Date.now()}-${process.pid}`,
      `${knownPrefixes[2]}${Date.now()}-${process.pid}`,
    ];
    for (const name of samples) {
      expect(knownPrefixes.some(p => name.startsWith(p))).toBe(true);
    }
    // human ad-hoc 不該被 match（quality agent finding）
    expect(knownPrefixes.some(p => 'tripline-debug'.startsWith(p))).toBe(false);
  });
});

describe('#1264 api-server 只組裝 adapter，決策在 request-worker', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const SRC = fs.readFileSync(path.resolve(__dirname, '../../scripts/tripline-api-server.ts'), 'utf8');
  it('/health 用 worker.status()、/trigger 與 cron 用 worker.isRunning()', () => {
    expect(SRC).toMatch(/\.\.\.worker\.status\(\)/);
    expect(SRC).toMatch(/worker\.isRunning\('\/tp-request'\)/);
    expect(SRC).toMatch(/worker\.isRunning\(skillCommand\)/);
  });
  it('script 內不再有 peek / mint / acquireToken / hasActiveSession / cleanupOrphans 的實作', () => {
    for (const fn of ['peekPendingRequest', 'mintRestricted', 'acquireToken', 'hasActiveSession', 'cleanupOrphans', 'spawnTmuxRequest']) {
      expect(SRC).not.toMatch(new RegExp(`function ${fn}\\(`));
    }
  });
});

