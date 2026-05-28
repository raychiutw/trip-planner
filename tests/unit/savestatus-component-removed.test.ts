/**
 * SaveStatus component 全拔 — v2.33.143 PR18
 *
 * User feedback：「都要拔」(指剩餘 TimelineRail inline + TravelPillDialog footer
 * SaveStatus instance)。拔完後 SaveStatus.tsx 0 caller → 整 component 刪除。
 *
 * 失敗統一走 showToast (對齊 mockup spec + 既有 EditEntryPage / EditTripPage pattern)。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TIMELINE = readFileSync(
  join(__dirname, '../../src/components/trip/TimelineRail.tsx'),
  'utf8',
);
const DIALOG = readFileSync(
  join(__dirname, '../../src/components/trip/TravelPillDialog.tsx'),
  'utf8',
);

describe('PR18 (A): TimelineRail note autosave silent + toast on error', () => {
  it('SaveStatus import 已拔', () => {
    expect(TIMELINE).not.toMatch(/import SaveStatus from/);
  });

  it('InlineError import 已拔 (note error 一併走 toast)', () => {
    expect(TIMELINE).not.toMatch(/import InlineError from/);
  });

  it('tp-rail-note-actions 內 SaveStatus JSX 已拔', () => {
    // 取 note-actions block，內部不含 SaveStatus tag
    const block = TIMELINE.match(/<div className="tp-rail-note-actions">[\s\S]+?<\/div>/);
    expect(block).toBeTruthy();
    expect(block![0]).not.toMatch(/<SaveStatus/);
    expect(block![0]).not.toMatch(/noteAutosave\.state/);
  });

  it('error toast useEffect 監聽 noteAutosave.state==="error" + showToast', () => {
    expect(TIMELINE).toMatch(/lastNoteErrorRef = useRef<string \| null>\(null\)/);
    expect(TIMELINE).toMatch(/showToast\(`備註儲存失敗：\$\{noteAutosave\.error\}`, 'error', 6000\)/);
  });

  it('完成 button 仍存在 (純關閉，不 fire save)', () => {
    expect(TIMELINE).toMatch(/className="tp-rail-note-cancel"/);
  });
});

describe('PR18 (B): TravelPillDialog footer silent + toast on error', () => {
  it('SaveStatus import 已拔，showToast import 已加', () => {
    expect(DIALOG).not.toMatch(/import SaveStatus from/);
    expect(DIALOG).toMatch(/import \{ showToast \} from '\.\.\/shared\/Toast'/);
  });

  it('footer 內 SaveStatus JSX 已拔', () => {
    const block = DIALOG.match(/<div className="tp-travel-dialog-footer">[\s\S]+?<\/div>/);
    expect(block).toBeTruthy();
    expect(block![0]).not.toMatch(/<SaveStatus/);
    expect(block![0]).not.toMatch(/autosave\.state/);
  });

  it('error toast useEffect 監聽 autosave.state==="error" + showToast', () => {
    expect(DIALOG).toMatch(/lastErrorRef = useRef<string \| null>\(null\)/);
    expect(DIALOG).toMatch(/showToast\(`交通方式儲存失敗：\$\{autosave\.error\}`, 'error', 6000\)/);
  });

  it('關閉 button 仍是 footer 唯一 element', () => {
    expect(DIALOG).toMatch(/<button[\s\S]+?data-testid="travel-dialog-close"[\s\S]+?>\s*關閉\s*<\/button>/);
  });
});

describe('PR18 (C): SaveStatus component file 已刪除', () => {
  it('src/components/shared/SaveStatus.tsx 不存在', () => {
    const p = join(__dirname, '../../src/components/shared/SaveStatus.tsx');
    expect(existsSync(p)).toBe(false);
  });
});

describe('PR18 (D): 全 codebase grep — 0 個 SaveStatus import 殘留', () => {
  it('src/ 任何檔案不再 import SaveStatus', () => {
    const fs = require('node:fs');
    function scan(dir: string): string[] {
      const out: string[] = [];
      for (const name of fs.readdirSync(dir)) {
        const full = join(dir, name);
        const s = fs.statSync(full);
        if (s.isDirectory()) out.push(...scan(full));
        else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
          const text = fs.readFileSync(full, 'utf8');
          if (/import\s+SaveStatus\b/.test(text)) out.push(full);
        }
      }
      return out;
    }
    const offenders = scan(join(__dirname, '../../src'));
    expect(offenders).toEqual([]);
  });
});
