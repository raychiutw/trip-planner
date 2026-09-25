import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import EditTripPage from '../../src/pages/EditTripPage';
const http=vi.hoisted(()=>vi.fn());const user=vi.hoisted(()=>({id:'u1'}));
vi.mock('../../src/lib/apiClient',()=>({apiFetchRaw:(path:string,init?:RequestInit)=>http(path,init)}));
vi.mock('../../src/hooks/useRequireAuth',()=>({useRequireAuth:()=>({user})}));
vi.mock('../../src/components/shell/DesktopSidebarConnected',()=>({default:()=>null}));
const days=[{id:1,dayNum:1,date:'2026-05-01',dayOfWeek:'五',timeline:[{id:11}]},{id:2,dayNum:2,date:'2026-05-02',dayOfWeek:'六',timeline:[]}];
const trip={id:'A',title:'原行程',description:'原筆記',published:0,lang:'zh-TW',destinations:[]};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
function renderPage(){return render(<MemoryRouter initialEntries={['/trip/A/edit']}><Routes><Route path='/trip/:tripId/edit' element={<EditTripPage/>}/></Routes></MemoryRouter>);}
beforeEach(()=>{window.scrollTo=vi.fn();http.mockReset();http.mockImplementation((path:string)=>Promise.resolve(response(path.includes('/days?')?days:trip)));});
it('日期對話框有名稱，Escape 關閉並還原開啟按鈕焦點',async()=>{
 renderPage();const trigger=await screen.findByTestId('edit-trip-day-shift-btn');trigger.focus();fireEvent.click(trigger);
 const dialog=screen.getByRole('dialog',{name:'變更出發日期'});await waitFor(()=>expect(dialog).toHaveFocus());
 fireEvent.keyDown(document,{key:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect(trigger).toHaveFocus();
});
it('日期讀取失敗可重試，行程表單仍可使用',async()=>{
 let fail=true;http.mockImplementation((path:string)=>Promise.resolve(path.includes('/days?')&&fail?response({},500):response(path.includes('/days?')?days:trip)));
 renderPage();const retry=await screen.findByRole('button',{name:'重試讀取天數'});expect(screen.getByDisplayValue('原行程')).toBeInTheDocument();fail=false;fireEvent.click(retry);expect(await screen.findByTestId('edit-trip-day-shift-btn')).toBeVisible();
});
async function chooseShift(){
 const opener=await screen.findByTestId('edit-trip-day-shift-btn');opener.focus();fireEvent.click(opener);
 const dialog=screen.getByTestId('edit-trip-shift-modal');fireEvent.click(within(dialog).getByRole('button',{name:'變更出發日期'}));
 fireEvent.click(within(dialog).getByRole('button',{name:/May 3(?:rd)?,/}));return dialog;
}
it('平移顯示新舊日期、提交中鎖住日期與重複提交，成功更新清單',async()=>{
 let finish!:(response:Response)=>void;let shifted=false;
 http.mockImplementation((path:string,init?:RequestInit)=>init?.method==='POST'?new Promise<Response>(resolve=>{finish=resolve;}):Promise.resolve(response(path.includes('/days?')?(shifted?days.map((day,i)=>({...day,date:`2026-05-0${i+3}`})):days):trip)));
 renderPage();const dialog=await chooseShift();expect(within(dialog).getByTestId('edit-trip-shift-preview')).toHaveTextContent('5/3');expect(within(dialog).getByTestId('edit-trip-shift-preview')).toHaveTextContent('5/4');
 const submit=within(dialog).getByRole('button',{name:'確認變更'});fireEvent.click(submit);fireEvent.click(submit);
 expect(within(dialog).getByRole('button',{name:'變更出發日期'})).toBeDisabled();fireEvent.keyDown(document,{key:'Escape'});expect(dialog).toBeInTheDocument();
 const posts=http.mock.calls.filter(([,init])=>init?.method==='POST');expect(posts).toHaveLength(1);expect(JSON.parse(posts[0][1].body)).toEqual({startDate:'2026-05-03'});
 shifted=true;await act(async()=>{finish(response({shifted:2}));});await waitFor(()=>expect(screen.queryByTestId('edit-trip-shift-modal')).not.toBeInTheDocument());expect(screen.getByTestId('edit-trip-day-shift-btn')).toHaveTextContent('5/3');
});
it('已提交的平移在清單讀取失敗後只重試 GET，不重送平移',async()=>{
 let shifted=false,readFails=true;
 http.mockImplementation((path:string,init?:RequestInit)=>{
  if(init?.method==='POST'){shifted=true;return Promise.resolve(response({shifted:2}));}
  if(path.includes('/days?')&&shifted&&readFails)return Promise.resolve(response({},500));
  return Promise.resolve(response(path.includes('/days?')?(shifted?days.map((d,i)=>({...d,date:`2026-05-0${i+3}`})):days):trip));
 });
 renderPage();const dialog=await chooseShift();fireEvent.click(within(dialog).getByRole('button',{name:'確認變更'}));const retry=await screen.findByRole('button',{name:'重試讀取天數'});
 expect(screen.queryByTestId('edit-trip-shift-modal')).not.toBeInTheDocument();expect(screen.getByTestId('edit-trip-day-shift-btn')).toBeDisabled();await waitFor(()=>expect(screen.getByText('行程天數',{exact:true})).toHaveFocus());readFails=false;fireEvent.click(retry);
 await waitFor(()=>expect(screen.getByTestId('edit-trip-day-shift-btn')).toHaveTextContent('5/3'));expect(http.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
});
it('刪除失敗保留確認與行程表單；重試成功才移除該日',async()=>{
 let fail=true,deleted=false;
 http.mockImplementation((path:string,init?:RequestInit)=>{
  if(init?.method==='DELETE'){if(fail)return Promise.resolve(response({error:{message:'刪除失敗'}},500));deleted=true;return Promise.resolve(response({removedEntryCount:1}));}
  return Promise.resolve(response(path.includes('/days?')?(deleted?[{...days[1],dayNum:1}]:days):trip));
 });
 renderPage();const opener=await screen.findByTestId('edit-trip-day-remove-1');opener.focus();fireEvent.click(opener);const dialog=screen.getByRole('alertdialog',{name:'刪除 Day 1？'});expect(dialog).toHaveTextContent('1 個景點');expect(dialog).toHaveTextContent('日期保留');fireEvent.click(within(dialog).getByRole('button',{name:'刪除 Day 1'}));
 expect(await within(dialog).findByRole('alert')).toHaveTextContent('刪除失敗');expect(screen.getByDisplayValue('原行程')).toBeInTheDocument();expect(screen.getByTestId('edit-trip-published-draft')).toHaveAttribute('aria-checked','true');fail=false;fireEvent.click(within(dialog).getByRole('button',{name:'刪除 Day 1'}));
 await waitFor(()=>expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());expect(screen.getByTestId('edit-trip-day-shift-btn')).toHaveTextContent('5/2');await waitFor(()=>expect(screen.getByText('行程天數',{exact:true})).toHaveFocus());
});
it('行程儲存失敗保留最新名稱與發布狀態',async()=>{
 http.mockImplementation((path:string,init?:RequestInit)=>Promise.resolve(init?.method==='PUT'?response({error:{message:'暫時無法儲存'}},500):response(path.includes('/days?')?days:trip)));
 const view=renderPage();const title=await screen.findByDisplayValue('原行程');fireEvent.change(title,{target:{value:'保留我的名稱'}});fireEvent.click(screen.getByTestId('edit-trip-published-on'));
 fireEvent.submit(title.closest('form')!);expect(await screen.findByTestId('edit-trip-error')).toHaveTextContent('暫時無法儲存');expect(title).toHaveValue('保留我的名稱');expect(screen.getByTestId('edit-trip-published-on')).toHaveAttribute('aria-checked','true');view.unmount();
});
it.each([{button:'edit-trip-day-prepend',body:{position:'start'}},{button:'edit-trip-day-append',body:{position:'end'}},{button:'edit-trip-day-gap-2026-05-02',body:{position:'insert',date:'2026-05-02'}}])('加天與補回缺日沿用正確提交契約：$button',async({button,body})=>{
 let committed=false;const initial=body.position==='insert'?[days[0],{...days[1],date:'2026-05-03'}]:days;
 http.mockImplementation((path:string,init?:RequestInit)=>{
  if(init?.method==='POST'){committed=true;return Promise.resolve(response({ok:true}));}
  return Promise.resolve(response(path.includes('/days?')?(committed?[...initial,{id:3,dayNum:3,date:'2026-05-04',timeline:[]}]:initial):trip));
 });
 renderPage();fireEvent.click(await screen.findByTestId(button));await waitFor(()=>expect(screen.getByTestId('edit-trip-day-remove-3')).toBeInTheDocument());
 const [path,init]=http.mock.calls.find(([,init])=>init?.method==='POST');expect(path).toBe('/trips/A/days');expect(JSON.parse(init.body)).toEqual(body);
});
