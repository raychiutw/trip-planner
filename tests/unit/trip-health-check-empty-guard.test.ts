// @vitest-environment node
/**
 * v2.31.58 empty trip AI 健檢 guard — 三層保護：
 *
 * 1. Backend `POST /api/trips/:id/health-check` 在 hasWritePermission 後
 *    SELECT COUNT(*) FROM trip_entries 檢查 entry 數，0 → throw
 *    `TRIP_EMPTY` AppError（HTTP 422）。
 * 2. Frontend `TripHealthCheckPage` fetch /trips/:id/days?all=1 累加跨天
 *    entry 數存進 `entryCount` state；button disable 條件加 `entryCount === 0`，
 *    + 顯示 hint「此行程尚無景點，請先加入景點再執行健檢」。
 * 3. 新 error code `TRIP_EMPTY` 加進 ErrorCode + STATUS_MAP + ERROR_MESSAGES。
 *
 * Bug source：prod QA 發現 empty trip（trip-rgp1 台南，5 天空白）⋯ menu →
 * AI 健檢 仍可點，浪費 Claude quota + 給 user 沒用的 findings。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const BACKEND = readFileSync(path.join(ROOT, 'functions/api/trips/[id]/health-check.ts'), 'utf8');
const FRONTEND = readFileSync(path.join(ROOT, 'src/pages/TripHealthCheckPage.tsx'), 'utf8');
const ERRORS_TS = readFileSync(path.join(ROOT, 'functions/api/_errors.ts'), 'utf8');
const API_TYPES = readFileSync(path.join(ROOT, 'src/types/api.ts'), 'utf8');

describe('v2.31.58 empty trip AI 健檢 guard', () => {
  describe('Backend POST handler', () => {
    it('hasWritePermission 後 SELECT COUNT(*) FROM trip_entries JOIN trip_days 檢查', () => {
      // trip_entries 沒 trip_id 欄位，JOIN trip_days 才能 WHERE d.trip_id = ?
      expect(BACKEND).toMatch(/SELECT COUNT\(\*\) as cnt FROM trip_entries e/);
      expect(BACKEND).toMatch(/JOIN trip_days d ON e\.day_id = d\.id/);
      expect(BACKEND).toMatch(/WHERE d\.trip_id = \?/);
    });

    it('entry count === 0 throw TRIP_EMPTY AppError', () => {
      expect(BACKEND).toMatch(/throw new AppError\(\s*['"]TRIP_EMPTY['"]\s*\)/);
    });

    it('guard 放在 hasWritePermission 之後、UPSERT 之前（避免污染 DB）', () => {
      const writePermIdx = BACKEND.indexOf('hasWritePermission(env.DB');
      const guardIdx = BACKEND.indexOf('TRIP_EMPTY');
      const upsertIdx = BACKEND.indexOf('INSERT INTO trip_health_reports');
      expect(writePermIdx).toBeGreaterThan(0);
      expect(guardIdx).toBeGreaterThan(writePermIdx);
      expect(upsertIdx).toBeGreaterThan(guardIdx);
    });
  });

  describe('Frontend disable + hint', () => {
    it('useState 加 entryCount state', () => {
      expect(FRONTEND).toMatch(/const \[entryCount, setEntryCount\] = useState<number \| null>\(null\)/);
    });

    it('fetch /trips/:id/days?all=1 並累加 timeline length 算 entry count', () => {
      expect(FRONTEND).toMatch(/\/trips\/\$\{encodeURIComponent\(tripId\)\}\/days\?all=1/);
      expect(FRONTEND).toMatch(/d\.timeline\) \? d\.timeline\.length : 0/);
    });

    it('button disabled 條件加 entryCount === 0', () => {
      expect(FRONTEND).toMatch(/disabled=\{submitting \|\| isPending \|\| entryCount === 0\}/);
    });

    it('entryCount === 0 顯示 hint 取代 button 文案', () => {
      expect(FRONTEND).toMatch(/此行程尚無景點，請先加入景點再執行健檢/);
      expect(FRONTEND).toMatch(/data-testid="ai-health-empty-hint"/);
    });
  });

  describe('Error code definitions', () => {
    it('ErrorCode 加 TRIP_EMPTY', () => {
      expect(API_TYPES).toMatch(/TRIP_EMPTY: 'TRIP_EMPTY'/);
    });

    it('ERROR_MESSAGES 加中文描述', () => {
      expect(API_TYPES).toMatch(/TRIP_EMPTY: '此行程尚無景點，請先加入景點再執行健檢'/);
    });

    it('STATUS_MAP 設 422（unprocessable entity — semantic 比 400 / 409 準）', () => {
      expect(ERRORS_TS).toMatch(/TRIP_EMPTY: 422/);
    });
  });
});
