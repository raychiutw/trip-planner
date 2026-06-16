/**
 * CF alertAdminTelegram observability + admin test endpoint — v2.33.134 PR10 part 2
 *
 * 2026-05-27 incident：rayschiu@fetci.com forgot-password 失敗，CF Worker
 * 內 catch 跑 alertAdminTelegram 但 user 沒收到 Telegram。原 impl 失敗時只
 * console.warn（wrangler tail default filter 掉）→ forensic 完全沒 trace。
 * 加 console.error 強化 + admin test endpoint 給 forensic 跑。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ALERT = readFileSync(
  join(__dirname, '../../functions/api/_alert.ts'),
  'utf8',
);
// Phase 3（移除全域 admin）：test-alert.ts 已刪除，相關 describe block 移除。

describe('alertAdminTelegram 強化 log', () => {
  it('env 缺從 console.warn → console.error (wrangler tail default 顯示)', () => {
    expect(ALERT).toMatch(/console\.error\('\[alert\] SKIP — TELEGRAM_BOT_TOKEN/);
    expect(ALERT).toMatch(/hasToken: !!token,\s+hasChatId: !!chatId,/);
  });

  it('呼叫前 console.log "sending" 含 token prefix(10) + chat tail(4) + msg preview(80)', () => {
    expect(ALERT).toMatch(/const tokenPrefix = token\.slice\(0, 10\)/);
    expect(ALERT).toMatch(/const chatTail = chatId\.slice\(-4\)/);
    expect(ALERT).toMatch(/const msgPreview = message\.slice\(0, 80\)/);
    expect(ALERT).toMatch(/console\.log\('\[alert\] sending'/);
  });

  it('成功 path console.log "sent OK" 含 status + elapsedMs', () => {
    expect(ALERT).toMatch(/console\.log\('\[alert\] sent OK', \{ status: res\.status, elapsedMs \}\)/);
  });

  it('非 2xx console.error 含 status + body(200) + elapsedMs + token/chat prefix', () => {
    expect(ALERT).toMatch(/\[alert\] Telegram API non-2xx/);
    expect(ALERT).toMatch(/body: errText\.slice\(0, 200\),/);
    expect(ALERT).toMatch(/elapsedMs,\s+tokenPrefix,\s+chatTail/);
  });

  it('fetch catch 含 elapsedMs + aborted flag + token/chat prefix', () => {
    expect(ALERT).toMatch(/\[alert\] Telegram fetch failed/);
    expect(ALERT).toMatch(/aborted: ctrl\.signal\.aborted/);
  });

  it('elapsedMs 用 Date.now\\() 量 start→end', () => {
    expect(ALERT).toMatch(/const t0 = Date\.now\(\);/);
    expect(ALERT).toMatch(/const elapsedMs = Date\.now\(\) - t0;/);
  });

  it('clearTimeout 仍在 finally 保 timer 不 leak', () => {
    expect(ALERT).toMatch(/} finally \{\s+clearTimeout\(timer\)/);
  });
});

