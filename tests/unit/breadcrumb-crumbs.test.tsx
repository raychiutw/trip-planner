import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import BreadcrumbCrumbs from '../../src/components/shared/BreadcrumbCrumbs';

afterEach(() => cleanup());

describe('BreadcrumbCrumbs', () => {
  it('空 parts 陣列不渲染任何內容', () => {
    const { container } = render(<BreadcrumbCrumbs parts={[]} classPrefix="bc" />);
    expect(container.firstChild).toBeNull();
  });

  it('單一 part 不顯示分隔符', () => {
    const { container, queryByText } = render(
      <BreadcrumbCrumbs parts={['DAY 02']} classPrefix="bc" />,
    );
    expect(queryByText('DAY 02')).toBeTruthy();
    expect(container.querySelectorAll('.bc-sep').length).toBe(0);
  });

  it('多個 parts 在之間插入 N-1 個分隔符', () => {
    const { container } = render(
      <BreadcrumbCrumbs parts={['DAY 02', '7/27', '14:30']} classPrefix="bc" />,
    );
    expect(container.querySelectorAll('.bc-sep').length).toBe(2);
  });

  it('分隔符標記 aria-hidden', () => {
    const { container } = render(
      <BreadcrumbCrumbs parts={['A', 'B']} classPrefix="bc" />,
    );
    const sep = container.querySelector('.bc-sep');
    expect(sep?.getAttribute('aria-hidden')).toBe('true');
  });

  it('只有第一個 part 取得 day class', () => {
    const { container } = render(
      <BreadcrumbCrumbs parts={['A', 'B', 'C']} classPrefix="x" />,
    );
    expect(container.querySelectorAll('.x-day').length).toBe(1);
    expect(container.querySelector('.x-day')?.textContent).toBe('A');
  });

  it('classPrefix 正確地串入所有 class', () => {
    const { container } = render(
      <BreadcrumbCrumbs parts={['A', 'B']} classPrefix="custom" />,
    );
    expect(container.querySelector('.custom-day')).toBeTruthy();
    expect(container.querySelector('.custom-sep')).toBeTruthy();
    // 不應產生其他前綴
    expect(container.querySelector('.bc-day')).toBeNull();
  });
});
