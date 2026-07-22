/**
 * 桌機第三欄 dark-mode elevation — 2026-07-21 追加，2026-07-21 第二輪補齊既有 6 面板。
 *
 * Context: coordinator 用 /browse 對 prod 實測發現 .trip-content（中欄內容）先前沒背景，
 * 透明壓在 .app-shell 的深色底色上（PR #1102 已修）。同型問題也適用第三欄 sheet —
 * .app-shell base = --color-background，中欄內容 = --color-secondary，
 * 第三欄應再高一階 = --color-tertiary，三欄才讀得出層次。
 *
 * 驗證：
 *   - AppShell.tsx 的 .app-shell-sheet 有 --color-tertiary base（涵蓋所有 sheet 消費者，
 *     含既有 TripSheet 與 TripStackLayout 的 <Outlet/> 面板）。
 *   - 2026-07-21 v2.57.10 遷入 TripStackLayout 的 3 頁（共編/AI 健檢/行程筆記）各自的
 *     shell class 在 .app-shell-sheet 內有 --color-tertiary override。
 *   - owner 這輪回報 #5：原本「6 條全接」（2026-07-18）的 6 個操作面板
 *     （編輯行程/加景點/新增景點/複製移動/換景點/編輯 entry）當時沒套這層 override，
 *     跟新遷入的 3 頁不一致。這裡補齊其中 5 個有自訂 shell 背景的頁面
 *     （EditEntryPage 的 shellClassName="tp-app" 沒有任何背景規則，本來就會透出
 *     .app-shell-sheet 的 base tertiary，不需 override，故不在此列）。
 *     面板自己不透明背景才不會蓋掉 base；手機整頁模式不受影響，維持原本
 *     --color-background/-secondary。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP_SHELL = readFileSync(join(__dirname, '../../src/components/shell/AppShell.tsx'), 'utf8');
const COLLAB = readFileSync(join(__dirname, '../../src/pages/CollabPage.tsx'), 'utf8');
const HEALTH = readFileSync(join(__dirname, '../../src/pages/TripHealthCheckPage.tsx'), 'utf8');
const NOTES = readFileSync(join(__dirname, '../../src/pages/TripNotesPage.tsx'), 'utf8');
const EDIT_TRIP = readFileSync(join(__dirname, '../../src/pages/EditTripPage.tsx'), 'utf8');
const ADD_STOP = readFileSync(join(__dirname, '../../src/pages/AddStopPage.tsx'), 'utf8');
const ADD_ENTRY = readFileSync(join(__dirname, '../../src/pages/AddEntryPage.tsx'), 'utf8');
const ENTRY_ACTION = readFileSync(join(__dirname, '../../src/pages/EntryActionPage.tsx'), 'utf8');
const CHANGE_POI = readFileSync(join(__dirname, '../../src/pages/ChangePoiPage.tsx'), 'utf8');

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

describe('owner 回報 #5：既有 6 個操作面板補齊 tertiary elevation（跟新 3 面板一致）', () => {
  it('EditTripPage: .app-shell-sheet .tp-edit-page-shell override 為 --color-tertiary', () => {
    expect(EDIT_TRIP).toMatch(/\.app-shell-sheet \.tp-edit-page-shell\s*\{\s*background: var\(--color-tertiary\);\s*\}/);
  });

  it('AddStopPage: .app-shell-sheet .tp-add-stop-page-shell override 為 --color-tertiary', () => {
    expect(ADD_STOP).toMatch(/\.app-shell-sheet \.tp-add-stop-page-shell\s*\{\s*background: var\(--color-tertiary\);\s*\}/);
  });

  it('AddEntryPage: .app-shell-sheet .tp-add-entry-shell override 為 --color-tertiary', () => {
    expect(ADD_ENTRY).toMatch(/\.app-shell-sheet \.tp-add-entry-shell\s*\{\s*background: var\(--color-tertiary\);\s*\}/);
  });

  it('EntryActionPage（複製/移動共用）: .app-shell-sheet .tp-entry-action-shell override 為 --color-tertiary', () => {
    expect(ENTRY_ACTION).toMatch(/\.app-shell-sheet \.tp-entry-action-shell\s*\{\s*background: var\(--color-tertiary\);\s*\}/);
  });

  it('ChangePoiPage: .app-shell-sheet .tp-change-poi-page-shell override 為 --color-tertiary', () => {
    expect(CHANGE_POI).toMatch(/\.app-shell-sheet \.tp-change-poi-page-shell\s*\{\s*background: var\(--color-tertiary\);\s*\}/);
  });
});
