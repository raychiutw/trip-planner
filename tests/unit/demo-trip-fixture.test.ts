// @vitest-environment node
/**
 * Google Play 審核用 demo 行程 fixture 的正確性
 *
 * 背景：④ 送審需要一個 demo 帳號（owner 指定 demo@demo.com / demo1234）與一份
 * 預載的範例行程。prod 的 `CLOUDFLARE_API_TOKEN` 已失效 → 無法用
 * `wrangler d1 execute --remote` 直接寫入，所以改走**既有的匯入 API**
 * （POST /api/trips/import），只需要一個登入 session、不需要 API token。
 *
 * 這支測試的意義：fixture 是手寫的 JSON，schema 卻藏在 `_import.ts` 的
 * allowlist 裡。與其靠我讀 validator 反推格式（讀錯了要到 prod 匯入才炸），
 * 不如**讓真正的 validator 當裁判** —— 直接餵給 parseAndValidateImport。
 * validator 之後若改欄位，這支會紅，fixture 不會默默失效。
 *
 * 另外鎖住「這是一份像樣的 demo」：審核員看到空殼行程會質疑 app 是否可用，
 * 所以斷言天數／景點／座標／備註都有內容，而不只是 schema 合法。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseAndValidateImport } from '../../functions/api/trips/_import';

const FIXTURE_PATH = resolve(__dirname, '../../docs/demo/demo-trip.json');

function loadFixture(): unknown {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8'));
}

describe('demo 行程 fixture — 通過正式匯入 validator', () => {
  it('parseAndValidateImport 接受這份 fixture', () => {
    const result = parseAndValidateImport(loadFixture());
    // 失敗時把 validator 的中文錯誤訊息帶出來，否則只看到 false 很難修。
    expect(result.ok ? null : result.error).toBeNull();
  });

  it('normalize 後仍保有行程名稱與目的地', () => {
    const result = parseAndValidateImport(loadFixture());
    if (!result.ok) throw new Error(result.error);
    expect(result.data.name).toBeTruthy();
    expect(result.data.destinations.length).toBeGreaterThan(0);
  });
});

describe('demo 行程 fixture — 內容足以展示 app', () => {
  it('至少 3 天，每天都有景點', () => {
    const result = parseAndValidateImport(loadFixture());
    if (!result.ok) throw new Error(result.error);
    expect(result.data.days.length).toBeGreaterThanOrEqual(3);
    for (const day of result.data.days) {
      expect(day.entries.length, `Day ${day.dayNum} 沒有任何景點`).toBeGreaterThan(0);
    }
  });

  it('每個景點都有座標 —— 地圖頁是主打功能，沒座標就是空白地圖', () => {
    const result = parseAndValidateImport(loadFixture());
    if (!result.ok) throw new Error(result.error);
    for (const day of result.data.days) {
      for (const entry of day.entries) {
        const master = entry.pois[0];
        expect(master, `Day ${day.dayNum} 有 entry 沒掛 POI`).toBeTruthy();
        expect(master!.lat, `${master!.name} 缺 lat`).not.toBeNull();
        expect(master!.lng, `${master!.name} 缺 lng`).not.toBeNull();
      }
    }
  });

  it('有交通段 —— 自駕動線是時間軸的一部分', () => {
    const result = parseAndValidateImport(loadFixture());
    if (!result.ok) throw new Error(result.error);
    expect(result.data.segments.length).toBeGreaterThan(0);
  });

  it('有行前須知與緊急聯絡 —— 展示 AI 行程筆記區塊', () => {
    const result = parseAndValidateImport(loadFixture());
    if (!result.ok) throw new Error(result.error);
    expect(result.data.notes.pretripNotes.length).toBeGreaterThan(0);
    expect(result.data.notes.emergencyContacts.length).toBeGreaterThan(0);
  });

  it('每天都有住宿（最後一天除外，當天離境）', () => {
    const result = parseAndValidateImport(loadFixture());
    if (!result.ok) throw new Error(result.error);
    const nights = result.data.days.slice(0, -1);
    for (const day of nights) {
      expect(day.hotel, `Day ${day.dayNum} 沒有住宿`).not.toBeNull();
    }
  });
});

describe('demo 行程 fixture — 不得含真人個資', () => {
  it('緊急聯絡只放公開單位，不得出現私人 email', () => {
    // demo 資料會進 prod、被 Google 審核員看到，混進真人聯絡方式就是外洩。
    const raw = readFileSync(FIXTURE_PATH, 'utf-8');
    expect(raw).not.toMatch(/[\w.+-]+@(?!example\.com)[\w-]+\.[\w.]+/);
  });
});
