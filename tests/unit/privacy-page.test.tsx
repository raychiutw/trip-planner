/**
 * 隱私權政策頁 `/privacy`
 *
 * Google Play 送審必要項，也是 SignupPage 同意勾選框、AccountPage 入口、
 * Flutter 註冊畫面、Play Console 欄位共四處指向的目標。
 *
 * 這支測試的重點**不是**排版，是「政策內容不得與程式行為不符」。
 * 隱私權政策寫錯不是文案瑕疵，是不實陳述。所以下面每一條斷言都對應一個
 * 已實證的程式事實：
 *
 *   - `scripts/auth-cleanup.js` 沒有任何排程（`.github/workflows/` 無對應
 *     workflow，`daily-report.js:341` 的 cleanupOldLogs 已改 no-op 交棒給它）
 *     → 登入稽核／裝置紀錄／錯誤回報／API 紀錄／AI 健檢報告**都不會自動刪除**。
 *     mockup 草稿寫的「30 天 / 60 天 / 90 天…逾期自動清除」7 項裡只有
 *     「共編邀請 30 天」是真的（`invitation-cleanup.yml` 每日 03:00 有跑）。
 *   - Sentry DSN 指向 `*.ingest.us.sentry.io` → 資料在**美國**，屬跨境傳輸。
 *   - `rate_limit_buckets` 用明文 IP + 明文 email 當 PK（`migrations/0035`），
 *     而 `auth_audit_log` 的 IP 有雜湊 → 不可籠統宣稱「IP 一律雜湊儲存」。
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PrivacyPage from '../../src/pages/PrivacyPage';

function renderPage() {
  return render(<MemoryRouter><PrivacyPage /></MemoryRouter>);
}

/** 取得整頁純文字，用來做「有沒有講到某件事」的內容斷言。 */
function pageText(): string {
  renderPage();
  return screen.getByTestId('privacy-page').textContent ?? '';
}

describe('PrivacyPage — 基本結構', () => {
  it('渲染出頁面與標題', () => {
    renderPage();
    expect(screen.getByTestId('privacy-page')).toBeTruthy();
    expect(screen.getAllByText(/隱私權政策/).length).toBeGreaterThan(0);
  });

  it('標示政策版本 —— 與 signup 記錄的 PRIVACY_POLICY_VERSION 對得起來', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const signupSrc = readFileSync(
      resolve(__dirname, '../../functions/api/oauth/signup.ts'), 'utf-8');
    const version = signupSrc.match(/PRIVACY_POLICY_VERSION\s*=\s*'([^']+)'/)?.[1];
    expect(version, '後端應有政策版本常數').toBeTruthy();
    // 使用者同意的是「哪一版」，頁面就得看得到那一版，否則版本紀錄無從對照。
    expect(pageText()).toContain(version!);
  });

  it('未登入可讀 —— 不呼叫任何需要 session 的 API', () => {
    // Google Play 審核員會用未登入狀態開這頁；元件若在 mount 時打 API，
    // 401 之後畫面可能整個空掉。這裡直接斷言沒有 fetch。
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL) => {
      calls.push(String(input));
      return Promise.reject(new Error('不該有網路請求'));
    }) as typeof fetch;
    try {
      renderPage();
      expect(calls, `隱私權頁不該發出請求，卻打了：${calls.join(', ')}`).toHaveLength(0);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('PrivacyPage — 揭露範圍（Google Play 要求）', () => {
  it('說明收集哪些資料', () => {
    const text = pageText();
    for (const item of ['電子郵件', '行程', '密碼']) {
      expect(text, `未揭露「${item}」`).toContain(item);
    }
  });

  it('列出實際會收到資料的第三方', () => {
    // 來源：public/_headers 的 CSP connect-src / img-src（瀏覽器實際連線對象）
    // 加上 server 端 functions/api 的連外。憑空少列一個就是揭露不完整。
    const text = pageText();
    for (const vendor of ['Cloudflare', 'Google', 'Sentry', 'Open-Meteo']) {
      expect(text, `未揭露第三方「${vendor}」`).toContain(vendor);
    }
  });

  it('揭露寄信路徑 —— 信件經自架主機再由 Gmail SMTP 寄出', () => {
    // `src/server/email.ts`：驗證信／重設密碼信／共編邀請信都 POST 到
    // TRIPLINE_API_URL（自架 mac mini，Tailscale Funnel），由它用 Gmail SMTP 寄。
    // 也就是使用者 email、驗證連結、**被邀請第三方的 email**（permissions.ts:111）
    // 都會經過一台自架主機。政策若只說「傳給 Cloudflare / Google」而不提這條，
    // 就與「除此之外我們不對外提供你的個人資料」自相矛盾。
    expect(pageText()).toMatch(/寄送電子郵件|郵件寄送|寄信/);
  });

  it('不得列出專案實際沒有使用的第三方', async () => {
    // 過度揭露一樣是不實陳述。Mapbox 曾出現在草稿，但 functions/ 全域零命中
    // （路線走 Google Routes），`.dev.vars` 的 MAPBOX_TOKEN 是遺留設定。
    const { resolve } = await import('path');
    const { execSync } = await import('child_process');
    const root = resolve(__dirname, '../..');

    // 判斷「有沒有真的用」要看**實際 endpoint**，不能只 grep 品牌名 ——
    // route.ts 與 _middleware.ts 都還留著提到 Mapbox 的註解（遷移註記），
    // 用品牌名判斷會被註解騙過去，這條測試就形同虛設。
    const callsMapbox = (() => {
      try {
        execSync('grep -rl "api\.mapbox\.com" functions src', { cwd: root, stdio: 'pipe' });
        return true;
      } catch { return false; }
    })();
    if (!callsMapbox) {
      expect(pageText(), '政策列了 Mapbox，但程式沒有呼叫 api.mapbox.com').not.toContain('Mapbox');
    }
  });

  it('揭露資料跨境傳輸至美國', () => {
    // Sentry DSN 是 *.ingest.us.sentry.io。
    expect(pageText()).toContain('美國');
  });

  it('說明使用者可以刪除帳號，並指出刪除後的處理', () => {
    const text = pageText();
    expect(text).toContain('刪除帳號');
    expect(text, '刪除後 audit_log 是去識別化保留，不是整列刪除').toMatch(/去識別化|匿名/);
  });

  it('有聯絡方式', () => {
    expect(pageText()).toMatch(/聯絡|contact/i);
  });

  it('刪除帳號段落有錨點 —— Google Play Console 要填「帳號刪除網址」', () => {
    // Play Console 的欄位要一個**未登入可讀、說明如何刪除帳號**的網址。
    // 不需要獨立頁面，但要能深連到這段，否則審核員得自己在長文裡找。
    renderPage();
    const section = document.getElementById('delete-account');
    expect(section, '缺少 id="delete-account" 錨點').toBeTruthy();
    expect(section!.textContent).toMatch(/刪除帳號/);
  });

  it('刪除段落自身要說明刪什麼、留什麼', () => {
    // Google Play 要求刪除說明涵蓋「哪些資料被刪、哪些被保留」。
    // 這些字散在「留多久」也算揭露，但審核員是從錨點跳進來的，
    // 該段自己要講得完整。
    renderPage();
    const text = document.getElementById('delete-account')?.textContent ?? '';
    expect(text, '未說明刪除範圍').toMatch(/行程|收藏/);
    expect(text, '未說明保留與去識別化').toMatch(/去識別化|匿名/);
  });
});

describe('PrivacyPage — 既有使用者的同意沿用', () => {
  it('揭露 2026-07-21 前建立的帳號屬沿用', () => {
    // owner 決策：既有帳號回填同意紀錄。回填本身站得住腳的前提是**有揭露**——
    // 政策沒寫，那筆紀錄就只是一個沒有依據的時間戳。
    // 對應 migration 0090，其 privacy_policy_version 標記為 '-grandfathered'，
    // 讓稽核時分得出誰是實際點過同意、誰是沿用。
    expect(pageText()).toMatch(/沿用|既有帳號|先前建立/);
  });
});

describe('PrivacyPage — 不得出現與程式行為不符的陳述', () => {
  it('不得宣稱資料會逾期自動清除', () => {
    // auth-cleanup.js 無排程。這句是 mockup 草稿的原文，照抄即為不實陳述。
    expect(pageText()).not.toContain('逾期自動清除');
  });

  it('不得寫出未實際執行的保留天數', () => {
    const text = pageText();
    // 這些天數全部來自沒在跑的 auth-cleanup.js。
    for (const claim of ['登入稽核 30 天', '錯誤回報 90 天', 'API 存取紀錄 60 天', 'AI 健檢報告 30 天']) {
      expect(text, `出現了未實際執行的保留期宣稱：「${claim}」`).not.toContain(claim);
    }
  });

  it('不得籠統宣稱 IP 一律雜湊儲存', () => {
    // auth_audit_log 有雜湊，rate_limit_buckets 沒有（明文 IP 當 PK）。
    expect(pageText()).not.toMatch(/IP\s*(位址)?\s*(一律|皆|全部|均)\s*(以)?\s*雜湊/);
  });

  it('保留期的說法對齊 owner 決策：帳號存續期間保留、刪除時去識別化', () => {
    expect(pageText()).toMatch(/帳號存續期間|帳號存在期間|保留至你刪除/);
  });
});
