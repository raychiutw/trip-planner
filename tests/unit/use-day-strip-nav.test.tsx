/**
 * W9 · useDayStripNav — day strip 鍵盤 roving + wiring source-lock。
 *
 * 這個 hook 是 DayNav（行程明細）與 MapPage（地圖）day strip 共用的置中 + 鍵盤
 * 邏輯來源。行為測試鎖 ArrowLeft/Right roving（含邊界不繞回）；source-lock 確認
 * MapPage 真的把 hook 接上 nav（ref + onKeyDown + 每 tab testId），防未來重構把
 * 地圖的鍵盤/置中弄丟、與 DayNav 漂移。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useDayStripNav } from '../../src/hooks/useDayStripNav';

type Key = 'overview' | number;

function Harness({ activeKey, onPick }: { activeKey: Key; onPick: (k: Key) => void }) {
  const keys: Key[] = ['overview', 1, 2, 3];
  const { navRef, handleKeyDown } = useDayStripNav<Key>({
    keys,
    activeKey,
    onPick,
    testId: (k) => (k === 'overview' ? 'k-overview' : `k-${k}`),
  });
  return (
    <nav ref={navRef} onKeyDown={handleKeyDown} data-testid="strip">
      {keys.map((k) => (
        <button key={String(k)} data-testid={k === 'overview' ? 'k-overview' : `k-${k}`}>
          {String(k)}
        </button>
      ))}
    </nav>
  );
}

describe('useDayStripNav — roving 鍵盤', () => {
  it('ArrowRight 切到下一個 key', () => {
    const onPick = vi.fn();
    render(<Harness activeKey={1} onPick={onPick} />);
    fireEvent.keyDown(screen.getByTestId('strip'), { key: 'ArrowRight' });
    expect(onPick).toHaveBeenCalledWith(2);
  });

  it('ArrowLeft 切到上一個 key（含 overview）', () => {
    const onPick = vi.fn();
    render(<Harness activeKey={1} onPick={onPick} />);
    fireEvent.keyDown(screen.getByTestId('strip'), { key: 'ArrowLeft' });
    expect(onPick).toHaveBeenCalledWith('overview');
  });

  it('末尾 ArrowRight 不繞回（邊界）', () => {
    const onPick = vi.fn();
    render(<Harness activeKey={3} onPick={onPick} />);
    fireEvent.keyDown(screen.getByTestId('strip'), { key: 'ArrowRight' });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('開頭 ArrowLeft 不繞回（邊界）', () => {
    const onPick = vi.fn();
    render(<Harness activeKey="overview" onPick={onPick} />);
    fireEvent.keyDown(screen.getByTestId('strip'), { key: 'ArrowLeft' });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('非方向鍵不觸發切換', () => {
    const onPick = vi.fn();
    render(<Harness activeKey={1} onPick={onPick} />);
    fireEvent.keyDown(screen.getByTestId('strip'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByTestId('strip'), { key: 'a' });
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('W9 wiring source-lock — DayNav + MapPage 都接 hook', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8');

  it('DayNav 用 useDayStripNav，不留自家 scroll/keyboard 副本', () => {
    const src = read('src/components/trip/DayNav.tsx');
    expect(src).toMatch(/useDayStripNav/);
    // 舊的自家 handleKeyDown / scrollTo 已抽走
    expect(src).not.toMatch(/function handleKeyDown/);
    expect(src).not.toMatch(/nav\.scrollTo/);
  });

  it('MapPage day strip 掛 ref + onKeyDown + 每 tab testId', () => {
    const src = read('src/pages/MapPage.tsx');
    expect(src).toMatch(/useDayStripNav/);
    // nav 綁 hook 回傳的 ref 與 handler
    expect(src).toMatch(/ref=\{dayTabsRef\}/);
    expect(src).toMatch(/onKeyDown=\{onDayTabsKeyDown\}/);
    // 置中/移焦需要每個 tab 有 testId
    expect(src).toMatch(/testId="map-day-overview"/);
    expect(src).toMatch(/testId=\{`map-day-\$\{t\.dayNum\}`\}/);
  });
});
