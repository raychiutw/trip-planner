/**
 * W14 · RefreshContext — per-view soft-refresh 契約。
 *
 * 下拉刷新從整頁 reload 改成呼叫目前頁登記的 refetch（就地重抓、位置保留）；沒登記
 * 的頁面 fall back reload（零回歸）。這裡鎖：登記的 refetch 會被 run() 呼叫、unmount
 * 後清除、無登記時 run() 走 reload、無 Provider 時 runner 也退回 reload。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RefreshProvider, useRegisterRefresh, useRefreshRunner } from '../../src/contexts/RefreshContext';

afterEach(cleanup);

const read = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8');

function Page({ refetch }: { refetch: () => Promise<void> | void }) {
  useRegisterRefresh(refetch);
  return <div>page</div>;
}

function Runner() {
  const run = useRefreshRunner();
  return <button onClick={() => void run()} data-testid="run">run</button>;
}

describe('RefreshContext', () => {
  it('run() 呼叫目前頁登記的 refetch（不 reload）', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    render(
      <RefreshProvider>
        <Page refetch={refetch} />
        <Runner />
      </RefreshProvider>,
    );
    fireEvent.click(screen.getByTestId('run'));
    await Promise.resolve();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('頁面 unmount 後清除登記 → run() 走 reload fallback', async () => {
    const reload = vi.fn();
    const orig = window.location;
    Object.defineProperty(window, 'location', { value: { ...orig, reload }, writable: true });
    try {
      const { rerender } = render(
        <RefreshProvider>
          <Page refetch={vi.fn()} />
          <Runner />
        </RefreshProvider>,
      );
      // 拿掉 Page（unmount）→ 登記清除
      rerender(
        <RefreshProvider>
          <Runner />
        </RefreshProvider>,
      );
      fireEvent.click(screen.getByTestId('run'));
      await Promise.resolve();
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', { value: orig, writable: true });
    }
  });

  it('無 Provider 時 runner 退回 reload（不崩）', async () => {
    const reload = vi.fn();
    const orig = window.location;
    Object.defineProperty(window, 'location', { value: { ...orig, reload }, writable: true });
    try {
      render(<Runner />);
      fireEvent.click(screen.getByTestId('run'));
      await Promise.resolve();
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', { value: orig, writable: true });
    }
  });
});

describe('W14 wiring source-lock', () => {
  it('AppShell 下拉刷新走 useRefreshRunner，不再硬 location.reload', () => {
    const src = read('src/components/shell/AppShell.tsx');
    expect(src).toMatch(/useRefreshRunner/);
    expect(src).toMatch(/usePullToRefresh\(mainRef, runRefresh\)/);
    // onRefresh 內原本的 window.location.reload 已移除（reload 只剩 RefreshContext fallback）
    expect(src).not.toMatch(/window\.location\.reload/);
  });

  it('usePullToRefresh 支援 async + 回傳 failed', () => {
    const src = read('src/hooks/usePullToRefresh.ts');
    expect(src).toMatch(/onRefresh:\s*\(\)\s*=>\s*void\s*\|\s*Promise<void>/);
    expect(src).toMatch(/await onRefreshRef\.current\(\)/);
    expect(src).toMatch(/return \{ pullPx, refreshing, failed \}/);
  });

  it('PoiFavoritesPage 登記 soft-refetch（不翻 loading skeleton）', () => {
    const src = read('src/pages/PoiFavoritesPage.tsx');
    expect(src).toMatch(/useRegisterRefresh\(softRefetch\)/);
    // soft-refetch 不呼叫 setStatus('loading')（保留舊內容）
    const soft = src.match(/const softRefetch = useCallback[\s\S]*?\}, \[\]\);/)?.[0] ?? '';
    expect(soft).not.toMatch(/setStatus\('loading'\)/);
  });

  it('main.tsx 掛 RefreshProvider（route table 祖先）', () => {
    const src = read('src/entries/main.tsx');
    expect(src).toMatch(/<RefreshProvider>/);
    expect(src).toMatch(/import \{ RefreshProvider \}/);
  });
});
