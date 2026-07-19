/**
 * new-trip-page-smoke.test.tsx — v2.33.48 round 7c test gap fill
 *
 * NewTripPage 932 LOC，onboarding 主流程，之前**零測試**。本 spec 提供
 * smoke + 關鍵 wiring source-grep regression guard — 完整 integration
 * test (full create-trip POST flow) 留 dedicated test PR。
 *
 * 守住：
 *  - 必要 testid render (page mount, form 各 section)
 *  - destination 搜尋 → autocomplete → 加入 destination 流程 wiring
 *  - dateMode toggle (select / flexible)
 *  - 跟 backend 對齊的 POST endpoint (`/trips` POST)
 *  - useRequireAuth + ToastContainer wired
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/NewTripPage.tsx'),
  'utf-8',
);

describe('NewTripPage — wiring smoke (v2.33.48 round 7c)', () => {
  it('default export 是 NewTripPage', () => {
    expect(SRC).toMatch(/export default function NewTripPage\(\)/);
  });

  it('呼 useRequireAuth (auth gate)', () => {
    expect(SRC).toMatch(/useRequireAuth\(\)/);
  });

  it('使用 useNavigate + useNavigateBack', () => {
    expect(SRC).toMatch(/useNavigate\(\)/);
    expect(SRC).toMatch(/useNavigateBack/);
  });

  it('必要 testid present', () => {
    const ids = [
      'new-trip-page',
      'new-trip-destination-input',
      'new-trip-destination-rows',
      'new-trip-dest-dropdown',
      'new-trip-popular-dests',
      'new-trip-date-mode-select',
      'new-trip-date-mode-flexible',
    ];
    for (const id of ids) {
      expect(SRC).toMatch(new RegExp(`data-testid=["']${id}["']`));
    }
  });

  it('POST /trips 是 create-trip endpoint', () => {
    expect(SRC).toMatch(/apiFetchRaw\(['"]\/trips['"]\s*,\s*\{[\s\S]*?method:\s*['"]POST['"]/);
  });

  it('TripDatePicker 用 select mode', () => {
    expect(SRC).toMatch(/<TripDatePicker/);
  });

  it('localStorage recent-dests pattern present', () => {
    expect(SRC).toMatch(/loadRecentDests\(\)/);
    expect(SRC).toMatch(/pushRecentDest/);
  });

  it('dateMode state 含 select + flexible 兩 option', () => {
    expect(SRC).toMatch(/'select'\s*\|\s*'flexible'/);
  });

  it('Sortable destination list wired (dnd-kit + arrayMove)', () => {
    expect(SRC).toMatch(/from\s+['"]@dnd-kit\/sortable['"]/);
    expect(SRC).toMatch(/arrayMove/);
    expect(SRC).toMatch(/SortableContext/);
  });

  it('usePoiSearch wired for destination autocomplete', () => {
    expect(SRC).toMatch(/usePoiSearch\(/);
  });

  it('ToastContainer + AppShell shell 結構正確', () => {
    expect(SRC).toMatch(/<ToastContainer/);
    expect(SRC).toMatch(/<AppShell/);
  });

  it('v2.33.120: titlebar action 拔除，主 CTA 只在 bottom bar (new-trip-submit)', () => {
    // 重複 CTA UX 修正：原本 titlebar 右上 + bottom bar 兩個「建立行程」button，
    // 視覺干擾。bottom bar 為 form context 內主 CTA。
    expect(SRC).not.toMatch(/TitleBarPrimaryAction/);
    expect(SRC).toMatch(/data-testid="new-trip-submit"/);
  });

  it('v2.31.36 migration 0068 dropped fields not present in write payload', () => {
    // selfDrive* and defaultTravelMode columns 已 DROPPED；本 page 不該再
    // 寫這些欄位（CLAUDE.md v2.31.36 + 2.30.0 history）。
    expect(SRC).not.toMatch(/['"]default_travel_mode['"]/);
    expect(SRC).not.toMatch(/['"]self_drive/);
  });

  it('v2.27.0+ trip schema: 不寫 entry_pois_version (caller 角度)', () => {
    // NewTripPage 只建空 trip，不該帶 entry POI / version 欄位
    expect(SRC).not.toMatch(/entry_pois_version/);
  });

  it('G-H3: dirty 表單攔截 — dirty 檢查 + handleBackGuarded 包 back/取消 + discard ConfirmModal + beforeunload', () => {
    // 填了東西又按取消/返回 → 先確認再捨棄，避免丟輸入。
    expect(SRC).toMatch(/const dirty =/);
    expect(SRC).toMatch(/handleBackGuarded/);
    // TitleBar back 與 bottom bar 取消都走 guarded handler，不直接 handleBack
    expect(SRC).toMatch(/back=\{handleBackGuarded\}/);
    expect(SRC).toMatch(/onClick=\{handleBackGuarded\}/);
    expect(SRC).toMatch(/<ConfirmModal/);
    expect(SRC).toMatch(/beforeunload/);
  });
});
