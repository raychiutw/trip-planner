/**
 * reservation 寫入防堵（D）+ PATCH endpoint 收 reservation（C 後端）的 source-grep contract。
 *
 * 行為（helper 本身）見 reservation-format.test.ts；此檔鎖「各寫入路徑確實套了
 * normalizeReservation」+「PATCH /pois/:poiId 確實收 reservation」，避免日後有人新增
 * reservation 寫入點卻漏防堵、或回退 endpoint。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../', p), 'utf8');

describe('reservation 寫入防堵 contract（D）', () => {
  it('days/[num].ts AI 生成路徑：reservation 套 normalizeReservation', () => {
    const src = read('functions/api/trips/[id]/days/[num].ts');
    expect(src).toMatch(/import \{ normalizeReservation \} from ['"]\.\.\/\.\.\/\.\.\/_reservation['"]/);
    expect(src).toMatch(/reservation:\s*normalizeReservation\(/);
  });

  it('trip-pois.ts 加備選 INSERT：reservation 套 normalizeReservation', () => {
    const src = read('functions/api/trips/[id]/entries/[eid]/trip-pois.ts');
    expect(src).toMatch(/import \{ normalizeReservation \} from ['"]\.\.\/\.\.\/\.\.\/\.\.\/_reservation['"]/);
    expect(src).toMatch(/normalizeReservation\(\(body\.reservation/);
  });
});

describe('PATCH /pois/:poiId 收 reservation contract（C 後端）', () => {
  const src = read('functions/api/trips/[id]/entries/[eid]/pois/[poiId].ts');

  it('body 收 reservation + 至少一欄 guard 含 reservation', () => {
    expect(src).toMatch(/reservation\?: unknown/);
    expect(src).toMatch(/const hasReservation = 'reservation' in body/);
    expect(src).toMatch(/!hasNote && !hasType && !hasReservation/);
  });

  it('reservation 寫入前套 normalizeReservation（D 防堵）+ UPDATE reservation', () => {
    expect(src).toMatch(/normalizeReservation\(body\.reservation as string\)/);
    expect(src).toMatch(/UPDATE trip_entry_pois SET reservation = \?/);
  });

  it('SELECT 帶 curReservation + 回傳含 reservation', () => {
    expect(src).toMatch(/tep\.reservation AS curReservation/);
    expect(src).toMatch(/reservation: finalReservation/);
  });
});
