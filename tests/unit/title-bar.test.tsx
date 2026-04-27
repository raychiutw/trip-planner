/**
 * TitleBar — V2 Terracotta page chrome primitive.
 *
 * 取代 mockup 涵蓋 6 主功能頁的 PageHeader 用法（Chat / Trips / Trip detail /
 * Map / Explore / Account）。簡化 API：title / back / actions / backLabel，
 * 無 eyebrow / meta / variant / align（splash 子頁繼續用 PageHeader，見 design.md D1）。
 *
 * 視覺對應：docs/design-sessions/terracotta-preview-v2.html sections 13-20
 *           docs/design-sessions/2026-04-27-unified-layout-plan.md TitleBar 表格
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import TitleBar from '../../src/components/shell/TitleBar';

describe('TitleBar — 基本渲染', () => {
  it('傳 title string：渲染 <h1> 含 title 文字', () => {
    const { getByRole } = render(<TitleBar title="我的行程" />);
    const heading = getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('我的行程');
  });

  it('傳 title ReactNode：支援 inline JSX（accent span）', () => {
    const { getByRole } = render(
      <TitleBar
        title={
          <>
            行程 <span data-testid="trip-name">沖繩 5 日</span>
          </>
        }
      />,
    );
    expect(getByRole('heading', { level: 1 }).textContent).toContain('沖繩 5 日');
  });

  it('預設不渲染 eyebrow / meta（mockup 規定單行 chrome）', () => {
    const { container } = render(<TitleBar title="地圖" />);
    expect(container.querySelector('.tp-page-header-eyebrow')).toBeNull();
    expect(container.querySelector('.tp-page-header-meta')).toBeNull();
  });

  it('header 有 sticky chrome class 標記（CSS 由 tokens.css 套用 sticky / glass）', () => {
    const { container } = render(<TitleBar title="探索" />);
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(header!.getAttribute('data-titlebar')).toBe('true');
  });
});

describe('TitleBar — back button', () => {
  it('傳 back callback：渲染左側返回 button + 預設 aria-label「返回」', () => {
    const onBack = vi.fn();
    const { getByLabelText } = render(<TitleBar title="行程詳情" back={onBack} />);
    const button = getByLabelText('返回');
    expect(button).not.toBeNull();
    expect(button.tagName).toBe('BUTTON');
  });

  it('back button 點擊觸發 callback', () => {
    const onBack = vi.fn();
    const { getByLabelText } = render(<TitleBar title="行程詳情" back={onBack} />);
    (getByLabelText('返回') as HTMLButtonElement).click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('傳 backLabel 覆蓋 aria-label', () => {
    const { getByLabelText } = render(
      <TitleBar title="X" back={() => {}} backLabel="返回行程列表" />,
    );
    expect(getByLabelText('返回行程列表')).not.toBeNull();
  });

  it('無 back prop：不渲染返回 button', () => {
    const { container } = render(<TitleBar title="聊天" />);
    expect(container.querySelector('button[aria-label="返回"]')).toBeNull();
  });
});

describe('TitleBar — actions slot', () => {
  it('傳 actions：渲染右側 actions 容器', () => {
    const { container, getByText } = render(
      <TitleBar
        title="我的行程"
        actions={
          <>
            <button type="button">搜尋</button>
            <button type="button">新增</button>
          </>
        }
      />,
    );
    expect(getByText('搜尋')).not.toBeNull();
    expect(getByText('新增')).not.toBeNull();
    const actionsSlot = container.querySelector('.tp-page-header-actions');
    expect(actionsSlot).not.toBeNull();
  });

  it('無 actions prop：不渲染 actions 容器', () => {
    const { container } = render(<TitleBar title="帳號" />);
    expect(container.querySelector('.tp-page-header-actions')).toBeNull();
  });
});
