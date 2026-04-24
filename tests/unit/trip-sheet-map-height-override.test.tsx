/**
 * TripSheet — sheet map height override 測試
 *
 * Bug：TripMapRail root .trip-map-rail 用 position:sticky + height:calc(100dvh - var(--spacing-nav-h))，
 * 此 CSS 假設 parent 是 main column scroll context。放進 TripSheet 後：
 * - sticky 在 sheet 內失效（sheet 是 grid cell，沒有 scrolling ancestor 提供 sticky 容器）
 * - calc(100dvh - nav-h) 是相對 viewport，不是 sheet 可用高度 → map 視覺上只佔約 1/4
 *
 * Fix：TripSheet SCOPED_STYLES 加 `.trip-sheet-body .trip-map-rail` override，
 * specificity (0,2,0) > .trip-map-rail (0,1,0)，覆蓋成 position:static + height:100%。
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TripSheet from '../../src/components/trip/TripSheet';

function renderSheet(initialUrl: string) {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <TripSheet tripId="test-trip" allPins={[]} pinsByDay={new Map()} />
    </MemoryRouter>,
  );
}

describe('TripSheet — sheet body 對 .trip-map-rail 的高度 override', () => {
  it('SCOPED_STYLES 應包含 .trip-sheet-body .trip-map-rail position:static 覆蓋（撤掉 sticky）', () => {
    const { container } = renderSheet('/trip/test-trip?sheet=map');
    const styleNode = container.querySelector('style');
    expect(styleNode, '應有 inline <style>').toBeTruthy();
    const css = styleNode!.textContent ?? '';
    expect(css, '需有 .trip-sheet-body .trip-map-rail 選擇器（specificity > .trip-map-rail）').toMatch(
      /\.trip-sheet-body\s+\.trip-map-rail/,
    );
    expect(css).toMatch(/position:\s*static/);
  });

  it('SCOPED_STYLES 應將 .trip-map-rail 高度覆蓋為 100%（取代 calc(100dvh - nav-h)）', () => {
    const { container } = renderSheet('/trip/test-trip?sheet=map');
    const css = container.querySelector('style')?.textContent ?? '';
    expect(css).toMatch(/\.trip-sheet-body\s+\.trip-map-rail[^}]*height:\s*100%/);
  });

  it('SCOPED_STYLES 應將 .trip-map-rail 的 top sticky offset 重設為 auto', () => {
    const { container } = renderSheet('/trip/test-trip?sheet=map');
    const css = container.querySelector('style')?.textContent ?? '';
    expect(css).toMatch(/\.trip-sheet-body\s+\.trip-map-rail[^}]*top:\s*auto/);
  });
});
