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
  it('包含 Mobile Type Scale section', () => {
    expect(design).toContain('## Type Scale (Mobile ≤760px)');
  });

  it('Mobile type scale 表格包含 body 16px mobile override', () => {
    // 確認 body 欄位在 Mobile 下為 16px
    expect(design).toMatch(/body.*16px/);
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
    // 確認 sheet saturate 相關條文（"拿掉 `saturate" 或 "去除 saturate"）
    expect(design).toMatch(/拿掉.*saturate|去除.*saturate|removed.*saturate/i);
  });

  it('Decisions Log 有 Glass unified 14px 記錄', () => {
    expect(design).toContain('Glass unified 14px');
  });

  it('caption2 描述為最小行內 meta label（例：NIGHT 1 等）', () => {
    // Finding #5：收斂 caption2 semantic
    expect(design).toMatch(/caption2.*最小行內 meta label/);
  });

  it('eyebrow 描述為大寫 section header（例：DAY 01、STOPS、用餐）', () => {
    // Finding #5：收斂 eyebrow semantic，與 caption2 分離
    expect(design).toMatch(/eyebrow.*大寫 section header/);
  });
});
