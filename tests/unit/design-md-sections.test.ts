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

  it('Material section 記載 Regular Glass 六 token 材質包', () => {
    // 舊斷言是「glass blur 14px 統一」。--blur-glass 已退役 —— 單一 blur 值只統一了
    // Liquid Glass 六層裡的一層，其餘五層各自漂移，正是 drift 的結構性根源。
    for (const token of ['--glass-tint', '--glass-filter', '--glass-rim', '--glass-specular', '--glass-shadow', '--chrome-inset']) {
      expect(design, `Material section 應記載 ${token}`).toContain(token);
    }
    expect(design).toMatch(/blur\(24px\)\s+saturate\(180%\)/);
  });

  it('Material section 明令玻璃不上品牌 tint', () => {
    // 舊斷言是「sheet 拿掉 saturate」——與新材質正面矛盾（saturate 現在是必要的，
    // 它是 HIG「content 的光溢出到玻璃表面」的廉價替代，少了它玻璃會死灰）。
    // 改為守住真正的鐵則：tint 必須中性。
    expect(design).toMatch(/玻璃不上品牌 tint|glass 不上 tint/);
  });

  it('Material section 保留已核可的材質例外（避免後續 PR 順手統一掉）', () => {
    expect(design).toMatch(/vibrancy/);
    expect(design).toMatch(/blur\(30px\)/);   // DesktopSidebar
    expect(design).toMatch(/blur\(8px\)/);    // small floating button
  });

  it('Accessibility section 記載 chrome 材質的三個系統設定降級', () => {
    expect(design).toContain('prefers-reduced-transparency');
    expect(design).toContain('prefers-contrast');
    expect(design).toContain('prefers-reduced-motion');
  });

  it('label token 描述表單 label 與 metadata 用途', () => {
    expect(design).toMatch(/`label`.*表單 label、metadata、chip label/);
  });

  it('eyebrow token 限定為 uppercase label', () => {
    expect(design).toMatch(/`eyebrow`.*uppercase label/);
  });
});
