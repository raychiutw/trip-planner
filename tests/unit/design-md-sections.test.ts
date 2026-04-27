/**
 * PR 2 — DESIGN.md 規範完整性測試
 * 驗證 DESIGN.md 是否包含必要的 section 與條文
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const designPath = resolve(__dirname, '../../DESIGN.md');
const design = readFileSync(designPath, 'utf-8');

describe('DESIGN.md — 完整性檢查', () => {
  it('包含 role-based Type Scale section', () => {
    expect(design).toContain('### Type Scale');
    expect(design).toContain('Desktop');
    expect(design).toContain('Compact');
  });

  it('Type scale 表格包含 desktop / compact body 16px / 26px 規格', () => {
    expect(design).toMatch(/`body`.*16px \/ 26px.*16px \/ 26px/);
  });

  it('包含 Data Visualization 例外條文', () => {
    expect(design).toContain('Data Visualization 例外');
  });

  it('DV 例外條文提及 qualitative palette', () => {
    expect(design).toContain('qualitative palette');
  });

  it('Material section 明確 glass blur 14px 統一', () => {
    // 確認 Glass blur 統一 14px
    expect(design).toMatch(/blur\(14px\)/);
  });

  it('Material section 說明 sheet 拿掉 saturate', () => {
    // 確認 sheet saturate 相關條文（"不加 `saturate"、"拿掉 `saturate" 或 "去除 saturate"）
    expect(design).toMatch(/不加.*saturate|拿掉.*saturate|去除.*saturate|removed.*saturate/i);
  });

  it('Decisions Log 有 Glass unified 14px 記錄', () => {
    expect(design).toContain('Glass unified 14px');
  });

  it('label token 描述表單 label 與 metadata 用途', () => {
    expect(design).toMatch(/`label`.*表單 label、metadata、chip label/);
  });

  it('eyebrow token 限定為 uppercase label', () => {
    expect(design).toMatch(/`eyebrow`.*uppercase label/);
  });
});
