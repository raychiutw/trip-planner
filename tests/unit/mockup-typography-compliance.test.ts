// @vitest-environment node
/**
 * mockup-parity-qa-fixes: 鎖 mockup `terracotta-preview-v2.html` typography spec 不被 regression。
 *
 * 用 raw text grep 檢驗 css/tokens.css / 相關 component CSS 含特定 token value，
 * 不依賴 jsdom getComputedStyle（避免 Tailwind 4 @theme 處理跟 vitest 環境不相容）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

function readFile(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('mockup-parity-qa-fixes typography compliance', () => {
  const tokens = readFile('css/tokens.css');
  const tripsList = readFile('src/pages/TripsListPage.tsx');
  // 2026-05-03 modal-to-fullpage migration: NewTripModal.tsx 已 DEL，
  // form 移到 src/pages/NewTripPage.tsx。typography rules 仍在 _tripFormStyles
  // shared module + NewTripPage SCOPED_STYLES。
  const newTripPage = readFile('src/pages/NewTripPage.tsx');
  const tripFormStyles = readFile('src/components/trip/_tripFormStyles.ts');
  // 2026-05-03 modal-to-fullpage migration: AddStopModal.tsx 已 DEL，
  // form 移到 src/pages/AddStopPage.tsx。
  const addStopPage = readFile('src/pages/AddStopPage.tsx');
  // rev2「6 條全接」：操作頁 chrome（整頁 TitleBar / 桌機右欄 StackPanelHeader）
  // 由 OperationShell 統一負責，page heading 走它的 title prop。
  const opShell = readFile('src/components/shell/OperationShell.tsx');
  const bnav = readFile('src/components/shell/GlobalBottomNav.tsx');

  it('--font-size-body 對齊 mockup body 16px (1rem)', () => {
    expect(tokens).toMatch(/--font-size-body:\s*1rem/);
    expect(tokens).not.toMatch(/--font-size-body:\s*1\.0625rem/);
  });

  it('--font-size-footnote 對齊 mockup support 14px (0.875rem)', () => {
    expect(tokens).toMatch(/--font-size-footnote:\s*0\.875rem/);
    expect(tokens).not.toMatch(/--font-size-footnote:\s*0\.8125rem/);
  });

  it('.tp-titlebar-title desktop 對齊 mockup .tp-page-titlebar-title 20px', () => {
    // 第一處 .tp-titlebar-title rule 是 desktop（≥1024 media query 內）
    const desktopMatch = tokens.match(/\.tp-titlebar-title\s*\{[\s\S]*?font-size:\s*var\(--font-size-title3\)/);
    expect(desktopMatch).not.toBeNull();
  });

  it('.tp-titlebar-title compact 對齊 mockup 18px', () => {
    // compact ≤760px rule 內 hardcoded 18px (allow comment / whitespace between rules)
    expect(tokens).toMatch(/font-size:\s*18px;[\s\S]*?line-height:\s*24px/);
  });

  it('.tp-hero-title desktop = rev2 細 day label 18px（大褐卡→細 label，v2.55.91）', () => {
    // rev2：day-header 大褐卡退場 → 細 day label；desktop override 18px（取代舊 mockup 28px）。
    expect(tokens).toMatch(/\.tp-hero-title\s*\{\s*font-size:\s*18px/);
    expect(tokens).not.toMatch(/\.tp-hero-title\s*\{\s*font-size:\s*(?:28|32)px/);
  });

  it('.tp-trip-card-eyebrow 對齊 mockup .tp-list-card-eyebrow 10px / 0.12em', () => {
    expect(tripsList).toMatch(/\.tp-trip-card-eyebrow\s*\{[\s\S]*?font-size:\s*var\(--font-size-eyebrow\)/);
    expect(tripsList).toMatch(/\.tp-trip-card-eyebrow\s*\{[\s\S]*?letter-spacing:\s*0\.12em/);
  });

  it('.tp-trip-card-title 對齊 mockup .tp-list-card-title 16px / lh 1.35', () => {
    expect(tripsList).toMatch(/\.tp-trip-card-title\s*\{[\s\S]*?font-size:\s*var\(--font-size-body\)/);
    expect(tripsList).toMatch(/\.tp-trip-card-title\s*\{[\s\S]*?line-height:\s*1\.35/);
  });

  it('NewTripPage h2 / page heading typography 對齊 mockup spec', () => {
    // 2026-05-03 modal-to-fullpage migration: 原本檢查 .tp-new-modal h2 + .tp-edit-modal h2
    // 共用 rule 在 _tripFormStyles.ts。EditTripPage / NewTripPage 都改全頁後沒 h2 inside
    // form pane (TitleBar 用 h1)，font-weight 規則由 TitleBar tokens.css 已 cover。
    // 此處改驗 NewTripPage 仍 import TRIP_FORM_STYLES 共用模組（保留 dedupe path）。
    expect(newTripPage).toContain('TRIP_FORM_STYLES');
    expect(tripFormStyles).toContain('--font-size-title');
  });

  it('AddStopPage 經 OperationShell 用共用 StackPanelHeader 處理 page heading (font-weight 700 token 治理)', () => {
    // 2026-05-03 modal-to-fullpage：page heading 由 chrome 統一 render，font-weight token 化。
    // rev2「6 條全接 → 手機也做」（2026-07-18）：AddStopPage 走 <OperationShell title=...>，
    // 兩形態（桌機 panel + 手機 drill-down）都用共用 StackPanelHeader（非 TitleBar）。
    // 驗 AddStopPage → OperationShell → StackPanelHeader 這條鏈 + heading weight 700 token 化。
    expect(addStopPage).toMatch(/import OperationShell from/);
    expect(addStopPage).toMatch(/<OperationShell[\s\S]*?title=/);
    expect(opShell).toMatch(/import StackPanelHeader from/);
    expect(opShell).toMatch(/<StackPanelHeader\s/);
    // StackPanelHeader 標題 weight 700（操作頁 heading 治理）
    const stackHeader = readFile('src/components/shell/StackPanelHeader.tsx');
    expect(stackHeader).toMatch(/tp-stack-head-title[\s\S]*?font-weight:\s*700/);
    // .tp-titlebar-title 700 仍在（走 TitleBar 的根頁/詳情用）
    expect(tokens).toMatch(/\.tp-titlebar-title\s*\{[\s\S]*?font-weight:\s*700/);
  });

  it('mobile bottom nav label 對齊 mockup section 02 11/14/700', () => {
    const labelBlock = bnav.match(/\.tp-global-bottom-nav-btn span\s*\{[\s\S]*?font-size:\s*var\(--font-size-caption2\)[\s\S]*?line-height:\s*14px[\s\S]*?font-weight:\s*700/);
    expect(labelBlock).not.toBeNull();
  });

  it('NewTripPage 取消按鈕用 inline SVG (Icon component) 不用 UTF-8 ✕', () => {
    // 2026-05-03 modal-to-fullpage migration: 原本驗 .tp-new-form-close X button
    // 改全頁後不需 close button (TitleBar 已有 back arrow)。改驗整個 NewTripPage
    // 不出現 ✕ UTF-8 字元（只允許在 comment / 文檔內），所有 close-style icon 走
    // <Icon name="x-mark" />。
    // Strip out comments first (`/* ... */` and `// ...`)
    const sourceWithoutComments = newTripPage
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');
    expect(sourceWithoutComments).not.toContain('✕');
  });
});
