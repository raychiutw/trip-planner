// @vitest-environment node
/**
 * v2.31.35 fix #136: CollabPanel avatar initial 用 displayName 優先，fallback email。
 *
 * Bug 取證（mobile prod QA）：CollabPage 「擁有者」row email lean.lean@gmail.com，
 * avatar 顯「L」(email[0])。Other page (TripsListPage / Sidebar) 用 displayName
 * 顯「R」(Ray)。Memory rule「avatar 一律用帳號名稱第一字母」CollabPanel 漏對齊。
 *
 * Fix：
 * 1. backend functions/api/permissions.ts SELECT 加 u.display_name → deepCamel → displayName
 * 2. src/types/api.ts Permission 加 displayName?: string | null
 * 3. CollabPanel.tsx initial logic 用 (p.displayName ?? p.email).charAt(0).toUpperCase()
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PANEL_SRC = readFileSync(
  path.resolve(__dirname, '../../src/components/trip/CollabPanel.tsx'),
  'utf8',
);
const TYPES_SRC = readFileSync(
  path.resolve(__dirname, '../../src/types/api.ts'),
  'utf8',
);
const BACKEND_SRC = readFileSync(
  path.resolve(__dirname, '../../functions/api/permissions.ts'),
  'utf8',
);

describe('v2.31.35 CollabPanel avatar displayName', () => {
  it('backend SELECT 加 u.display_name', () => {
    expect(BACKEND_SRC).toMatch(/SELECT\s+tp\.id[\s\S]{0,80}u\.display_name/);
  });

  it('Permission type 加 displayName?: string | null', () => {
    const permMatch = TYPES_SRC.match(/export interface Permission \{[\s\S]*?\n\}/);
    expect(permMatch).not.toBeNull();
    expect(permMatch?.[0]).toMatch(/displayName\?:\s*string\s*\|\s*null/);
  });

  it('CollabPanel initial 用 displayName 優先 fallback email', () => {
    // (p.displayName?.trim() || p.email).charAt(0).toUpperCase()
    expect(PANEL_SRC).toMatch(/p\.displayName\?\.trim\(\)\s*\|\|\s*p\.email/);
    expect(PANEL_SRC).toMatch(/\.charAt\(0\)\.toUpperCase\(\)/);
  });

  it('CollabPanel 不再直接 p.email.charAt(0)（regression）', () => {
    // 第一個 initial 計算（permissions row）不該再直接用 email
    const firstInitial = PANEL_SRC.indexOf('const initialSource');
    expect(firstInitial).toBeGreaterThan(0);
    const ctx = PANEL_SRC.slice(firstInitial, firstInitial + 200);
    expect(ctx).not.toMatch(/^p\.email\.charAt\(0\)/);
  });
});
