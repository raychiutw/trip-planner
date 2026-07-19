/**
 * TripHealthCheckPage CTA redesign — regression for v2.33.118.
 *
 * Bug context: prod QA dark mode（mobile）截圖顯示 titlebar 右上的 sparkle
 * icon-only button (`TitleBarPrimaryAction is-primary`) 在 dark mode 下 brown
 * accent fill 與 chrome 不協調，icon 沒 label 看不出按下會做什麼。
 *
 * Redesign:
 *   - State 拆 2 個 CTA：
 *     • empty (entryCount=0) / idle (no report): titlebar 不顯 action；body 中央
 *       accent-filled pill button「開始 AI 健檢」當主 CTA
 *     • pending / completed / failed: titlebar ghost icon button (refresh-cw)，
 *       pending 時 spin，completed 加數字 badge 顯 findings 數量
 *   - 風格：ghost (`.tp-titlebar-action` 無 `.is-primary`) — 與其他 functional
 *     icon 同 family 但用 refresh-cw icon 區辨「重新生成」 action
 *   - Icon 換 sparkle → refresh-cw（lucide dual-arrow cycle，明確「重新生成」語意）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '../../src/pages/TripHealthCheckPage.tsx'),
  'utf8',
);
const ICON_SRC = readFileSync(
  join(__dirname, '../../src/components/shared/Icon.tsx'),
  'utf8',
);

describe('TripHealthCheckPage v2.33.118 CTA redesign (regression)', () => {
  it('Icon registry 加 refresh-cw (lucide dual-arrow)', () => {
    expect(ICON_SRC).toContain("'refresh-cw':");
    // 完整 path: 2 polylines (top-right + bottom-left arrows) + 1 path (curved cycle)
    const refreshCwLine = ICON_SRC.split('\n').find(l => l.includes("'refresh-cw':")) ?? '';
    expect(refreshCwLine).toContain('polyline points="23 4');
    expect(refreshCwLine).toContain('polyline points="1 20');
    expect(refreshCwLine).toContain('path d="M3.51 9');
  });

  it('titlebar action 改 conditional render — 只有 report 存在時顯（拔掉 idle/empty）', () => {
    // 老: actions={!initialLoading && (<TitleBarPrimaryAction .../>)}
    // 新: actions={!initialLoading && report && (<button class="tp-titlebar-action ...".../>)}
    expect(SRC).toMatch(/actions=\{!initialLoading && report && \(/);
    expect(SRC).not.toMatch(/TitleBarPrimaryAction/);
  });

  it('titlebar button 用 ghost style (.tp-titlebar-action) 而非 .is-primary', () => {
    // ghost = .tp-titlebar-action 無 .is-primary modifier
    expect(SRC).toContain('tp-titlebar-action tp-titlebar-action--icon-only tp-ai-health-titlebar-btn');
    // 鎖定 actions={...} block 內不能含 is-primary（其他 finding card 的 `.action.is-primary` 不受影響）
    const actionsBlock = SRC.match(/actions=\{[\s\S]+?\)\}/);
    expect(actionsBlock, 'titlebar actions block not found').toBeTruthy();
    expect(actionsBlock![0]).not.toContain('is-primary');
  });

  it('titlebar button 用 refresh-cw icon (非 sparkle)', () => {
    // titlebar action JSX (上面 conditional render 那段) 必含 Icon name="refresh-cw"
    const actionsBlock = SRC.match(/actions=\{[\s\S]+?\)\}/);
    expect(actionsBlock, 'titlebar actions block not found').toBeTruthy();
    expect(actionsBlock![0]).toContain('name="refresh-cw"');
    expect(actionsBlock![0]).not.toContain('name="sparkle"');
  });

  it('titlebar button pending 時 .is-spinning class trigger spin animation', () => {
    expect(SRC).toMatch(/isPending \? ' is-spinning' : ''/);
    expect(SRC).toMatch(/\.is-spinning \.svg-icon \{\s*animation: tp-ai-health-spin/);
    expect(SRC).toMatch(/@keyframes tp-ai-health-spin/);
  });

  it('v2.33.119: badge 已拔除（badge 跟 findings count 解耦，meta + body 已重複此資訊）', () => {
    // 拔除理由：AI 健檢頁面內 meta「共 N 項建議」+ findings list 已顯示數量，
    // titlebar badge 多餘 (孤兒 — 其他入口 TripCardMenu / trip card 也沒帶 badge)
    expect(SRC).not.toMatch(/tp-ai-health-titlebar-badge/);
    expect(SRC).not.toMatch(/hasResults && \(/);
  });

  it('idle/empty 改用 body CTA — accent-filled pill button + ai-health-start-btn testid', () => {
    // body CTA 必須在 .tp-ai-health-empty card 內、保留 ai-health-start-btn testid（E2E 連續性）
    expect(SRC).toMatch(/className="tp-ai-health-body-cta"/);
    // body CTA testid 仍是 ai-health-start-btn（避免 e2e 大改）
    const emptyCardBlock = SRC.match(/className="tp-ai-health-empty"[\s\S]+?<\/div>\s*\)\}/);
    expect(emptyCardBlock, 'empty card block not found').toBeTruthy();
    expect(emptyCardBlock![0]).toContain('data-testid="ai-health-start-btn"');
  });

  it('body CTA style: accent fill + radius-full pill + 14px+28px padding', () => {
    expect(SRC).toMatch(/\.tp-ai-health-body-cta \{[^}]*background: var\(--color-accent-fill\)/);
    expect(SRC).toMatch(/\.tp-ai-health-body-cta \{[^}]*border-radius: var\(--radius-full\)/);
    expect(SRC).toMatch(/\.tp-ai-health-body-cta \{[^}]*padding: 14px 28px/);
  });

  it('prefers-reduced-motion 關 spin animation（a11y）', () => {
    expect(SRC).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(SRC).toMatch(/\.tp-ai-health-titlebar-btn\.is-spinning \.svg-icon \{ animation: none; \}/);
  });
});
