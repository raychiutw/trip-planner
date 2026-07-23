/**
 * W7 搜尋 inline scoped（HIG spec §7）— source-lock guard。
 *
 * 規範：page-level 搜尋只出現在「清單/收藏內容頂」與「加 POI 的 scoped task」內；**地圖 /
 * 聊天 / 帳號 / Day** 不顯 page-level 搜尋。現況已合規（無違規），本 guard 鎖住現況，防未來
 * 有人在這些頁加上 page-level search UI 而破壞 scoped-search 語意。
 *
 * 判定：source 內是否含 `type="search"` 或 aria-label 含「搜尋」的搜尋輸入標記。ChatPage 的
 * composer 是 textarea（非 search、無「搜尋」label），不會誤判。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function src(rel: string): string {
  return readFileSync(join(__dirname, '../../src', rel), 'utf8');
}

// page-level 搜尋 UI 標記：type="search" 或 aria-label 含「搜尋」。
const SEARCH_UI = /type=["']search["']|aria-label=["'][^"']*搜尋/;

describe('W7 — page-level 搜尋不該出現在地圖/聊天/帳號/Day', () => {
  const DISALLOWED: Array<[string, string]> = [
    ['地圖', 'pages/MapPage.tsx'],
    ['全域地圖', 'pages/GlobalMapPage.tsx'],
    ['聊天', 'pages/ChatPage.tsx'],
    ['帳號', 'pages/AccountPage.tsx'],
    ['帳號 sheet', 'components/shell/AccountSheet.tsx'],
  ];

  it.each(DISALLOWED)('%s 頁不含 page-level 搜尋 UI', (_label, rel) => {
    expect(src(rel), `${rel} 不應有 page-level 搜尋（scoped search 只在清單/加 POI 流程）`).not.toMatch(SEARCH_UI);
  });
});

describe('W7 — scoped 搜尋允許範圍（清單頁 + 加 POI scoped task）', () => {
  // 允許有搜尋的頁（不斷言必有，只確保這些檔存在、記錄合法範圍；避免上面 disallowed 誤擴張到
  // scoped-task 頁）。
  const ALLOWED = [
    'pages/TripsListPage.tsx',
    'pages/PoiFavoritesPage.tsx',
    'pages/AddStopPage.tsx',
    'pages/ExplorePage.tsx',
    'pages/ChangePoiPage.tsx',
    'pages/AddEntryPage.tsx',
    'pages/EditEntryPage.tsx',
  ];

  it('允許清單的頁面皆存在（防清單漂移）', () => {
    for (const rel of ALLOWED) {
      expect(() => src(rel), `${rel} 應存在於允許清單`).not.toThrow();
    }
  });
});
