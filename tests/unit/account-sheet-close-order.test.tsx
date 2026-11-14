/**
 * 關閉帳號 sheet 必須「只導回背景、由路徑離開 /account 後的 effect 清 flag」（#1691 後的回歸）：
 * router 導覽是非同步的，若這裡先清 flag，會有一個 render 是 open=false 但 path 仍 /account，主 <Routes> 會短暫 render 全頁 AccountPage
 * （現在會立刻畫出殼層與側邊欄、含同 id 的帳號卡），焦點還原搶到這張暫時的卡，隨後它被卸載、焦點掉到 body；
 * 背景頁也被無謂地 unmount／mount。
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const calls: string[] = [];
const navigateMock = vi.fn((...a: unknown[]) => { calls.push('navigate:' + String(a[0])); });
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigateMock }));
vi.mock('../../src/contexts/AccountSheetContext', () => ({
  useAccountSheet: () => ({ open: true, bg: { pathname: '/trips', search: '', hash: '' }, closeSheet: () => calls.push('closeSheet'), openSheet: () => {} }),
}));

import AccountSheet from '../../src/components/shell/AccountSheet';

describe('AccountSheet 關閉順序', () => {
  it('只 navigate 回背景，不直接 closeSheet', () => {
    calls.length = 0;
    render(<MemoryRouter><AccountSheet><div>內容</div></AccountSheet></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '關閉' }));
    expect(calls).toEqual(['navigate:/trips']);
  });
});
