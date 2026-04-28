// @vitest-environment node
/**
 * mockup-parity-qa-fixes Sprint 10.3: TripsListPage cardMeta 出發日格式 + camelCase
 * fix 不被 regression。
 *
 * Pure-text grep on source 避免 jsdom + React 18 + vi.* API 不相容問題。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/TripsListPage.tsx'),
  'utf8'
);

describe('mockup-parity-qa-fixes TripsListPage card meta + filter', () => {
  it('TripInfo interface 用 camelCase 對齊 API deepCamel response', () => {
    expect(SRC).toMatch(/dayCount\?:\s*number/);
    expect(SRC).toMatch(/startDate\?:\s*string\s*\|\s*null/);
    expect(SRC).toMatch(/memberCount\?:\s*number/);
    expect(SRC).toMatch(/archivedAt\?:\s*string\s*\|\s*null/);
    // 既有 snake_case 不應該存在於 TripInfo 介面內
    const interfaceMatch = SRC.match(/interface TripInfo \{[\s\S]*?\n\}/);
    expect(interfaceMatch).not.toBeNull();
    expect(interfaceMatch?.[0]).not.toMatch(/day_count\?:/);
    expect(interfaceMatch?.[0]).not.toMatch(/start_date\?:/);
    expect(interfaceMatch?.[0]).not.toMatch(/member_count\?:/);
  });

  it('startDateMD helper 產生「7/2 出發」格式（mockup section 16:6908）', () => {
    expect(SRC).toMatch(/function startDateMD/);
    expect(SRC).toMatch(/parseInt\(m\[2\]!,\s*10\)/);
    expect(SRC).toMatch(/parseInt\(m\[3\]!,\s*10\)/);
    expect(SRC).toMatch(/出發/);
  });

  it('cardMeta 用 camelCase 欄位 startDate / endDate / memberCount', () => {
    const cardMetaMatch = SRC.match(/function cardMeta[\s\S]*?\n\}/);
    expect(cardMetaMatch).not.toBeNull();
    expect(cardMetaMatch?.[0]).toMatch(/trip\.startDate/);
    expect(cardMetaMatch?.[0]).toMatch(/trip\.endDate/);
    expect(cardMetaMatch?.[0]).toMatch(/trip\.memberCount/);
    // 不能再用舊 snake_case
    expect(cardMetaMatch?.[0]).not.toMatch(/trip\.start_date/);
  });

  it('filter tabs 含 4 顆：全部 / 我的 / 共編 / 已歸檔', () => {
    expect(SRC).toMatch(/key:\s*'all',\s*label:\s*'全部'/);
    expect(SRC).toMatch(/key:\s*'mine',\s*label:\s*'我的'/);
    expect(SRC).toMatch(/key:\s*'collab',\s*label:\s*'共編'/);
    expect(SRC).toMatch(/key:\s*'archived',\s*label:\s*'已歸檔'/);
  });

  it('archived filter 邏輯 = archivedAt != null', () => {
    expect(SRC).toMatch(/filterTab === 'archived'/);
    expect(SRC).toMatch(/t\.archivedAt != null/);
    expect(SRC).toMatch(/t\.archivedAt == null/);
  });

  it('archived empty state 含「目前沒有已歸檔行程」+ reset button', () => {
    expect(SRC).toMatch(/目前沒有已歸檔行程/);
    expect(SRC).toMatch(/data-testid="trips-list-archived-reset"/);
    expect(SRC).toMatch(/回到全部/);
  });
});
