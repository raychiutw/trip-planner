/**
 * AccountPage display_name 編輯 modal — regression for v2.33.122.
 *
 * Feature: hero name 旁 ✏ pencil icon → 點開 modal → input → Enter / 儲存 →
 * PATCH /api/account/profile → reloadUser() → toast。null displayName 走 sidebar
 * fallback (email local-part)，與 v2.33.121 對齊。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, '../../src/pages/AccountPage.tsx'), 'utf8');
const BACKEND = readFileSync(
  join(__dirname, '../../functions/api/account/profile.ts'),
  'utf8',
);

describe('AccountPage v2.33.122 display_name edit modal (regression)', () => {
  it('hero name 旁有 ✏ edit button (testid + aria-label)', () => {
    expect(SRC).toContain('data-testid="account-edit-name-btn"');
    expect(SRC).toContain('aria-label="編輯名稱"');
    expect(SRC).toMatch(/<Icon name="pencil"/);
  });

  it('modal state hooks: showEditNameModal + editingName + savingName', () => {
    expect(SRC).toMatch(/showEditNameModal, setShowEditNameModal/);
    expect(SRC).toMatch(/editingName, setEditingName/);
    expect(SRC).toMatch(/savingName, setSavingName/);
  });

  it('modal input + cancel + save testid', () => {
    expect(SRC).toContain('data-testid="account-edit-name-overlay"');
    expect(SRC).toContain('data-testid="account-edit-name-input"');
    expect(SRC).toContain('data-testid="account-edit-name-cancel"');
    expect(SRC).toContain('data-testid="account-edit-name-save"');
  });

  it('handleSaveName 打 PATCH /account/profile + trim + null fallback (empty → null)', () => {
    expect(SRC).toMatch(/apiFetch\(['"]\/account\/profile['"]/);
    expect(SRC).toMatch(/method: ['"]PATCH['"]/);
    expect(SRC).toMatch(/displayName: trimmed\.length === 0 \? null : trimmed/);
  });

  it('成功 reload user + 關 modal + toast', () => {
    expect(SRC).toMatch(/reloadUser\(\)/);
    expect(SRC).toMatch(/setShowEditNameModal\(false\)/);
    expect(SRC).toMatch(/showToast\(['"]名稱已更新['"]/);
  });

  it('鍵盤 a11y: Enter save + Escape cancel', () => {
    expect(SRC).toMatch(/e\.key === ['"]Enter['"]/);
    expect(SRC).toMatch(/e\.key === ['"]Escape['"]/);
  });

  it('input maxLength 50 對齊 backend MAX_DISPLAY_NAME_LEN', () => {
    expect(SRC).toMatch(/maxLength=\{50\}/);
    expect(BACKEND).toMatch(/MAX_DISPLAY_NAME_LEN = 50/);
  });
});

describe('PATCH /api/account/profile backend handler', () => {
  it('export onRequestPatch + requireAuth + userId guard', () => {
    expect(BACKEND).toMatch(/export const onRequestPatch/);
    expect(BACKEND).toMatch(/requireAuth\(context\)/);
    expect(BACKEND).toMatch(/AppError\(['"]AUTH_REQUIRED['"]\)/);
  });

  it('validate displayName: null / string / undefined 3 path', () => {
    expect(BACKEND).toMatch(/body\.displayName === undefined/);
    expect(BACKEND).toMatch(/body\.displayName === null/);
    expect(BACKEND).toMatch(/typeof body\.displayName !== ['"]string['"]/);
  });

  it('trim + empty 視同 null + max 50 length 拒', () => {
    expect(BACKEND).toMatch(/\.trim\(\)/);
    expect(BACKEND).toMatch(/trimmed\.length === 0/);
    expect(BACKEND).toMatch(/trimmed\.length > MAX_DISPLAY_NAME_LEN/);
  });

  it('UPDATE users SET display_name + audit log', () => {
    expect(BACKEND).toMatch(/UPDATE users SET display_name = \?, updated_at = \?/);
    expect(BACKEND).toMatch(/logAudit\(/);
    expect(BACKEND).toMatch(/tableName: ['"]user['"]/);
  });

  it('response mirror /api/oauth/userinfo shape (camelCase)', () => {
    expect(BACKEND).toMatch(/emailVerified: row\.email_verified_at !== null/);
    expect(BACKEND).toMatch(/displayName: row\.display_name/);
    expect(BACKEND).toMatch(/avatarUrl: row\.avatar_url/);
    expect(BACKEND).toMatch(/createdAt: row\.created_at/);
  });
});
