/**
 * DesktopSidebarConnected name fallback chain — regression for v2.33.121.
 *
 * Bug context: prod QA (rayschiu@fetci.com 帳號 display_name=null) 在 sidebar 顯
 * 「rayschiu@f...」(整 email truncated)，但 /account hero 顯「rayschiu」(local-part)。
 *
 * Root cause: 3 處有 displayName fallback chain，sidebar 用 `?? email` (只 2 層)，
 * AccountPage / ChatPage 用 `|| email.split('@')[0] || email` (3 層)。Sidebar 後來沒
 * 同步成 canonical 3-層 pattern。
 *
 * Fix: sidebar 對齊 AccountPage canonical pattern。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '../../src/components/shell/DesktopSidebarConnected.tsx'),
  'utf8',
);

describe('DesktopSidebarConnected v2.33.121 name fallback (regression)', () => {
  it('name 用 3-層 fallback chain：displayName ?? email.split(@)[0] ?? email', () => {
    expect(SRC).toMatch(/displayName \?\? user\.email\.split\(['"]@['"]\)\[0\] \?\? user\.email/);
  });

  it('不再是舊 2-層 `?? email`', () => {
    expect(SRC).not.toMatch(/name: user\.displayName \?\? user\.email,$/m);
  });
});

describe('name fallback chain sample logic (alignment with AccountPage / ChatPage)', () => {
  // 模擬 sidebar 新 fallback
  const sidebarName = (displayName: string | null, email: string) =>
    displayName ?? email.split('@')[0] ?? email;

  // 模擬 AccountPage:215 canonical
  const accountName = (displayName: string | null, email: string) =>
    displayName || email.split('@')[0] || email;

  it.each([
    // [displayName, email, expected]
    ['Ray', 'lean.lean@gmail.com', 'Ray'],
    [null, 'rayschiu@fetci.com', 'rayschiu'],
    [null, 'foo@bar.com', 'foo'],
    [null, '', ''], // edge: empty email → '' (?? falls through, || would too)
  ])('displayName=%s email=%s → %s', (dn, email, expected) => {
    expect(sidebarName(dn, email)).toBe(expected);
    expect(accountName(dn, email)).toBe(expected);
  });
});
