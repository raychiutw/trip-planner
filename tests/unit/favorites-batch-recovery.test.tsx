import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PoiFavoritesPage from '../../src/pages/PoiFavoritesPage';
import { RefreshProvider, useRefreshRunner } from '../../src/contexts/RefreshContext';
const row=(id:number,place='東京')=>({id,poiId:id*100,poiName:`收藏 ${id}`,poiAddress:place,poiType:'restaurant',favoritedAt:'2026-09-25',note:null});
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
let http:ReturnType<typeof vi.fn>;
function Refresh(){const run=useRefreshRunner();return <button onClick={()=>void run()}>重新整理收藏</button>;}
function setup(){return render(<MemoryRouter><RefreshProvider><Refresh/><PoiFavoritesPage/></RefreshProvider></MemoryRouter>);}
beforeEach(()=>{
 vi.spyOn(window,'scrollTo').mockImplementation(()=>{});http=vi.fn(async(p:string)=>p.includes('userinfo')?reply({id:'u1',email:'user@test.com'}):p.endsWith('/poi-favorites')?reply([row(1),row(2,'京都'),row(3,'京都')]):reply([]));vi.stubGlobal('fetch',http);
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const deletes=()=>http.mock.calls.filter(([,o])=>o?.method==='DELETE');
it('select visible adds the current filter to the existing selection and confirmation identifies hidden rows',async()=>{
 setup();fireEvent.click(await screen.findByTestId('favorites-check-1'));fireEvent.click(screen.getByTestId('favorites-region-京都'));fireEvent.click(screen.getByTestId('favorites-select-all'));
 expect(screen.getByTestId('favorites-toolbar')).toHaveTextContent('已選 3 個');expect(screen.getByTestId('favorites-toolbar')).toHaveTextContent('1 個不在本頁');
 fireEvent.click(screen.getByTestId('favorites-delete-selected'));const dialog=await screen.findByRole('alertdialog');expect(dialog).toHaveTextContent('收藏 1');expect(dialog).toHaveTextContent('收藏 2');expect(dialog).toHaveTextContent('收藏 3');expect(deletes()).toHaveLength(0);
 expect(dialog).toHaveAccessibleName('確定移除收藏？');expect(within(dialog).getByRole('button',{name:'移除',exact:true})).toBeEnabled();
});
it('each acknowledgement removes only its row; failures stay selected and retry never repeats success',async()=>{
 let finish!:(r:Response)=>void,attempt=0;
 http.mockImplementation(async(p:string,o?:RequestInit)=>{
  if(p.includes('userinfo'))return reply({id:'u1',email:'user@test.com'});
  if(o?.method==='DELETE')return p.endsWith('/1')?new Response(null,{status:204}):++attempt===1?new Promise<Response>(r=>{finish=r;}):new Response(null,{status:204});
  return p.endsWith('/poi-favorites')?reply([row(1),row(2)]):reply([]);
 });setup();fireEvent.click(await screen.findByTestId('favorites-check-1'));fireEvent.click(screen.getByTestId('favorites-select-all'));fireEvent.click(screen.getByTestId('favorites-delete-selected'));
 const confirm=await screen.findByTestId('confirm-modal-confirm');act(()=>{confirm.click();confirm.click();});
 await waitFor(()=>expect(screen.queryByTestId('favorites-card-1')).toBeNull());expect(screen.getByTestId('favorites-card-2')).toBeVisible();expect(deletes()).toHaveLength(2);
 await act(async()=>{finish(reply({},503));});expect(screen.getByTestId('favorites-check-2')).toBeChecked();expect(screen.getByRole('alert')).toHaveTextContent('收藏 2');
 fireEvent.click(screen.getByTestId('favorites-delete-selected'));fireEvent.click(await screen.findByTestId('confirm-modal-confirm'));await screen.findByTestId('favorites-empty');
 expect(deletes().map(([p])=>p)).toEqual(['/api/poi-favorites/1','/api/poi-favorites/2','/api/poi-favorites/2']);
});
it('a refresh started before deletion cannot resurrect the acknowledged removed row',async()=>{
 let reads=0,finish!:(r:Response)=>void;
 http.mockImplementation(async(p:string,o?:RequestInit)=>p.includes('userinfo')?reply({id:'u1',email:'user@test.com'}):o?.method==='DELETE'?new Response(null,{status:204}):p.endsWith('/poi-favorites')?++reads===1?reply([row(1),row(2)]):new Promise<Response>(r=>{finish=r;}):reply([]));
 setup();await screen.findByTestId('favorites-check-1');fireEvent.click(screen.getByText('重新整理收藏'));fireEvent.click(screen.getByTestId('favorites-check-1'));fireEvent.click(screen.getByTestId('favorites-delete-selected'));fireEvent.click(await screen.findByTestId('confirm-modal-confirm'));
 await waitFor(()=>expect(screen.queryByTestId('favorites-card-1')).toBeNull());await act(async()=>{finish(reply([row(1),row(2)]));});expect(screen.queryByTestId('favorites-card-1')).toBeNull();expect(screen.getByTestId('favorites-card-2')).toBeVisible();
});

it('select all means the displayed page and preserves the previous page selection',async()=>{
 http.mockImplementation(async(p:string)=>p.includes('userinfo')?reply({id:'u1',email:'user@test.com'}):p.endsWith('/poi-favorites')?reply(Array.from({length:201},(_,i)=>row(i+1))):reply([]));
 setup();fireEvent.click(await screen.findByTestId('favorites-check-1'));fireEvent.click(screen.getByRole('button',{name:'下一頁'}));fireEvent.click(screen.getByRole('button',{name:'全選本頁'}));expect(screen.getByTestId('favorites-toolbar')).toHaveTextContent('已選 25 個（1 個不在本頁）');
 fireEvent.click(screen.getByTestId('favorites-delete-selected'));const dialog=await screen.findByRole('alertdialog');expect(dialog).toHaveTextContent('收藏 1（');expect(dialog).toHaveTextContent('收藏 48（');expect(dialog).not.toHaveTextContent('收藏 49（');
});
it('removing the only row on the final page returns to a valid populated page',async()=>{
 http.mockImplementation(async(p:string,o?:RequestInit)=>p.includes('userinfo')?reply({id:'u1',email:'user@test.com'}):o?.method==='DELETE'?new Response(null,{status:204}):p.endsWith('/poi-favorites')?reply(Array.from({length:241},(_,i)=>row(i+1))):reply([]));
 setup();await screen.findByTestId('favorites-check-1');for(let i=0;i<10;i++)fireEvent.click(screen.getByRole('button',{name:'下一頁'}));
 fireEvent.click(screen.getByTestId('favorites-check-241'));fireEvent.click(screen.getByTestId('favorites-delete-selected'));fireEvent.click(await screen.findByTestId('confirm-modal-confirm'));
 expect(await screen.findByTestId('favorites-card-240')).toBeVisible();expect(screen.getByText('第 10 / 10 頁')).toBeVisible();expect(screen.getByRole('button',{name:'下一頁'})).toBeDisabled();
});
