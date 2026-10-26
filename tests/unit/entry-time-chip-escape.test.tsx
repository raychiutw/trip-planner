/**
 * Value: protects=時間編輯 popover 按 Esc 關閉並只存檔一次; fails_when=document 層 Esc listener 與 popup 的 onKeyDown 同時觸發而送兩次 PATCH，或 Esc 在焦點離開 popup 時沒反應; why_new=e2e 守門只驗「Esc 後 popup 消失」，看不到 PATCH 次數; seam=none; no_claim=真實時間選擇器互動（TripTimePicker 以按鈕替身）
 *
 * #1445 F17：EntryTimeChip 另加 document 層 Escape listener（焦點在 popup 外時 popup 自己的 onKeyDown 收不到）。
 * 風險是焦點在 popup 內時兩條路徑都吃到同一個 Esc → closeAndSave 跑兩次 → flushSave 兩次 PATCH。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const updateEntry = vi.fn();
vi.mock('../../src/lib/entryMutations', () => ({
  updateEntry: (...args: unknown[]) => updateEntry(...args),
}));
vi.mock('../../src/components/shared/Toast', () => ({ showToast: vi.fn() }));
// 時間選擇器以最小替身：一顆會把 draft 改成 10:00 的按鈕（本測試只關心 Esc 與存檔次數）。
vi.mock('../../src/components/TripTimePicker', () => ({
  TripTimePicker: ({ onChange, ariaLabel }: { onChange: (v: string) => void; ariaLabel?: string }) => (
    <button type="button" aria-label={ariaLabel} onClick={() => onChange('10:00')}>pick</button>
  ),
}));

import { EntryTimeChip } from '../../src/components/trip/EntryTimeChip';

function renderChip() {
  return render(<EntryTimeChip tripId="t1" entryId={7} dayNum={1} start="09:00" end="09:30" />);
}

async function openAndEdit() {
  fireEvent.click(screen.getByRole('button', { name: '編輯起訖時間' }));
  const dialog = await screen.findByRole('dialog', { name: '起訖時間' });
  fireEvent.click(screen.getByRole('button', { name: '抵達時間' })); // draft 改成 10:00，讓存檔有東西可送
  return dialog;
}

beforeEach(() => {
  updateEntry.mockReset();
  updateEntry.mockResolvedValue({ ok: true, recompute: Promise.resolve(true) });
});

describe('EntryTimeChip：Esc 關閉', () => {
  it('焦點在 popup 外（chip／body）時按 Esc → 關閉並存檔一次', async () => {
    renderChip();
    await openAndEdit();
    // 把焦點移出 popup，模擬「滑鼠點開後焦點仍在 chip」的情境。
    (screen.getByRole('button', { name: '編輯起訖時間' }) as HTMLElement).focus();
    await act(async () => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }); });
    expect(screen.queryByRole('dialog', { name: '起訖時間' })).toBeNull();
    expect(updateEntry).toHaveBeenCalledTimes(1);
  });

  it('焦點在 popup 內時按 Esc → 關閉且只存檔一次（不被 document listener 重複觸發）', async () => {
    renderChip();
    const dialog = await openAndEdit();
    await act(async () => { fireEvent.keyDown(dialog, { key: 'Escape' }); });
    expect(screen.queryByRole('dialog', { name: '起訖時間' })).toBeNull();
    expect(updateEntry).toHaveBeenCalledTimes(1);
  });

  it('Esc 事件目標在內層時間選擇器的 popover（.tp-time-popover）內 → 不關閉外層 popup', async () => {
    renderChip();
    await openAndEdit();
    const inner = document.createElement('div');
    inner.className = 'tp-time-popover';
    document.body.appendChild(inner);
    await act(async () => { fireEvent.keyDown(inner, { key: 'Escape' }); });
    expect(screen.queryByRole('dialog', { name: '起訖時間' })).not.toBeNull();
    expect(updateEntry).not.toHaveBeenCalled();
    inner.remove();
  });
});
