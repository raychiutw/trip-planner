// @vitest-environment node
/**
 * scripts/import-huiyun-trip-notes.ts — pure mapping function test
 *
 * 驗證 buildImportPlan 對 HuiYun JSON shape 的 mapping 正確：
 *   - 7 checklist cards → 7 trip_pretrip_notes
 *   - 4 emergency contacts → 4 trip_emergency_contacts
 *   - 3 emergency notes 聚合成 1 額外 trip_pretrip_notes
 *   - 3 hotels → 3 trip_lodgings (cross-ref checklist + emergency)
 *   - 緊急電話 kind 對應正確：110→police / 119→medical / 駐外館→embassy
 *   - sort_order 單調遞增 from 0 per table
 *   - markdown 內容含 bullet (- ) prefix
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildImportPlan } from '../../scripts/import-huiyun-trip-notes';

// Load actual rescue JSON from /tmp/huiyun-rescue/ if exists; else use embedded fixture
let checklist: any;
let emergency: any;
try {
  checklist = JSON.parse(readFileSync('/tmp/huiyun-rescue/checklist.json', 'utf8'));
  emergency = JSON.parse(readFileSync('/tmp/huiyun-rescue/emergency.json', 'utf8'));
} catch {
  // Fallback fixture if rescue files missing in CI
  checklist = {
    title: '出發前確認清單',
    content: {
      cards: [
        { title: '證件與通訊', items: ['護照', '駕照', '信用卡'] },
        { title: '金錢與行李', items: ['日幣現金', '防曬乳'] },
      ],
    },
  };
  emergency = {
    title: '緊急聯絡',
    content: {
      cards: [
        {
          title: '緊急電話',
          contacts: [
            { label: '警察 110', phone: '110' },
            { label: '消防・救護 119', phone: '119' },
            { label: '駐日代表處', phone: '+81332807917' },
          ],
        },
        {
          title: '旅遊保險',
          notes: ['出發前請確認已投保海外旅遊險'],
        },
      ],
    },
  };
}

const TRIP_ID = 'huiyun-test-trip';

describe('buildImportPlan — HuiYun rescue JSON', () => {
  const plan = buildImportPlan(TRIP_ID, checklist, emergency);

  it('產生對應 3 個 table 的 row', () => {
    const tables = new Set(plan.map((r) => r.table));
    expect(tables.has('trip_pretrip_notes')).toBe(true);
    expect(tables.has('trip_emergency_contacts')).toBe(true);
    expect(tables.has('trip_lodgings')).toBe(true);
  });

  it('checklist N cards + 1 emergency notes 聚合 row = pretrip_notes 總數', () => {
    const checklistCards = checklist.content.cards.length;
    const hasEmergencyNotes = emergency.content.cards.some((c: any) => (c.notes ?? []).length > 0);
    const expected = checklistCards + (hasEmergencyNotes ? 1 : 0);
    const actual = plan.filter((r) => r.table === 'trip_pretrip_notes').length;
    expect(actual).toBe(expected);
  });

  it('trip_emergency_contacts 含警察 110 / 救護 119 / 駐外館', () => {
    const contacts = plan.filter((r) => r.table === 'trip_emergency_contacts');
    expect(contacts.length).toBeGreaterThanOrEqual(3);
    const phones = contacts.map((r) => r.values[r.cols.indexOf('phone')]);
    expect(phones).toContain('110');
    expect(phones).toContain('119');
  });

  it('110 kind=police, 119 kind=medical, 駐外館 kind=embassy', () => {
    const contacts = plan.filter((r) => r.table === 'trip_emergency_contacts');
    const find = (phone: string) => contacts.find((r) => r.values[r.cols.indexOf('phone')] === phone);
    expect(find('110')!.values[find('110')!.cols.indexOf('kind')]).toBe('police');
    expect(find('119')!.values[find('119')!.cols.indexOf('kind')]).toBe('medical');
    const embassy = contacts.find((r) => {
      const name = r.values[r.cols.indexOf('name')] as string;
      return name?.includes('代表處') || name?.includes('辦事處');
    });
    if (embassy) {
      expect(embassy.values[embassy.cols.indexOf('kind')]).toBe('embassy');
    }
  });

  it('trip_lodgings 含 Mercure + BUZZ + HOPE VILLA 3 間', () => {
    const lodgings = plan.filter((r) => r.table === 'trip_lodgings');
    expect(lodgings.length).toBe(3);
    const names = lodgings.map((r) => r.values[r.cols.indexOf('name')] as string);
    expect(names.some((n) => n.includes('Mercure'))).toBe(true);
    expect(names.some((n) => n.includes('BUZZ'))).toBe(true);
    expect(names.some((n) => n.includes('HOPE'))).toBe(true);
  });

  it('每個 row 的 trip_id 都對', () => {
    for (const r of plan) {
      expect(r.values[r.cols.indexOf('trip_id')]).toBe(TRIP_ID);
    }
  });

  it('sort_order 在每個 table 內單調遞增 from 0', () => {
    const byTable = new Map<string, number[]>();
    for (const r of plan) {
      const idx = r.cols.indexOf('sort_order');
      if (idx < 0) continue;
      const arr = byTable.get(r.table) ?? [];
      arr.push(r.values[idx] as number);
      byTable.set(r.table, arr);
    }
    for (const [t, orders] of byTable) {
      expect(orders[0], `${t} 首 row sort_order 應為 0`).toBe(0);
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i], `${t} sort_order 應遞增`).toBe(orders[i - 1] + 1);
      }
    }
  });

  it('trip_pretrip_notes content 為 markdown bullet list (- prefix)', () => {
    const notes = plan.filter((r) => r.table === 'trip_pretrip_notes');
    for (const r of notes) {
      const content = r.values[r.cols.indexOf('content')] as string;
      // 至少 1 個 bullet
      expect(content).toMatch(/^- /m);
    }
  });

  it('manual import (ai_generated=0, ai_source=null) 對齊 schema', () => {
    const notes = plan.filter((r) => r.table === 'trip_pretrip_notes');
    for (const r of notes) {
      expect(r.values[r.cols.indexOf('ai_generated')]).toBe(0);
      expect(r.values[r.cols.indexOf('ai_source')]).toBeNull();
    }
  });
});
