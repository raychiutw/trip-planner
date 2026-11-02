/**
 * Silent SaveStatus + explicit back nav — v2.33.139 PR14
 *
 * User feedback 2026-05-28：
 *   (A) titleBar 右上角不用顯示「即將儲存…」/「儲存中…」/「已儲存」狀態。
 *       Auto-save 默默完成，只在失敗時走 toast (mockup spec)。
 *   (B) 回前頁不該用 history (navigate(-1))，要明確指定 prev URL。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HOOK = readFileSync(
  join(__dirname, '../../src/hooks/useNavigateBack.ts'),
  'utf8',
);
const EDIT_ENTRY = readFileSync(
  join(__dirname, '../../src/pages/EditEntryPage.tsx'),
  'utf8',
);
const EDIT_TRIP = readFileSync(
  join(__dirname, '../../src/pages/EditTripPage.tsx'),
  'utf8',
);
const COLLAB = readFileSync(
  join(__dirname, '../../src/pages/CollabPage.tsx'),
  'utf8',
);

describe('PR14 (A): titleBar SaveStatus 拔除', () => {
  it('EditEntryPage 不再 import SaveStatus', () => {
    expect(EDIT_ENTRY).not.toMatch(/import SaveStatus from/);
  });

  it('EditEntryPage TitleBar 無 actions prop', () => {
    // grep 確認 <TitleBar ... actions={titleBarActions} 不存在
    expect(EDIT_ENTRY).not.toMatch(/titleBarActions/);
    expect(EDIT_ENTRY).not.toMatch(/derivedSaveState/);
  });

  it('EditTripPage 不再 import SaveStatus', () => {
    expect(EDIT_TRIP).not.toMatch(/import SaveStatus from/);
  });

  it('EditTripPage 主 form 無 actions={titleBarActions}', () => {
    // 仍可能存在 early-return path 用 TitleBar without actions — 只查主 path
    expect(EDIT_TRIP).not.toMatch(/actions=\{titleBarActions\}/);
  });

  it('EditEntryPage handleSave 失敗仍 showToast (mockup spec)', () => {
    expect(EDIT_ENTRY).toMatch(/showToast\(msg, 'error', 6000\)/);
  });

  it('comment 引用 user feedback「右上角不用顯示狀態」', () => {
    expect(EDIT_ENTRY).toMatch(/v2\.33\.139.*右上角不用|右上角不用.*v2\.33\.139/s);
  });
});

describe('PR14 (B): useNavigateBack 永遠走 explicit URL', () => {
  it('hook 不再 check window.history.length', () => {
    expect(HOOK).not.toMatch(/window\.history\.length/);
    // 排除 docstring 提及（描述舊行為）— 只查實際 code call
    const codeOnly = HOOK.replace(/\/\*\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/navigate\(-1\)/);
  });

  it('hook 永遠 navigate(fallbackPath)', () => {
    expect(HOOK).toMatch(/return useCallback\(\(\) => \{\s+navigate\(fallbackPath\);\s+\}, \[navigate, fallbackPath\]\)/);
  });

  it('docstring 解釋 footgun (history 含 external referrer / login redirect)', () => {
    expect(HOOK).toMatch(/v2\.33\.139.*history-aware|外部 referrer|login redirect|external referrer/);
  });

  it('CollabPage handleBack 不再 navigate(-1)', () => {
    expect(COLLAB).not.toMatch(/navigate\(-1\)/);
  });

  it('CollabPage handleBack 走 explicit /trips?selected=:id or /trips', () => {
    expect(COLLAB).toMatch(/navigate\(`\/trips\?selected=\$\{encodeURIComponent\(tripId\)\}`\)/);
    expect(COLLAB).toMatch(/navigate\('\/trips'\)/);
  });
});

describe('全 codebase grep — 無 navigate(-N) 殘留（G-S1 depth-gated 例外）', () => {
  // 唯一合法例外：OperationShell 的 depth-gated pop（G-S1「Back moves one level」）。
  // 只在 depth>1（location.state 由我方 push 端寫入 = 確定本 session in-app 操作 push 過）
  // 才 navigate(-1)，前一頁保證是我方操作頁、絕不會是外部 referrer / login redirect
  // → v2.33.139 的 footgun 不成立。其餘 back nav 一律 explicit-URL（useNavigateBack）。
  const ALLOWLIST = ['OperationShell.tsx'];

  // 遞迴 scan src/ pages + hooks + components 找剩餘 navigate(-N) calls
  function scanDir(dir: string): string[] {
    const { readdirSync, statSync } = require('node:fs');
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        out.push(...scanDir(full));
      } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
        if (ALLOWLIST.some((allowed) => full.endsWith(allowed))) continue;
        const text = readFileSync(full, 'utf8');
        // 排除 block comments (/** ... */) — docstring 可提到舊行為
        const codeOnly = text.replace(/\/\*\*[\s\S]*?\*\//g, '');
        if (/navigate\(-\d+\)/.test(codeOnly)) {
          out.push(full);
        }
      }
    }
    return out;
  }

  it('src/pages, src/hooks, src/components 0 個 navigate(-N) 殘留（除 allowlist）', () => {
    const srcRoot = join(__dirname, '../../src');
    const offenders = ['pages', 'hooks', 'components'].flatMap((sub) =>
      scanDir(join(srcRoot, sub)),
    );
    expect(offenders).toEqual([]);
  });

  it('carve-out 本身受守：OperationShell 的 navigate(-1) 必須 depth-gated（depth > 1）', () => {
    const OP_SHELL = readFileSync(
      join(__dirname, '../../src/components/shell/OperationShell.tsx'),
      'utf8',
    );
    const codeOnly = OP_SHELL.replace(/\/\*\*[\s\S]*?\*\//g, '');
    // 有 navigate(-1) 就必須同時有 depth > 1 gate（防日後有人把它改成無條件 -1）
    if (/navigate\(-1\)/.test(codeOnly)) {
      expect(codeOnly).toMatch(/depth > 1/);
    }
  });
});
