import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TriplineLogo from '../../src/components/shared/TriplineLogo';

function renderLogo(isOnline: boolean) {
  return render(
    <MemoryRouter>
      <TriplineLogo isOnline={isOnline} />
    </MemoryRouter>
  );
}

describe('TriplineLogo — Link to "/"', () => {
  it('online=true: 最外層 render 為 <a> element（由 react-router Link 產生）', () => {
    const { container } = renderLogo(true);
    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
  });

  it('online=true: href === "/"', () => {
    const { container } = renderLogo(true);
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('/');
  });

  it('online=true: aria-label 包含 "Tripline"', () => {
    const { container } = renderLogo(true);
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('aria-label')).toMatch(/Tripline/);
  });

  it('online=false: 仍 render 為 <a>（離線仍可點回首頁）', () => {
    const { container } = renderLogo(false);
    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
  });

  it('online=false: href 仍 === "/"', () => {
    const { container } = renderLogo(false);
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('/');
  });

  it('online=false: aria-label 包含 "Tripline"', () => {
    const { container } = renderLogo(false);
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('aria-label')).toMatch(/Tripline/);
  });

  it('視覺結構保留：內含 tripline-logo class', () => {
    const { container } = renderLogo(true);
    // Link 本身不加 tripline-logo，但可保留在 inner span 或 Link 上
    // 只要視覺 class 存在即可
    expect(container.innerHTML).toContain('tripline-logo');
  });
});
