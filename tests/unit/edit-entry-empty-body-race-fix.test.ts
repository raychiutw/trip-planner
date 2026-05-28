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

// PR12 (B) SaveStatus assertions removed — component 已於 v2.33.143 刪除（PR18）。
// 失敗走 showToast 由下方 describe 驗證。

describe('PR12 (B) / PR14 / PR18: EditEntryPage handleSave 失敗走 toast', () => {
  it('failures path 加 showToast(msg, "error", 6000)', () => {
    // v2.33.139 起拔 setError，PR12 (B) 留 setError + toast 的 assertion 過時
    const idx = EDIT.indexOf("'移動方式'}儲存失敗");
    expect(idx).toBeGreaterThan(0);
    const snippet = EDIT.slice(idx, idx + 600);
    expect(snippet).toContain("showToast(msg, 'error', 6000)");
    // setError 已不存在（v2.33.139 拔 error state）
    expect(snippet).not.toContain('setError(');
  });

  it('catch path 也加 showToast', () => {
    expect(EDIT).toMatch(/const msg = err instanceof Error \? err\.message : '儲存失敗';\s+showToast\(msg, 'error', 6000\)/);
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
