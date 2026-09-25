import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import EntryActionPage from '../../src/pages/EntryActionPage';
import { __resetTravelRecomputeState } from '../../src/lib/travelRecompute';
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status});
const days = [{id:71,dayNum:1,date:'2026-09-25',timeline:[]},{id:72,dayNum:2,date:'2026-09-26',timeline:[]}];
let http: ReturnType<typeof vi.fn>;
function read(path: string) {
  if (path.includes('userinfo')) return reply({id:'owner',email:'owner@example.com'});
  if (path.includes('/days')) return reply(days);
  if (path.includes('/entries/')) return reply({id:42,dayId:71});
  return reply([]);
}
function setup(action: 'copy'|'move', id='42') {
 const router=createMemoryRouter([
  {path:'/trip/:tripId/stop/:entryId/'+action,element:<EntryActionPage action={action}/>},
  {path:'*',element:<p>已離開操作頁</p>},
 ],{initialEntries:['/trips',`/trip/t1/stop/${id}/${action}`]});
 render(<RouterProvider router={router}/>); return router;
}
beforeEach(()=>{
 __resetTravelRecomputeState();vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 http=vi.fn(async(p:string,o?:RequestInit)=>o?.method ? reply({id:77}):read(p));vi.stubGlobal('fetch',http);
});
afterEach(()=>vi.unstubAllGlobals());
const writes=()=>http.mock.calls.filter(([p,o])=>o?.method && p.includes('/entries/'));
it('accepted copy stays recoverable after traffic failure and cannot be submitted twice',async()=>{
 let traffic=0;
 http.mockImplementation(async(p:string,o?:RequestInit)=>p.includes('recompute') ? reply({},++traffic===1?503:200):o?.method?reply({id:77}):read(p));
 setup('copy');fireEvent.click(await screen.findByTestId('entry-action-day-2'));
 const submit=screen.getByTestId('entry-action-confirm');act(()=>{submit.click();submit.click();});
 expect(await screen.findByText(/景點已複製.*交通/)).toBeVisible();expect(writes()).toHaveLength(1);
 expect(screen.getByTestId('entry-action-day-1')).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'重試交通更新'}));
 expect(await screen.findByText('已離開操作頁')).toBeVisible();expect(writes()).toHaveLength(1);expect(traffic).toBe(2);
});
it('days failure is retryable and invalid source metadata never enables a write',async()=>{
 let broken=true;
 http.mockImplementation(async(p:string)=>p.includes('/days')&&broken?reply({},503):read(p));setup('move');
 fireEvent.click(await screen.findByRole('button',{name:'重新載入日期'}));expect(writes()).toHaveLength(0);
 broken=false;fireEvent.click(await screen.findByRole('button',{name:'重新載入日期'}));
 expect(await screen.findByTestId('entry-action-day-1')).toBeDisabled();fireEvent.click(screen.getByTestId('entry-action-day-2'));
 expect(screen.getByTestId('entry-action-confirm')).toBeEnabled();
});
it('same-day copy preserves the selected preset in the single write',async()=>{
 setup('copy');fireEvent.click(await screen.findByTestId('entry-action-day-1'));
 fireEvent.click(screen.getByRole('button',{name:'複製到時段'}));fireEvent.click(await screen.findByRole('option',{name:/午餐/}));
 fireEvent.click(screen.getByTestId('entry-action-confirm'));
 await waitFor(()=>expect(writes()).toHaveLength(1));expect(JSON.parse(writes()[0][1].body)).toMatchObject({targetDayId:71,time:'12:00-13:30'});
});
it('409 preserves the destination for an explicit retry without claiming success',async()=>{
 let attempts=0;http.mockImplementation(async(p:string,o?:RequestInit)=>o?.method?reply({error:{message:'日期已變更，請再確認'}},++attempts===1?409:200):read(p));
 setup('move');fireEvent.click(await screen.findByTestId('entry-action-day-2'));fireEvent.click(screen.getByTestId('entry-action-confirm'));
 expect(await screen.findByText('日期已變更，請再確認')).toBeVisible();expect(screen.getByTestId('entry-action-day-2')).toHaveAttribute('aria-checked','true');expect(screen.queryByText('已離開操作頁')).toBeNull();
});
it('rejects malformed entry identifiers before requesting entry data',async()=>{
 setup('move','42wrong');expect(await screen.findByText('無效的行程或景點 ID')).toBeVisible();expect(http.mock.calls.some(([p])=>p.includes('/entries/'))).toBe(false);
});

it('unknown source day fails closed instead of recomputing the whole trip',async()=>{
 http.mockImplementation(async(p:string)=>p.includes('/entries/')?reply({id:42,dayId:999}):read(p));setup('move');
 expect(await screen.findByText('無法確認景點所屬日期，請重新載入')).toBeVisible();expect(screen.queryByTestId('entry-action-confirm')).toBeNull();expect(writes()).toHaveLength(0);
});
it('custom times require an ordered range and reach the move verb in the same write',async()=>{
 setup('move');fireEvent.click(await screen.findByTestId('entry-action-day-2'));
 fireEvent.click(screen.getByRole('button',{name:'移動到時段'}));fireEvent.click(await screen.findByRole('option',{name:'自訂時段⋯'}));
 expect(screen.getByTestId('entry-action-confirm')).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'開始時間'}));fireEvent.click(await screen.findByRole('button',{name:'09',exact:true}));fireEvent.keyDown(document.activeElement!,{key:'Escape'});
 fireEvent.click(screen.getByRole('button',{name:'結束時間'}));fireEvent.click(within(screen.getByLabelText('小時')).getByRole('button',{name:'10',exact:true}));fireEvent.keyDown(document.activeElement!,{key:'Escape'});
 fireEvent.click(screen.getByTestId('entry-action-confirm'));
 await waitFor(()=>expect(writes()).toHaveLength(1));expect(JSON.parse(writes()[0][1].body)).toMatchObject({day_id:72,time:'09:00-10:00'});
});

it('radio arrows move focus and selection together without submitting',async()=>{
 setup('copy');const first=await screen.findByTestId('entry-action-day-1');first.focus();fireEvent.keyDown(first,{key:'ArrowDown'});
 expect(screen.getByTestId('entry-action-day-2')).toHaveFocus();expect(screen.getByTestId('entry-action-day-2')).toHaveAttribute('aria-checked','true');expect(first).toHaveAttribute('tabindex','-1');expect(writes()).toHaveLength(0);
});
it('a late accepted copy cannot navigate away from a new operation',async()=>{
 let release!:()=>void;http.mockImplementation(async(p:string,o?:RequestInit)=>p.endsWith('/copy')?new Promise<Response>(resolve=>{release=()=>resolve(reply({id:77}));}):o?.method?reply({}):read(p));
 const router=setup('copy');fireEvent.click(await screen.findByTestId('entry-action-day-2'));fireEvent.click(screen.getByTestId('entry-action-confirm'));
 await waitFor(()=>expect(writes()).toHaveLength(1));await act(async()=>{await router.navigate('/trip/t1/stop/43/copy');});
 await act(async()=>{release();});expect(router.state.location.pathname).toBe('/trip/t1/stop/43/copy');expect(screen.queryByText('已離開操作頁')).toBeNull();
});
