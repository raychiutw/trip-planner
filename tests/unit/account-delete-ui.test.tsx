/**
 * 帳號頁 — 刪除帳號入口與確認流程
 *
 * Google Play 對「可建立帳號的 app」**強制要求**帳號刪除路徑（app 內 + 網頁各一條）。
 *
 * 這個流程最重要的不是「能刪」，是**按下去之前使用者知道會發生什麼**：
 * owner 決策為「擁有的行程一併刪除，含共編者的」，所以確認畫面必須顯示
 * 受影響的行程數與共編人數 —— 那兩個數字前端算不出來，由 GET /api/account 提供。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../');
const accountPage = readFileSync(resolve(ROOT, 'src/pages/AccountPage.tsx'), 'utf-8');
const confirmModal = readFileSync(resolve(ROOT, 'src/components/shared/ConfirmModal.tsx'), 'utf-8');

/** 剝掉註解 —— 解釋用的散文不該滿足「必須存在 X」的斷言。 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const page = strip(accountPage);

describe('ConfirmModal — 支援自訂內容 slot', () => {
  it('接受 children，讓破壞性操作可放輸入欄位（密碼 / 確認字串）', () => {
    // 不另造一個 modal：既有 ConfirmModal 已處理焦點鎖定、Esc、a11y。
    expect(strip(confirmModal)).toMatch(/children\??:\s*ReactNode/);
  });
});

describe('帳號頁 — 刪除入口', () => {
  it('有刪除帳號的 row，且標為 danger', () => {
    expect(page).toMatch(/key:\s*'delete-account'/);
    expect(page).toMatch(/key:\s*'delete-account'[\s\S]{0,400}?danger:\s*true/);
  });

  it('入口有 testid 供 e2e / 客服指引定位', () => {
    expect(page).toMatch(/account-row-delete-account|data-testid=\{`account-row-\$\{row\.key\}`\}/);
  });
});

describe('帳號頁 — 確認流程必須誠實揭露影響', () => {
  it('開啟確認前先取 GET /api/account 預覽', () => {
    expect(page).toMatch(/apiFetch[^\n]*['"`]\/account['"`]|apiFetch\(\s*['"`]\/account['"`]/);
  });

  it('確認畫面顯示會被刪除的行程數', () => {
    expect(page).toMatch(/tripsOwned/);
  });

  it('確認畫面顯示受影響的共編人數（owner 決策是一併刪除，這點不能藏）', () => {
    expect(page).toMatch(/collaboratorsAffected/);
  });

  it('依帳號型態切換：有密碼要輸入密碼，純 OAuth 要輸入確認字串', () => {
    expect(page).toMatch(/hasPassword/);
  });

  it('確認按鈕在未滿足確認條件前為 disabled（避免誤觸不可逆操作）', () => {
    expect(page).toMatch(/canConfirmDelete|deleteConfirmReady/);
  });
});

describe('帳號頁 — 隱私權政策入口', () => {
  it('有隱私權政策 row，連到 /privacy', () => {
    // Google Play 要求 app 內可直接取得隱私權政策，不能只放在網站頁尾。
    expect(page).toMatch(/key:\s*'privacy'/);
    expect(page).toMatch(/key:\s*'privacy'[\s\S]{0,300}?to:\s*'\/privacy'/);
  });

  it('不是 danger（那是資訊性連結，不是破壞性操作）', () => {
    const row = page.match(/\{\s*key:\s*'privacy'[^}]*\}/)?.[0] ?? '';
    expect(row).not.toMatch(/danger:\s*true/);
  });
});

describe('帳號頁 — 刪除送出', () => {
  it('用 DELETE 打 /account', () => {
    expect(page).toMatch(/method:\s*['"]DELETE['"]/);
  });

  it('成功後導離帳號頁（帳號已不存在，不能留在原頁）', () => {
    expect(page).toMatch(/deleteAccount[\s\S]{0,900}?(navigate|location\.(href|assign|replace))/);
  });
});
