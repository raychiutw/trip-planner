/**
 * W13 拖拉排序 a11y — ⋯ menu「上移一格/下移一格」source-lock。
 *
 * VoiceOver/TalkBack 觸控無法模擬拖曳，故提供不靠拖曳的替代排序（HIG 拖拉 a11y）。
 * 鎖住：兩個 menu item 存在 + 邊界條件（首列無上移、末列無下移）+ 與拖曳共用同一落地路徑
 * （applyReorder），防未來重構把 a11y 路徑弄丟或讓兩路徑行為漂移。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, '../../src/components/trip/TimelineRail.tsx'), 'utf8');

describe('W13 ⋯ menu 上移/下移一格（拖拉 a11y 替代路徑）', () => {
  it('上移一格：首列不顯（index > 0 才塞）+ 有 testid', () => {
    expect(SRC).toMatch(/index > 0[\s\S]{0,160}上移一格[\s\S]{0,160}timeline-rail-move-up/);
  });

  it('下移一格：末列不顯（!isLast 才塞）+ 有 testid', () => {
    expect(SRC).toMatch(/!isLast[\s\S]{0,160}下移一格[\s\S]{0,160}timeline-rail-move-down/);
  });

  it('moveEntryStep 與拖曳（handleDragEnd）共用 applyReorder — 落地行為一致、不漂移', () => {
    expect(SRC).toMatch(/const applyReorder = useCallback/);
    expect(SRC).toMatch(/const moveEntryStep = useCallback[\s\S]*?applyReorder\(/);
    expect(SRC).toMatch(/handleDragEnd[\s\S]*?await applyReorder\(/);
  });

  it('走既有 batch endpoint（非另開），payload 為 sort_order', () => {
    expect(SRC).toMatch(/applyReorder[\s\S]*?\/entries\/batch/);
    expect(SRC).toMatch(/sort_order: idx/);
  });
});
