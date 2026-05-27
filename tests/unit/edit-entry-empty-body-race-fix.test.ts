/**
 * EditEntryPage 400 empty-body race + SaveStatus mockup-align — v2.33.136 PR12
 *
 * 2026-05-28 prod QA：rayschiu 編輯 entry 781 顯「景點儲存失敗 (400)」+ 錯誤
 * 訊息出現在 TitleBar 違反 mockup 設計（mockup L789：「儲存失敗 → 重試 +
 * toast error」）。
 *
 * (A) 400 root cause：dirty.entryDirty useMemo 比對 originalRef.current value，
 *     但 originalRef 是 ref 不在 memo deps。dirty=true 時 handleSave 內 body
 *     重做同樣 ref 比對，若中途 ref 被外部 path 寫成 === current state，
 *     body={} 但仍 push request → backend "DATA_VALIDATION: 無有效欄位可更新"
 *     (api_logs 過去 2 次此 error 確證)。
 *
 * (B) UI mockup-align：SaveStatus 之前 error state 顯「（msg）」inline，違 mockup。
 *     拔 inline detail，改 EditEntryPage handleSave 失敗 showToast。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const EDIT = readFileSync(
  join(__dirname, '../../src/pages/EditEntryPage.tsx'),
  'utf8',
);
const SAVE_STATUS = readFileSync(
  join(__dirname, '../../src/components/shared/SaveStatus.tsx'),
  'utf8',
);
const MOCKUP = readFileSync(
  join(__dirname, '../../docs/design-sessions/2026-05-11-entry-time-segment-mode-edit.html'),
  'utf8',
);

describe('PR12 (A): empty body race guard', () => {
  it('entry body push 前先檢 Object.keys(body).length > 0', () => {
    expect(EDIT).toMatch(/if \(Object\.keys\(body\)\.length > 0\) \{\s+requests\.push\(/);
  });

  it('注解解釋 race / api_logs 400 evidence', () => {
    expect(EDIT).toMatch(/v2\.33\.136 fix: race guard/);
    expect(EDIT).toMatch(/DATA_VALIDATION: 無有效欄位可更新/);
  });

  it('requests.length === 0 → 早 return 不走 success path 寫 originalRef', () => {
    expect(EDIT).toMatch(/if \(requests\.length === 0\) \{\s+setSubmitting\(false\);\s+return;/);
  });
});

describe('PR12 (B): SaveStatus error 不再 inline 顯細節（mockup-align）', () => {
  it('SaveStatus 拔掉 inline error detail span', () => {
    expect(SAVE_STATUS).not.toMatch(/tp-save-status-error-detail/);
    expect(SAVE_STATUS).not.toMatch(/data-testid="save-status-error"/);
  });

  it('error state 仍保留 重試 button + ⚠ icon', () => {
    expect(SAVE_STATUS).toMatch(/state === 'error' && onRetry/);
    expect(SAVE_STATUS).toMatch(/data-testid="save-status-retry"/);
    expect(SAVE_STATUS).toMatch(/error: '⚠'/);
  });

  it('error message 寫進 aria-label 給 screen reader', () => {
    expect(SAVE_STATUS).toMatch(/const ariaLabel = state === 'error' && error \? `儲存失敗：\$\{error\}` : undefined/);
    expect(SAVE_STATUS).toMatch(/aria-label=\{ariaLabel\}/);
  });

  it('注解引用 mockup spec 路徑', () => {
    expect(SAVE_STATUS).toMatch(/2026-05-11-entry-time-segment-mode-edit\.html/);
    expect(SAVE_STATUS).toMatch(/儲存失敗 → 重試\s+\+\s+toast error|儲存失敗 → 重試/);
  });
});

describe('PR12 (B): EditEntryPage handleSave 失敗走 toast', () => {
  it('failures path 加 showToast(msg, "error", 6000)', () => {
    // 失敗 path 含 setError + showToast 二者，message 重用同變數
    const idx = EDIT.indexOf("'移動方式'}儲存失敗");
    expect(idx).toBeGreaterThan(0);
    const snippet = EDIT.slice(idx, idx + 600);
    expect(snippet).toContain('setError(msg);');
    expect(snippet).toContain("showToast(msg, 'error', 6000)");
  });

  it('catch path 也加 showToast', () => {
    expect(EDIT).toMatch(/const msg = err instanceof Error \? err\.message : '儲存失敗';\s+setError\(msg\);\s+showToast\(msg, 'error', 6000\)/);
  });

  it('body 內 InlineError 拔掉（duplicate of toast）', () => {
    expect(EDIT).not.toMatch(/data-testid="edit-entry-save-error"/);
  });

  it('validation InlineError 保留（form-level user 知道哪個欄位錯）', () => {
    expect(EDIT).toMatch(/data-testid="edit-entry-validation"/);
  });
});

describe('mockup spec source of truth', () => {
  it('mockup 含 「儲存失敗 → 重試 + toast error」spec line', () => {
    expect(MOCKUP).toMatch(/儲存失敗/);
    expect(MOCKUP).toMatch(/重試/);
    expect(MOCKUP).toMatch(/toast error/);
  });
});
