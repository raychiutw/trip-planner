/**
 * 測試用 D1（Miniflare）的連線複用。
 *
 * Miniflare 對每個送往 workerd 的請求都設 `reset: true`（等同 Connection: close），
 * 於是每個 D1 語句都新開一條 TCP 連線。整套 API 測試約 2 萬條語句，在 macOS 上會把
 * 暫時埠（約 1.6 萬個、TIME_WAIT 約 30 秒）用光，隨機出現 `EADDRNOTAVAIL`（fetch failed），
 * 看起來像「測試互相干擾」，其實只是連線數（#1485）。
 *
 * 這裡只守「很多條語句不會開很多條連線」這個行為，不綁定實作手法。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import net from 'node:net';
import { createTestDb } from './setup';

describe('測試用 D1 的連線數', () => {
  let db: D1Database;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it('連續 200 條語句只開少數幾條 TCP 連線', async () => {
    const original = net.Socket.prototype.connect;
    let connects = 0;
    net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
      connects++;
      return (original as (...a: unknown[]) => net.Socket).apply(this, args);
    } as typeof net.Socket.prototype.connect;
    try {
      for (let i = 0; i < 200; i++) await db.prepare('SELECT 1').first();
    } finally {
      net.Socket.prototype.connect = original;
    }
    // 每條語句各開一條時是 200；複用時只會是個位數
    expect(connects).toBeLessThan(10);
  });
});
