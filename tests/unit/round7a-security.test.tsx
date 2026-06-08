/**
 * round7a-security.test.tsx — v2.33.46 round 7 security fixes
 *
 * 驗證 5 個 security HIGH/MED fix 的 wiring (source-grep + behavior):
 *  1. SessionsPage logout 從 <a href> GET 改 POST button
 *  2. EditEntryPage reservationUrl 套 escUrl + rel="noopener noreferrer"
 *  3. ConsentPage app_name 不直接 reflect client_id（防 spoofing）
 *  4. ConsentPage 未知 scope 顯警告
 *  5. ChatPage markdown=true 只給 role='assistant'
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SESSIONS_SRC = readFileSync(path.resolve(__dirname, '../../src/pages/SessionsPage.tsx'), 'utf-8');
const EDIT_ENTRY_SRC = readFileSync(path.resolve(__dirname, '../../src/pages/EditEntryPage.tsx'), 'utf-8');
const CONSENT_SRC = readFileSync(path.resolve(__dirname, '../../src/pages/ConsentPage.tsx'), 'utf-8');
const CHAT_SRC = readFileSync(path.resolve(__dirname, '../../src/pages/ChatPage.tsx'), 'utf-8');
const TRIP_SRC = readFileSync(path.resolve(__dirname, '../../src/pages/TripPage.tsx'), 'utf-8');
const LOGIN_SRC = readFileSync(path.resolve(__dirname, '../../src/pages/LoginPage.tsx'), 'utf-8');

describe('v2.33.46 round 7a — SessionsPage logout CSRF fix', () => {
  it('logout 改 POST button (拔 GET <a href>)', () => {
    expect(SESSIONS_SRC).not.toMatch(/<a\s+href="\/api\/oauth\/logout"/);
    expect(SESSIONS_SRC).toMatch(/apiFetchRaw\(['"]\/oauth\/logout['"]\s*,\s*\{\s*method:\s*['"]POST['"]/);
  });

  it('button onClick navigate to /login replace', () => {
    expect(SESSIONS_SRC).toMatch(/navigate\(['"]\/login['"]\s*,\s*\{\s*replace:\s*true/);
  });
});

describe('v2.33.46 round 7a — EditEntryPage reservationUrl XSS guard', () => {
  // v2.55：reservation 從唯讀 chip 改成 PerPoiNoteRow 可編 row，訂位連結移到 row 右側
  // 外連 link（className tp-poi-note-link），escUrl + noopener 守護不變。
  it('reservationUrl 套 escUrl', () => {
    expect(EDIT_ENTRY_SRC).toMatch(/import\s+\{\s*escUrl\s*\}\s+from\s+['"][./]+lib\/sanitize['"]/);
    expect(EDIT_ENTRY_SRC).toMatch(/escUrl\(reservationUrl\)/);
  });

  it('reservation link 有 rel="noopener noreferrer" (不只 noreferrer)', () => {
    // 抓 reservation link 的 rel attribute
    expect(EDIT_ENTRY_SRC).toMatch(/rel="noopener noreferrer"\s*\n\s*className="tp-poi-note-link"/);
  });
});

describe('v2.33.46 round 7a — ConsentPage app_name spoofing fix', () => {
  it('app_name 不直接 = clientId (顯「未知應用程式」warning)', () => {
    // app_name: clientId 模式被改寫成 "未知應用程式 (client_id=..."
    expect(CONSENT_SRC).toMatch(/未知應用程式.*client_id=/);
    expect(CONSENT_SRC).not.toMatch(/app_name:\s*clientId\s*,/);
  });

  it('KNOWN_SCOPES allowlist 存在', () => {
    expect(CONSENT_SRC).toMatch(/KNOWN_SCOPES\s*=\s*new Set\(Object\.keys\(SCOPE_DESCRIPTIONS\)\)/);
  });

  it('未知 scope render warning 警告字串', () => {
    expect(CONSENT_SRC).toMatch(/未知範圍 — 請勿授權/);
  });

  it('redirect_uri client-side validation', () => {
    expect(CONSENT_SRC).toMatch(/function isPlausibleRedirectUri/);
    expect(CONSENT_SRC).toMatch(/url\.protocol === ['"]https:['"]/);
    expect(CONSENT_SRC).toMatch(/redirect_uri 不合法/);
  });
});

describe('v2.33.46 round 7a — ChatPage markdown role gate', () => {
  it('markdown=true 只在 role===\'assistant\' 時 render MarkdownText', () => {
    expect(CHAT_SRC).toMatch(/m\.markdown\s*&&\s*m\.role\s*===\s*['"]assistant['"]/);
  });
});

describe('v2.33.46 round 7a — TripPage setTimeout cleanup', () => {
  it('rAF + setTimeout 有 cleanup return', () => {
    // Look for cancelAnimationFrame + clearTimeout in the autolocate effect cleanup
    expect(TRIP_SRC).toMatch(/cancelAnimationFrame\(rafId\)/);
    expect(TRIP_SRC).toMatch(/clearTimeout\(timeoutId\)/);
  });
});

describe('v2.33.46 round 7a — LoginPage countdown timer baseline', () => {
  it('用 Date.now baseline 取代純 -1 counter', () => {
    expect(LOGIN_SRC).toMatch(/lockedUntilRef\s*=\s*useRef<number \| null>/);
    expect(LOGIN_SRC).toMatch(/Date\.now\(\)\s*\+\s*lockedRetryAfter\s*\*\s*1000/);
    expect(LOGIN_SRC).toMatch(/Math\.ceil\(\(until\s*-\s*Date\.now\(\)\)\s*\/\s*1000\)/);
  });
});
