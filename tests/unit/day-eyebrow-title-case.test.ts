/**
 * #1692：全站 Day 眉標依 App 寫「Day N」、不轉大寫。
 * AddCustomStopPage day chip、AddEntryPage day picker／formatDayLabel 的守門（source-grep）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (f: string) => readFileSync(join(__dirname, '../../src/pages', f), 'utf8');

describe('Day 眉標不寫死全大寫（#1692）', () => {
  it('AddCustomStopPage day chip 寫 Day', () => {
    const src = read('AddCustomStopPage.tsx');
    expect(src).toMatch(/chip-num">Day \{String\(d\.dayNum\)/);
    expect(src).not.toMatch(/chip-num">DAY/);
  });

  it('AddEntryPage formatDayLabel 與 picker label 寫 Day 且 label 不轉大寫', () => {
    const src = read('AddEntryPage.tsx');
    expect(src).toContain('`Day ${num} · ${mmdd}${dow}`');
    expect(src).toMatch(/daypicker-label">Day</);
    expect(src).toMatch(/\.tp-add-entry-daypicker-label \{[^}]*text-transform: none/);
  });
});
