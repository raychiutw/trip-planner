import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider, Outlet, useNavigate, useLocation } from 'react-router-dom';
import AddCustomStopPage from '../../src/pages/AddCustomStopPage';
import AddStopPage from '../../src/pages/AddStopPage';
import ChangePoiPage from '../../src/pages/ChangePoiPage';
import { __internal } from '../../src/hooks/usePlacesAutocomplete';
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const days = [{id:1,dayNum:1,date:'2026-09-25',timeline:[]},{id:2,dayNum:2,date:'2026-09-26',timeline:[]}];
const cases = [
  { name:'手機新增', path:'/trip/A/add-custom-stop?day=1', title:'add-custom-stop-title', submit:'add-custom-stop-confirm' },
  { name:'桌機新增', path:'/trip/A/add-stop?day=1&tab=custom', title:'add-stop-custom-title', submit:'add-stop-confirm' },
  { name:'置換', path:'/trip/A/stop/9/change-poi?tab=custom', title:'change-poi-custom-title', submit:'change-poi-submit' },
];
let http: ReturnType<typeof vi.fn>;
function read(path: string) {
  if (path.includes('userinfo')) return reply({id:'owner',email:'owner@example.com',displayName:'Ray'});
  if (path.includes('/days')) return reply(days);
  if (path.includes('autocomplete')) return reply({predictions:[{placeId:'A',primaryText:'台北車站',secondaryText:'台灣'}]});
  if (path.includes('resolve')) return reply({lat:25.047,lng:121.517});
  if (path.endsWith('/trips/A')) return reply({tripId:'A',title:'旅程',destinations:[]});
  if (path.includes('/entries/')) return reply({id:9,entryPoisVersion:'v1'});
  return reply([]);
}
function Shell() { const nav=useNavigate(); return <><button onClick={()=>nav('/elsewhere')}>離開此頁</button><button onClick={()=>nav(-1)}>瀏覽器返回</button><Outlet/></>; }
function Destination() { const l=useLocation(); return <output>{l.pathname+l.search}</output>; }
function setup(path:string) {
  const router=createMemoryRouter([{element:<Shell/>,children:[
    {path:'/trip/:tripId/add-custom-stop',element:<AddCustomStopPage/>},
    {path:'/trip/:tripId/add-stop',element:<AddStopPage/>},
    {path:'/trip/:tripId/stop/:entryId/change-poi',element:<ChangePoiPage/>},
    {path:'*',element:<Destination/>},
  ]}],{initialEntries:['/previous',path]}); render(<RouterProvider router={router}/>); return router;
}
beforeEach(()=>{
  __internal.clearCache(); vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY',''); vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  http=vi.fn(async(path:string,opts?:RequestInit)=>opts?.method && !path.includes('autocomplete') ? reply({id:10,ok:true}) : read(path)); vi.stubGlobal('fetch',http);
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
async function chooseAddress(){fireEvent.change(screen.getByRole('combobox'),{target:{value:'台北'}});await screen.findByRole('option');fireEvent.keyDown(screen.getByRole('combobox'),{key:'ArrowDown'});fireEvent.keyDown(screen.getByRole('combobox'),{key:'Enter'});}
const writes=()=>http.mock.calls.filter(([p,o])=>o?.method && !p.includes('autocomplete') && !p.includes('recompute'));
it.each(cases)('$name 沒有座標不能提交；Google 地址可在地圖失敗時完成既有流程',async(c)=>{
 setup(c.path); const title=await screen.findByTestId(c.title); fireEvent.change(title,{target:{value:'朋友家'}});
 expect(screen.getByTestId(c.submit)).toBeDisabled(); expect(writes()).toHaveLength(0);
 await chooseAddress(); await waitFor(()=>expect(screen.getByTestId(c.submit)).toBeEnabled());
 const submit=screen.getByTestId(c.submit); act(()=>{submit.click();submit.click();});
 await waitFor(()=>expect(writes()).toHaveLength(1)); expect(JSON.parse(writes()[0][1].body)).toMatchObject({name:'朋友家',lat:25.047,lng:121.517,source:'custom'});
 await waitFor(()=>expect(screen.queryByTestId(c.title)).toBeNull()); expect(screen.queryByRole('alertdialog')).toBeNull();
});
it.each(cases)('$name 只輸入地址也保護草稿，取消離開與捨棄 POP 都正確',async(c)=>{
 setup(c.path); await screen.findByTestId(c.title); fireEvent.change(screen.getByRole('combobox'),{target:{value:'尚未選的位置'}});
 fireEvent.click(screen.getByText('離開此頁')); expect(await screen.findByRole('alertdialog')).toBeVisible();
 fireEvent.click(screen.getByTestId('confirm-modal-cancel')); expect(screen.getByRole('combobox')).toHaveValue('尚未選的位置');
 fireEvent.click(screen.getByText('瀏覽器返回')); await screen.findByRole('alertdialog'); fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
 expect(await screen.findByText('/previous')).toBeVisible(); expect(writes()).toHaveLength(0);
});
it('手機：負停留時間被拒絕，錯誤保留所有資料；失敗可重試且成功不再擋離開',async()=>{
 let failed=true;http.mockImplementation(async(p:string,o?:RequestInit)=>o?.method && p.includes('/entries') ? failed?reply({},503):reply({id:10}):read(p));setup(cases[0].path);
 fireEvent.change(await screen.findByTestId('add-custom-stop-title'),{target:{value:'朋友家'}}); await chooseAddress(); await waitFor(()=>expect(screen.getByTestId('add-custom-stop-confirm')).toBeEnabled());
 const duration=screen.getByRole('spinbutton',{name:'停留（分鐘）'}); fireEvent.change(duration,{target:{value:'-1'}});fireEvent.click(screen.getByTestId('add-custom-stop-confirm'));
 expect(await screen.findByTestId('add-custom-stop-error')).toHaveTextContent('正整數');expect(writes()).toHaveLength(0);
 fireEvent.change(duration,{target:{value:'60'}});fireEvent.click(screen.getByTestId('add-custom-stop-confirm'));expect(await screen.findByText(/儲存失敗/)).toBeVisible();expect(duration).toHaveValue(60);expect(screen.getByTestId('add-custom-stop-title')).toHaveValue('朋友家');
 failed=false;fireEvent.click(screen.getByTestId('add-custom-stop-confirm')); await waitFor(()=>expect(screen.queryByTestId('add-custom-stop-title')).toBeNull());expect(writes()).toHaveLength(2);
});
it('手機：日期未知時不提交，重讀日期保留草稿',async()=>{
 let failed=true;http.mockImplementation(async(p:string)=>p.includes('/days')&&failed?reply({},503):read(p)); setup(cases[0].path);
 fireEvent.change(await screen.findByTestId('add-custom-stop-title'),{target:{value:'朋友家'}});await chooseAddress();await screen.findByText(/已選位置：緯度/);expect(screen.getByTestId('add-custom-stop-confirm')).toBeDisabled();
 failed=false;fireEvent.click(screen.getByRole('button',{name:'重試日期'}));await waitFor(()=>expect(screen.getByTestId('add-custom-stop-confirm')).toBeEnabled());expect(screen.getByTestId('add-custom-stop-title')).toHaveValue('朋友家');
});
it('桌機切換來源先確認草稿，留下時地址與座標不丟失',async()=>{
 setup(cases[1].path);await screen.findByTestId(cases[1].title);fireEvent.change(screen.getByRole('combobox'),{target:{value:'朋友家地址'}});
 fireEvent.click(screen.getByRole('tab',{name:'搜尋'}));expect(await screen.findByRole('alertdialog')).toBeVisible();fireEvent.click(screen.getByTestId('confirm-modal-cancel'));expect(screen.getByRole('combobox')).toHaveValue('朋友家地址');
});

it('手機：只選時間也算草稿；切換日期保留草稿且送到新日期',async()=>{
 setup(cases[0].path);await screen.findByTestId('add-custom-stop-title');fireEvent.click(screen.getByRole('button',{name:'開始時間'}));
 fireEvent.click(await screen.findByRole('button',{name:'09',exact:true}));
 const unload=new Event('beforeunload',{cancelable:true});window.dispatchEvent(unload);expect(unload.defaultPrevented).toBe(true);
 fireEvent.click(screen.getByText('離開此頁'));await screen.findByRole('alertdialog');fireEvent.click(screen.getByTestId('confirm-modal-cancel'));
 fireEvent.click(screen.getByTestId('add-custom-stop-daypicker-chip-2'));expect(screen.queryByRole('alertdialog')).toBeNull();expect(screen.getByRole('button',{name:'開始時間'})).toHaveTextContent('09:00');
 fireEvent.change(screen.getByTestId('add-custom-stop-title'),{target:{value:'朋友家'}});await chooseAddress();await waitFor(()=>expect(screen.getByTestId('add-custom-stop-confirm')).toBeEnabled());fireEvent.click(screen.getByTestId('add-custom-stop-confirm'));
 await waitFor(()=>expect(writes()).toHaveLength(1));expect(writes()[0][0]).toContain('/days/2/entries');expect(JSON.parse(writes()[0][1].body).time).toBe('09:00');
});
