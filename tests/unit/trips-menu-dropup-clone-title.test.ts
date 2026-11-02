/**
 * 兩個 QA fix 的 source-grep contract：
 *  1. 複製行程（share clone）的顯示標題（title || name）後綴「-複製」。
 *  2. 行程卡 ⋮ menu dropUp — 靠列表底部的卡 menu 往下展開會被 bottom nav 遮，改往上展開。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../', p), 'utf8');

describe('複製行程 title 後綴「-複製」（QA）', () => {
  const src = read('functions/api/share/[token]/clone.ts');

  it('clone INSERT：name 後綴「-複製」', () => {
    expect(src).toMatch(/`\$\{trip\.name \?\? '未命名行程'\}-複製`/);
  });

  it('clone INSERT：title 有值後綴「-複製」，空則 null（顯示 title || name 一定帶 -複製）', () => {
    expect(src).toMatch(/trip\.title \? `\$\{trip\.title\}-複製` : null/);
  });
});

describe('行程卡 ⋮ menu dropUp（選單被遮修復，QA）', () => {
  // v2.57.x: 這組 dropUp/BOTTOM_SAFE_AREA 邏輯屬於行程詳情頁右上角「⋯」動作選單
  // （原 TripsListPage 的 EmbeddedActionMenu），已抽到共用元件 TripActionsMenu.tsx
  // （供 TripStackLayout 共用）。
  const src = read('src/components/trip/TripActionsMenu.tsx');

  it('recompute 有 dropUp 邏輯（下方空間被 bottom nav 遮 → 往上展開）', () => {
    expect(src).toMatch(/const dropUp =/);
    expect(src).toMatch(/below \+ menuH > vh - BOTTOM_SAFE_AREA/);
    expect(src).toMatch(/dropUp \? r\.top - menuH - 6 : below/);
  });

  it('BOTTOM_SAFE_AREA 常數存在（避開 GlobalBottomNav + safe area）', () => {
    expect(src).toMatch(/const BOTTOM_SAFE_AREA = \d+/);
  });
});
