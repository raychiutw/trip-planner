/**
 * 行程卡 ⋮ menu dropUp：靠列表底部的卡 menu 往下展開會被 bottom nav 遮，改往上展開。
 * clone 名稱與標題由 share-clone-lifecycle.integration.test.ts 的 HTTP + D1 測試保護。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../', p), 'utf8');

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
