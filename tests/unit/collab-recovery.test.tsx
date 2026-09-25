import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import CollabPage from '../../src/pages/CollabPage';

const user = { id: 'owner', email: 'owner@example.com', displayName: 'Ray' };
const member = { id: 2, email: 'member@example.com', displayName: '旅伴', tripId: 'A', role: 'member', userId: 'member' };
const invitation = { id: 'hash', invitedEmail: 'pending@example.com', createdAt: '', expiresAt: '', daysRemaining: 3, isExpired: false };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let http: ReturnType<typeof vi.fn>;
let members = [member];
let pending = [invitation];
function defaultRead(path: string) {
  if (path.includes('userinfo')) return reply(user);
  if (path.includes('/permissions?')) return reply(members.map(p => ({ ...p, tripId: new URL(path, 'https://app.test').searchParams.get('tripId') }))); 
  if (path.includes('/invitations?')) return reply({ items: pending });
  if (/\/api\/trips\/[AB]$/.test(path)) return reply({ tripId: path.endsWith('B') ? 'B' : 'A', title: path.endsWith('B') ? '旅程 B' : '旅程 A' });
  return reply([]);
}
function Destination() { const l = useLocation(); return <output>{l.pathname + l.search}</output>; }
function Harness() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate('/trip/B/collab')}>Trip B</button><Routes>
    <Route path='/trip/:tripId/collab' element={<CollabPage />} />
    <Route path='*' element={<Destination />} />
  </Routes></>;
}
function setup() { render(<MemoryRouter initialEntries={['/trip/A/collab']}><Harness /></MemoryRouter>); }
beforeEach(() => {
  members = [member]; pending = [invitation];
  http = vi.fn(async (path: string) => defaultRead(path)); vi.stubGlobal('fetch', http); vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());
const writes = () => http.mock.calls.filter(([, opts]) => opts?.method && opts.method !== 'GET');

it.each(['member', 'viewer'])('%s 不顯示不可使用的管理操作，說明三種角色能力', async (role) => {
  http.mockImplementation(async (path: string) => path.includes('userinfo') ? reply({ ...user, id: role, email: `${role}@example.com` }) : /permissions\?|invitations\?/.test(path) ? reply({}, 403) : defaultRead(path));
  setup(); await screen.findByRole('alert');
  expect(screen.queryByTestId('collab-add-submit')).toBeNull();
  expect(screen.getByTestId('collab-panel')).toHaveTextContent('只有行程擁有者可以管理旅伴');
  expect(screen.getByTestId('collab-panel')).toHaveTextContent('檢視成員');
  expect(screen.getByRole('heading', { name: '旅程 A' })).toBeVisible();
});
it('切換行程不保留舊名稱或 email；metadata 可重讀，返回對應行程', async () => {
  let failed = true;
  http.mockImplementation(async (path: string) => path === '/api/trips/B' && failed ? reply({}, 500) : defaultRead(path));
  setup(); await screen.findByRole('heading', { name: '旅程 A' });
  fireEvent.change(await screen.findByTestId('collab-add-email'), { target: { value: 'draft@example.com' } });
  fireEvent.click(screen.getByText('Trip B'));
  expect(await screen.findByText(/無法載入行程名稱/)).toBeVisible();
  expect(screen.queryByRole('heading', { name: '旅程 A' })).toBeNull();
  expect(screen.getByRole('heading', { name: '行程 B' })).toBeVisible();
  expect(screen.getByTestId('collab-add-email')).toHaveValue('');
  failed = false; fireEvent.click(screen.getByRole('button', { name: '重試行程名稱' }));
  await screen.findByRole('heading', { name: '旅程 B' });
  fireEvent.click(screen.getByRole('button', { name: '返回上一層' }));
  expect(await screen.findByText('/trips?selected=B')).toBeVisible();
});
it('新增等待只送一次；失敗保留 email 和角色，重試僅在服務端確認後清空', async () => {
  let finish!: (response: Response) => void;
  http.mockImplementation((path: string, opts?: RequestInit) => opts?.method === 'POST' ? new Promise<Response>(r => { finish = r; }) : Promise.resolve(defaultRead(path)));
  setup(); const email = await screen.findByTestId('collab-add-email');
  fireEvent.change(email, { target: { value: 'guest@example.com' } }); fireEvent.click(screen.getByTestId('collab-add-role-viewer'));
  const submit = screen.getByTestId('collab-add-submit');
  act(() => { submit.click(); submit.click(); }); expect(writes()).toHaveLength(1);
  await act(async () => finish(reply({ error: { message: '稍後再試' } }, 503)));
  expect(await screen.findByRole('alert')).toHaveTextContent('系統發生錯誤'); expect(email).toHaveValue('guest@example.com');
  fireEvent.click(submit); expect(JSON.parse(writes()[1][1].body)).toEqual({ email: 'guest@example.com', role: 'viewer', tripId: 'A' });
  await act(async () => finish(reply({ ok: true, status: 'invitation_sent', email: 'guest@example.com' }, 201)));
  expect(email).toHaveValue(''); expect(screen.getByRole('status')).toHaveTextContent('已建立');
  expect(screen.queryByText(/邀請信已寄至/)).toBeNull();
});
it('待接受邀請讀取失敗可重試，不假裝沒有邀請或丟失已知名單', async () => {
  let failed = true;
  http.mockImplementation(async (path: string) => path.includes('/invitations?') && failed ? reply({}, 500) : defaultRead(path));
  setup(); expect(await screen.findByText('member@example.com')).toBeVisible();
  expect(await screen.findByRole('alert')).toHaveTextContent('待接受邀請');
  failed = false; fireEvent.click(screen.getByRole('button', { name: '重試旅伴清單' }));
  expect(await screen.findByText('pending@example.com')).toBeVisible();
});
it.each(['移除', '撤銷'])('%s 失敗保留原項目和確認視窗，重試成功後焦點有落點', async (action) => {
  let fail = true;
  http.mockImplementation(async (path: string, opts?: RequestInit) => {
    if (opts?.method) {
      if (fail) return reply({ error: { message: '操作失敗，請重試' } }, 500);
      if (action === '移除') members = []; else pending = [];
      return reply({ ok: true, revoked: 1 });
    }
    return defaultRead(path);
  });
  setup(); const opener = await screen.findByRole('button', { name: action === '移除' ? '移除 member@example.com' : '撤銷對 pending@example.com 的邀請' });
  opener.focus(); fireEvent.click(opener);
  fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
  const dialog = screen.getByRole('alertdialog');
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('系統發生錯誤');
  expect(screen.getByText(action === '移除' ? 'member@example.com' : 'pending@example.com')).toBeVisible();
  fail = false; fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
  await screen.findByRole('status');
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.getByTestId('collab-panel')).toHaveFocus();
});
it('確認寫入後清單更新失敗只重讀，不重送邀請', async () => {
  let posted = false; let readFail = true;
  http.mockImplementation(async (path: string, opts?: RequestInit) => {
    if (opts?.method === 'POST') { posted = true; return reply({ ok: true, status: 'invitation_sent' }, 201); }
    if (posted && readFail && path.includes('/permissions?')) return reply({}, 503);
    return defaultRead(path);
  });
  setup(); fireEvent.change(await screen.findByTestId('collab-add-email'), { target: { value: 'new@example.com' } });
  fireEvent.click(screen.getByTestId('collab-add-submit'));
  expect(await screen.findByRole('alert')).toHaveTextContent('清單');
  expect(screen.getByText('member@example.com')).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('已建立');
  readFail = false; fireEvent.click(screen.getByRole('button', { name: '重試旅伴清單' }));
  await screen.findByTestId('collab-add-submit'); expect(writes()).toHaveLength(1);
});
it('舊行程的新增回覆不清除新行程輸入，也不顯示成功', async () => {
  let finish!: (response: Response) => void;
  http.mockImplementation((path: string, opts?: RequestInit) => opts?.method === 'POST' ? new Promise<Response>(r => { finish = r; }) : Promise.resolve(defaultRead(path)));
  setup(); fireEvent.change(await screen.findByTestId('collab-add-email'), { target: { value: 'a@example.com' } }); fireEvent.click(screen.getByTestId('collab-add-submit'));
  fireEvent.click(screen.getByText('Trip B')); await screen.findByRole('heading', { name: '旅程 B' });
  fireEvent.change(await screen.findByTestId('collab-add-email'), { target: { value: 'b@example.com' } });
  await act(async () => finish(reply({ ok: true, status: 'invitation_sent' }, 201)));
  expect(screen.getByTestId('collab-add-email')).toHaveValue('b@example.com'); expect(screen.queryByRole('status')).toBeNull();
});
it('不完整的成功回覆不可當成邀請成功', async () => {
  http.mockImplementation(async (path: string, opts?: RequestInit) => opts?.method ? reply({}, 201) : defaultRead(path));
  setup(); fireEvent.change(await screen.findByTestId('collab-add-email'), { target: { value: 'new@example.com' } }); fireEvent.click(screen.getByTestId('collab-add-submit'));
  expect(await screen.findByRole('alert')).toHaveTextContent('未能確認'); expect(screen.getByTestId('collab-add-email')).toHaveValue('new@example.com');
});

it('角色變更失敗保留舊角色；成功回覆後才呈現新角色', async () => {
  let failed = true;
  http.mockImplementation(async (path: string, opts?: RequestInit) => {
    if (opts?.method === 'PATCH') {
      if (failed) return reply({}, 503);
      members = [{ ...member, role: 'viewer' }]; return reply({ ok: true, role: 'viewer' });
    }
    return defaultRead(path);
  });
  setup(); const trigger = await screen.findByTestId('collab-role-trigger-2');
  fireEvent.click(trigger); fireEvent.click(screen.getByTestId('collab-role-option-2-viewer'));
  await screen.findByRole('alert'); expect(trigger).toHaveTextContent('共編成員');
  failed = false; fireEvent.click(trigger); fireEvent.click(screen.getByTestId('collab-role-option-2-viewer'));
  expect(await screen.findByRole('status')).toHaveTextContent('已改為檢視成員'); expect(trigger).toHaveTextContent('檢視成員');
});
it('伺服器不可管理時沒有寫入操作；登入讀取失敗可恢復', async () => {
  let authFailed = true;
  http.mockImplementation(async (path: string) => path.includes('userinfo') && authFailed ? reply({}, 503) : defaultRead(path));
  setup(); const page = within(screen.getByTestId('collab-page'));
  expect(await page.findByRole('button', { name: '重試登入狀態' })).toBeVisible();
  expect(screen.queryByTestId('collab-add-submit')).toBeNull(); authFailed = false;
  fireEvent.click(page.getByRole('button', { name: '重試登入狀態' }));
  expect(await screen.findByTestId('collab-add-submit')).toBeVisible(); expect(writes()).toHaveLength(0);
});
