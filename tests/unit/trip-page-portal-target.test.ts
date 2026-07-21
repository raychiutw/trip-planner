/**
 * TripPage — usePortalMain / portalNode props（owner 2026-07-21 回報 #2 修復）。
 *
 * 第一版用 portalTargetId（字串 id）+ document.getElementById + useEffect 依
 * location.pathname 重查 —— playwright e2e 實測抓到 race（TripPage 的 effect
 * 觸發時新 host 的 placeholder 有時還沒 mount，撲空後永遠不會重試，中欄整個
 * 空白）。改為 push-based：呼叫端（TripPageHost）透過 TripMainPortalContext
 * 拿到 host placeholder 的 callback ref 結果（portalNode），直接當 prop 傳給
 * TripPage，不再自己查詢 DOM。
 *
 * Pure source-grep — 同檔案其餘測試（trip-page-focus-id.test.tsx 等）都是這個
 * 慣例，TripPage 依賴太重不 full mount。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/TripPage.tsx'),
  'utf-8',
);

describe('TripPage — usePortalMain / portalNode props（owner 回報 #2）', () => {
  it('TripPageProps 加 usePortalMain?: boolean 與 portalNode?: Element | null', () => {
    expect(SRC).toMatch(/interface TripPageProps\s*\{[\s\S]{0,1500}usePortalMain\?:\s*boolean/);
    expect(SRC).toMatch(/interface TripPageProps\s*\{[\s\S]{0,1500}portalNode\?:\s*Element \| null/);
  });

  it('不再用 document.getElementById 查詢 portal target（pull-based 已移除，改吃 prop）', () => {
    expect(SRC).not.toMatch(/document\.getElementById\(portalTargetId\)/);
  });

  it('usePortalMain 時走 createPortal 到 portalNode，portalNode 暫時為 null 就不 render（避免內容出現在錯的地方）', () => {
    expect(SRC).toMatch(/usePortalMain && portalNode \? createPortal\(wrappedMain, portalNode\) : null/);
  });

  it('沒有 usePortalMain（既有呼叫端，如 TripsListPage 手機分支）維持原本 inline render，不受影響', () => {
    expect(SRC).toMatch(/!usePortalMain && wrappedMain/);
  });
});
