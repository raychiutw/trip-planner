/**
 * AddStopPage day picker chip row — v2.31.99 source-grep contract.
 *
 * 入口從「TripsListPage 探索 icon → /explore」改成「+ 新增景點 → /add-stop」
 * （無 ?day=N param）。AddStopPage 自己在頁面上方 render chip row 讓 user 選
 * 一天再 submit。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ADD_STOP_SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/AddStopPage.tsx'),
  'utf8',
);

const TRIPS_LIST_SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/TripsListPage.tsx'),
  'utf8',
);

describe('TripsListPage — trip header「新增景點」入口取代探索 icon', () => {
  it('既有 trip-explore-trigger testid 已移除', () => {
    expect(TRIPS_LIST_SRC).not.toContain('trip-explore-trigger');
  });

  it('新增 trip-add-stop-trigger button navigate 到 /trip/:id/add-entry（v2.32.0 改 /add-entry）', () => {
    expect(TRIPS_LIST_SRC).toContain('trip-add-stop-trigger');
    expect(TRIPS_LIST_SRC).toMatch(/navigate\(`\/trip\/\$\{encodeURIComponent\(effectiveSelectedId\)\}\/add-entry`\)/);
  });

  it('button 用 plus icon + 新增景點 label', () => {
    const idx = TRIPS_LIST_SRC.indexOf('trip-add-stop-trigger');
    expect(idx).toBeGreaterThan(0);
    const ctx = TRIPS_LIST_SRC.slice(Math.max(0, idx - 400), idx + 200);
    expect(ctx).toContain('name="plus"');
    expect(ctx).toContain('新增景點');
  });
});

describe('AddStopPage — v2.31.99 day picker chip row', () => {
  it('useSearchParams 解構 setSearchParams（v2.31.99 day 切換需 mutate URL）', () => {
    expect(ADD_STOP_SRC).toMatch(/const \[searchParams, setSearchParams\] = useSearchParams\(\)/);
  });

  it('載入所有 days 進 allDays state（不再只 setCurrentDay）', () => {
    expect(ADD_STOP_SRC).toMatch(/setAllDays\(/);
    expect(ADD_STOP_SRC).toMatch(/const \[allDays, setAllDays\]/);
  });

  it('currentDay 改 useMemo 從 allDays 衍生（單一 truth）', () => {
    expect(ADD_STOP_SRC).toMatch(/const currentDay = useMemo[\s\S]{0,150}allDays\.find/);
  });

  it('handlePickDay setSearchParams replace 切換 day', () => {
    expect(ADD_STOP_SRC).toMatch(/const handlePickDay = useCallback\(/);
    expect(ADD_STOP_SRC).toMatch(/sp\.set\('day',\s*String\(next\)\)/);
    expect(ADD_STOP_SRC).toMatch(/setSearchParams\(sp,\s*\{\s*replace:\s*true\s*\}\)/);
  });

  it('hasDay flag = Number.isFinite(dayNum) 用於 submit gate + UI render', () => {
    expect(ADD_STOP_SRC).toMatch(/const hasDay = Number\.isFinite\(dayNum\)/);
    expect(ADD_STOP_SRC).toMatch(/const confirmEnabled = hasDay/);
  });

  it('day picker chip row 用 testid + 每個 day chip 有 testid', () => {
    expect(ADD_STOP_SRC).toContain('data-testid="add-stop-daypicker"');
    expect(ADD_STOP_SRC).toMatch(/data-testid=\{`add-stop-daypicker-chip-\$\{d\.dayNum\}`\}/);
  });

  it('no-day fallback render 顯「請先選擇加入哪天」counter', () => {
    expect(ADD_STOP_SRC).toContain('請先選擇加入哪天');
  });

  it('tripId 仍必填（dayNum 改 optional）— 沒 tripId 才顯 invalid blocking page', () => {
    expect(ADD_STOP_SRC).toMatch(/if \(!tripId\) \{[\s\S]{0,800}無效的行程/);
    // 確認 dayNum 不再是 blocking (原 v2.31.94 之前有 `!tripId || !Number.isFinite(dayNum)` 整個 page block)
    expect(ADD_STOP_SRC).not.toMatch(/^\s*if \(!tripId \|\| !Number\.isFinite\(dayNum\)\) \{$/m);
  });

  it('day picker chip active state 對齊 selected day', () => {
    expect(ADD_STOP_SRC).toMatch(/d\.dayNum === dayNum/);
    expect(ADD_STOP_SRC).toMatch(/className=\{`tp-add-stop-daypicker-chip \$\{isActive \? 'is-active' : ''\}`\}/);
  });
});
