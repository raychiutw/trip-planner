// @vitest-environment node
/**
 * 行程 ID 產生規則 — 單一來源
 *
 * 問題（2026-07-21，owner 發現 demo 行程編號不合慣例）：
 *   建立行程走前端 `NewTripPage.genTripId()` → `台北` → `trip-bp5o`；
 *   匯入行程走後端 `import.ts` 自己寫死 `imp-${crypto.randomUUID()}`
 *   → `imp-62a83969-2dd2-47f3-bbb6-2fe549455081`。兩條路徑各寫各的，
 *   同一個系統長出兩種 ID 慣例，URL 也從 9 字元變 40 字元。
 *
 * 修法是把產生器抽成共用模組，兩邊都 import。
 *
 * ⚠ 但不能直接把後端換成前端那份 —— 前端後綴是
 *   `Date.now().toString(36).slice(-4)`，同毫秒內產生兩個就一模一樣。
 *   前端一次只建一個行程所以沒事；後端匯入沒有 `SELECT 1 FROM trips WHERE id`
 *   的重複檢查（`POST /api/trips` 有），撞到只會噴 raw D1 UNIQUE 錯誤。
 *   原本的完整 UUID 是碰撞安全的，換成 4 碼時間後綴等於把可靠性換掉。
 *   所以共用版改用 crypto 亂數後綴：可讀性照前端慣例，碰撞安全照後端需求。
 */
import { describe, it, expect } from 'vitest';
import { slugify, genTripId, TRIP_ID_MAX_LEN } from '../../src/lib/tripId';

describe('slugify', () => {
  it('英數字轉小寫連字號', () => {
    expect(slugify('Okinawa Road Trip')).toBe('okinawa-road-trip');
  });

  it('去除變音符號', () => {
    expect(slugify('Café Tour')).toBe('cafe-tour');
  });

  it('純中文名會被濾空 → fallback「trip」（prod 現況就是這樣長出 trip-xxxx）', () => {
    expect(slugify('台北')).toBe('trip');
    expect(slugify('東京')).toBe('trip');
  });

  it('不留頭尾連字號', () => {
    expect(slugify('  ---Tokyo---  ')).toBe('tokyo');
    expect(slugify('沖繩 3 天自駕範例')).not.toMatch(/^-|-$/);
  });

  it('只輸出 a-z0-9 與連字號', () => {
    expect(slugify('Ōsaka／大阪 #2!!')).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('genTripId', () => {
  it('中文行程名產生 trip-xxxxxx，對齊 prod 既有慣例', () => {
    expect(genTripId('台北')).toMatch(/^trip-[a-z0-9]+$/);
  });

  it('英文行程名保留可讀前綴', () => {
    expect(genTripId('Okinawa Road Trip')).toMatch(/^okinawa-road-trip-[a-z0-9]+$/);
  });

  it('後綴不是時間戳 —— 連續呼叫必須不同（碰撞安全）', () => {
    // 這條是整個重構的重點。前端版在同一毫秒內會回傳一模一樣的字串，
    // 後端匯入沒有重複檢查，撞上就是 D1 UNIQUE 例外。
    const ids = new Set(Array.from({ length: 200 }, () => genTripId('台北')));
    expect(ids.size, '同名連續產生出現重複 ID').toBe(200);
  });

  it('長名稱截斷在上限內', () => {
    const id = genTripId('a'.repeat(300));
    expect(id.length).toBeLessThanOrEqual(TRIP_ID_MAX_LEN);
  });

  it('截斷後仍不以連字號結尾（URL 尾巴掛 - 很醜也易誤複製）', () => {
    const id = genTripId('a'.repeat(TRIP_ID_MAX_LEN - 2));
    expect(id).not.toMatch(/-$/);
  });

  it('永遠是合法的 URL path segment', () => {
    for (const name of ['台北', 'Okinawa', '沖繩 3 天自駕範例', '!!!', '']) {
      expect(genTripId(name), `「${name}」產生了不合法的 id`).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    }
  });
});

describe('匯入路徑使用共用產生器', () => {
  it('import.ts 不再自己寫死 imp- 前綴', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const src = readFileSync(resolve(__dirname, '../../functions/api/trips/import.ts'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/`imp-\$\{/);
    // 走 `generateUniqueTripId`（_tripWrite 的包裝，內部呼叫 genTripId 並確保未撞號），
    // 而不是直接呼叫 genTripId —— 匯入路徑原本沒有唯一性檢查，撞號會噴 raw D1 UNIQUE。
    expect(src, 'import 應改用共用產生器').toMatch(/generateUniqueTripId\(/);
  });

  it('NewTripPage 不再保留自己那份複製', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const src = readFileSync(resolve(__dirname, '../../src/pages/NewTripPage.tsx'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src, '本地 slugify 應已移除').not.toMatch(/function slugify\(/);
    expect(src, '本地 genTripId 應已移除').not.toMatch(/function genTripId\(/);
  });
});
