/**
 * 桌機第三欄 dark-mode elevation — 2026-07-21 追加。
 *
 * Context: coordinator 用 /browse 對 prod 實測發現 .trip-content（中欄內容）先前沒背景，
 * 透明壓在 .app-shell 的深色底色上（PR #1102 已修）。同型問題也適用第三欄 sheet —
 * .app-shell base = --color-background，中欄內容 = --color-secondary，
 * 第三欄應再高一階 = --color-tertiary，三欄才讀得出層次。
 *
 * 驗證：
 *   - AppShell.tsx 的 .app-shell-sheet 有 --color-tertiary base（涵蓋所有 sheet 消費者，
 *     含既有 TripSheet 與 TripStackLayout 的 <Outlet/> 面板）。
 *   - 本次遷入 TripStackLayout 的 3 頁（共編/AI 健檢/行程筆記）各自的 shell class
 *     在 .app-shell-sheet 內有 --color-tertiary override（面板自己不透明背景才不會
 *     蓋掉 base；手機整頁模式不受影響，維持原本 --color-background/-secondary）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP_SHELL = readFileSync(join(__dirname, '../../src/components/shell/AppShell.tsx'), 'utf8');
const COLLAB = readFileSync(join(__dirname, '../../src/pages/CollabPage.tsx'), 'utf8');
const HEALTH = readFileSync(join(__dirname, '../../src/pages/TripHealthCheckPage.tsx'), 'utf8');
const NOTES = readFileSync(join(__dirname, '../../src/pages/TripNotesPage.tsx'), 'utf8');

describe('桌機第三欄 dark-mode elevation（.app-shell-sheet → --color-tertiary）', () => {
  it('AppShell.tsx: .app-shell-sheet 有 --color-tertiary base（涵蓋所有 sheet 消費者）', () => {
    expect(APP_SHELL).toMatch(/\.app-shell-sheet\s*\{\s*background: var\(--color-tertiary\);\s*\}/);
  });

  it('CollabPage: .app-shell-sheet .tp-collab-shell override 為 --color-tertiary', () => {
    expect(COLLAB).toMatch(/\.app-shell-sheet \.tp-collab-shell\s*\{\s*background: var\(--color-tertiary\);\s*\}/);
  });

  it('TripHealthCheckPage: .app-shell-sheet .tp-ai-health-shell override 為 --color-tertiary', () => {
    expect(HEALTH).toMatch(/\.app-shell-sheet \.tp-ai-health-shell\s*\{\s*background: var\(--color-tertiary\);\s*\}/);
  });

  it('TripNotesPage: .app-shell-sheet .tp-notes-shell override 為 --color-tertiary', () => {
    expect(NOTES).toMatch(/\.app-shell-sheet \.tp-notes-shell\s*\{\s*background: var\(--color-tertiary\);\s*\}/);
  });
});
