/**
 * AccountPage display_name inline edit — v2.33.142 替代 v2.33.122 modal。
 *
 * User feedback 2026-05-28：「筆的編輯 直接修改名稱 離開焦點後 auto save,
 * 不要 pop 編輯窗」。Hero name 直接變 input，blur auto-save，無 modal。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, '../../src/pages/AccountPage.tsx'), 'utf8');
const BACKEND = readFileSync(
  join(__dirname, '../../functions/api/account/profile.ts'),
  'utf8',
);

describe('PR17 (v2.33.142) inline edit — modal 已拔', () => {
  it('無 showEditNameModal state / overlay testid / dialog className', () => {
    expect(SRC).not.toMatch(/showEditNameModal/);
    expect(SRC).not.toMatch(/account-edit-name-overlay/);
    expect(SRC).not.toMatch(/tp-account-edit-dialog/);
  });

  it('無 modal-only testid (cancel / save button)', () => {
    expect(SRC).not.toMatch(/data-testid="account-edit-name-cancel"/);
    expect(SRC).not.toMatch(/data-testid="account-edit-name-save"/);
  });

  it('CSS 拔 tp-account-edit-overlay / dialog / title / help / actions', () => {
    expect(SRC).not.toMatch(/\.tp-account-edit-overlay/);
    expect(SRC).not.toMatch(/\.tp-account-edit-dialog/);
    expect(SRC).not.toMatch(/\.tp-account-edit-title/);
    expect(SRC).not.toMatch(/\.tp-account-edit-help/);
    expect(SRC).not.toMatch(/\.tp-account-edit-actions/);
    expect(SRC).not.toMatch(/@keyframes tp-account-edit-fade/);
  });
});

describe('PR17 inline state hooks + helpers', () => {
  it('editingName boolean + draftName string + savingName + nameInputRef + draftBaselineRef', () => {
    expect(SRC).toMatch(/const \[editingName, setEditingName\] = useState\(false\)/);
    expect(SRC).toMatch(/const \[draftName, setDraftName\] = useState\(''\)/);
    expect(SRC).toMatch(/const \[savingName, setSavingName\] = useState\(false\)/);
    expect(SRC).toMatch(/const nameInputRef = useRef<HTMLInputElement>\(null\)/);
    expect(SRC).toMatch(/draftBaselineRef = useRef\(''\)/);
  });

  it('startEditName: useCallback + setDraftName + setEditingName(true) + focus + select via setTimeout', () => {
    expect(SRC).toMatch(/const startEditName = useCallback/);
    expect(SRC).toMatch(/setDraftName\(current\)/);
    expect(SRC).toMatch(/draftBaselineRef\.current = current/);
    expect(SRC).toMatch(/setEditingName\(true\)/);
    expect(SRC).toMatch(/nameInputRef\.current\?\.focus\(\)/);
    expect(SRC).toMatch(/nameInputRef\.current\?\.select\(\)/);
  });

  it('cancelEditName: revert draftName 並 setEditingName(false)', () => {
    expect(SRC).toMatch(/const cancelEditName = useCallback/);
    expect(SRC).toMatch(/setDraftName\(draftBaselineRef\.current\)/);
  });

  it('commitEditName: trimmed === baseline 跳過 API call', () => {
    expect(SRC).toMatch(/const commitEditName = useCallback/);
    expect(SRC).toMatch(/if \(trimmed === draftBaselineRef\.current\.trim\(\)\)/);
  });

  it('commitEditName: PATCH /account/profile + reloadUser + 成功 silent (無 toast)', () => {
    expect(SRC).toMatch(/apiFetch\(['"]\/account\/profile['"]/);
    expect(SRC).toMatch(/method: ['"]PATCH['"]/);
    expect(SRC).toMatch(/displayName: trimmed\.length === 0 \? null : trimmed/);
    expect(SRC).toMatch(/reloadUser\(\)/);
    // 成功 path 不應有 showToast('名稱已更新'...) — v2.33.122 已拔
    expect(SRC).not.toMatch(/showToast\(['"]名稱已更新['"]/);
  });

  it('commitEditName 失敗 path 仍 showToast (error)', () => {
    expect(SRC).toMatch(/showToast\(msg, 'error'\)/);
  });
});

describe('PR17 JSX render', () => {
  it('editingName=true → render <input> 含 onBlur=commitEditName', () => {
    expect(SRC).toMatch(/onBlur=\{\(\) => void commitEditName\(\)\}/);
  });

  it('editingName=true → input onKeyDown Enter blur + ESC cancel', () => {
    expect(SRC).toMatch(/e\.key === 'Enter'/);
    expect(SRC).toMatch(/\(e\.target as HTMLInputElement\)\.blur\(\)/);
    expect(SRC).toMatch(/e\.key === 'Escape'/);
    expect(SRC).toMatch(/cancelEditName\(\)/);
  });

  it('editingName=false → render h2 name (cursor:text) 點擊 startEditName', () => {
    expect(SRC).toMatch(/<h2[\s\S]+?className="tp-account-hero-name"[\s\S]+?onClick=\{startEditName\}/);
    expect(SRC).toMatch(/\.tp-account-hero-name \{[\s\S]*?cursor: text/);
  });

  it('pencil button 仍存在 + click 也 trigger startEditName', () => {
    expect(SRC).toMatch(/data-testid="account-edit-name-btn"/);
    expect(SRC).toMatch(/<button[\s\S]+?className="tp-account-hero-name-edit"[\s\S]+?onClick=\{startEditName\}/);
  });

  it('input maxLength 50 對齊 backend MAX_DISPLAY_NAME_LEN', () => {
    expect(SRC).toMatch(/maxLength=\{50\}/);
    expect(BACKEND).toMatch(/MAX_DISPLAY_NAME_LEN = 50/);
  });

  it('input style class .tp-account-hero-name-input — font size/weight 對齊 hero-name 避免 jump', () => {
    expect(SRC).toMatch(/\.tp-account-hero-name-input \{[\s\S]*?font-size: var\(--font-size-title2\);[\s\S]*?font-weight: 800/);
  });
});

describe('PATCH /api/account/profile backend handler 未動', () => {
  it('export onRequestPatch + auth + validation 三層仍在', () => {
    expect(BACKEND).toMatch(/export const onRequestPatch/);
    expect(BACKEND).toMatch(/requireAuth\(context\)/);
    expect(BACKEND).toMatch(/MAX_DISPLAY_NAME_LEN = 50/);
  });
});
