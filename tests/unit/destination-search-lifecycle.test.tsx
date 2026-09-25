import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { usePoiSearch } from '../../src/hooks/usePoiSearch';
import NewTripPage from '../../src/pages/NewTripPage';
import EditTripPage from '../../src/pages/EditTripPage';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';

const response = (body: unknown, status=200) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
let search: (url: URL) => Promise<Response>;
beforeEach(() => {
  localStorage.clear();
  search = async () => response({results:[]});
  vi.stubGlobal('fetch',vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input),'https://test');
    if (url.pathname === '/api/oauth/userinfo') return response({id:'owner',email:'owner@test.com'});
    if (url.pathname === '/api/poi-search') return search(url);
    if (url.pathname === '/api/trips/t1') return response({id:'t1',name:'Existing trip',countries:'JP',lang:'zh-TW'});
    return response([]);
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function openPage(edit = false) {
  render(<MemoryRouter initialEntries={[edit ? '/trip/t1/edit' : '/trips/new']}><ActiveTripProvider><Routes>
    <Route path="/trips/new" element={<NewTripPage/>}/><Route path="/trip/:tripId/edit" element={<EditTripPage/>}/>
  </Routes></ActiveTripProvider></MemoryRouter>);
  if(edit) fireEvent.click(await screen.findByTestId('edit-trip-dest-add-btn'));
  const input = await screen.findByTestId(edit ? 'edit-trip-dest-search-input' : 'new-trip-destination-input');
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
  return input;
}
async function tick() { await act(async () => { await vi.advanceTimersByTimeAsync(350); }); }
it('建立行程搜尋成功但零結果時，顯示可辨識的空結果', async () => {
  const input = await openPage();
  fireEvent.change(input,{target:{value:'不存在的城市'}});
  await tick();
  expect(screen.getByText('沒找到結果，試試別的關鍵字')).toBeInTheDocument();
});


it('query A→B→A 必須重新讀取，不回顯前一輪 A 結果', async () => {
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
  const poi = {place_id:'tokyo',name:'東京',lat:35,lng:139};
  search = async () => response([poi]);
  const {result,rerender} = renderHook(({query}) => usePoiSearch({query}),{initialProps:{query:'東京'}});
  await tick();
  expect(result.current.results).toEqual([poi]);
  rerender({query:'大阪'});
  rerender({query:'東京'});
  expect(result.current.status).toBe('loading');
  expect(result.current.results).toEqual([]);
});

it.each([false,true])('目的地頁面 edit=%s：失敗能重試並保留已選目的地', async (edit) => {
  const tokyo = {place_id:'tokyo',name:'Tokyo destination',lat:35,lng:139};
  search = async () => response({results:[tokyo]});
  let input = await openPage(edit);
  fireEvent.change(input,{target:{value:'東京'}});
  await tick();
  fireEvent.click(screen.getByRole('option',{name:'Tokyo destination'}));
  expect(within(screen.getByTestId(edit ? 'edit-trip-dest-rows' : 'new-trip-destination-rows')).getByText('Tokyo destination')).toBeInTheDocument();
  if(edit) {
    fireEvent.click(screen.getByTestId('edit-trip-dest-add-btn'));
    input = screen.getByTestId('edit-trip-dest-search-input');
  }
  search = async () => response({},503);
  fireEvent.change(input,{target:{value:'大阪'}});
  await tick();
  expect(within(screen.getByTestId(edit ? 'edit-trip-dest-dropdown' : 'new-trip-dest-dropdown')).getByRole('alert')).toHaveTextContent('搜尋失敗');
  expect(screen.queryByText('沒找到結果，試試別的關鍵字')).not.toBeInTheDocument();
  expect(within(screen.getByTestId(edit ? 'edit-trip-dest-rows' : 'new-trip-destination-rows')).getByText('Tokyo destination')).toBeInTheDocument();
  search = async () => response({results:[]});
  fireEvent.click(screen.getByRole('button',{name:'重試搜尋'}));
  expect(within(screen.getByTestId(edit ? 'edit-trip-dest-dropdown' : 'new-trip-dest-dropdown')).queryByRole('alert')).not.toBeInTheDocument();
  await tick();
  expect(screen.getByText('沒找到結果，試試別的關鍵字')).toBeInTheDocument();
  expect(within(screen.getByTestId(edit ? 'edit-trip-dest-rows' : 'new-trip-destination-rows')).getByText('Tokyo destination')).toBeInTheDocument();
});

it.each(['region','disabled','short'] as const)('切換 %s 後忽略舊搜尋錯誤，狀態只屬於目前範圍', async (change) => {
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
  let finish!: (response:Response) => void;
  search = async () => new Promise(resolve => { finish = resolve; });
  const {result,rerender} = renderHook(props => usePoiSearch(props),
    {initialProps:{query:'東京',region:'JP',enabled:true}});
  await tick();
  rerender({query:change === 'short' ? '東' : '東京',region:change === 'region' ? 'TW' : 'JP',enabled:change !== 'disabled'});
  await act(async () => { finish(response({},503)); });
  expect(result.current.error).toBeNull();
  expect(result.current.results).toEqual([]);
  expect(result.current.status).toBe(change === 'region' ? 'loading' : 'idle');
});
