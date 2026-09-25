import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import AddPoiFavoriteToTripPage from '../../src/pages/AddPoiFavoriteToTripPage';
import AddStopPage from '../../src/pages/AddStopPage';
import ChangePoiPage from '../../src/pages/ChangePoiPage';
import AddEntryPage from '../../src/pages/AddEntryPage';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';
import { pickFromTripSelect } from './__helpers__/tripSelect';
import { pickTime } from './__helpers__/tripTimePicker';
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
let dayStatus=500;
let empty=false;
let tripList=[{tripId:'t1',name:'測試行程'}];
let writes:Array<{path:string;body:Record<string,unknown>}>=[];
let writeStatus=200;
let tripStatus=200;
beforeEach(()=>{
  vi.stubGlobal('scrollTo',vi.fn());
  dayStatus=500;empty=false;writeStatus=200;tripStatus=200;writes=[];tripList=[{tripId:'t1',name:'測試行程'}];localStorage.clear();
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const path=new URL(String(input),'https://test').pathname;
    if(init?.method==='POST') {
      if(path.includes('recompute-travel'))return json({});
      writes.push({path,body:JSON.parse(String(init.body))});
      return json(writeStatus===200?{entryId:88}:{error:'CONFLICT',conflictWith:{entryId:99,title:'既有景點',time:'09:00-10:00',dayNum:1}},writeStatus);
    }
    if(path==='/api/oauth/userinfo')return json({id:'owner',email:'owner@test.com'});
    if(path==='/api/my-trips')return json(tripList,tripStatus);
    if(path==='/api/poi-favorites')return json([{id:5,poiId:1,poiName:'保留景點',poiType:'attraction'}]);
    if(path.endsWith('/days'))return json(dayStatus===200?(empty?[]:[{id:1,dayNum:1,date:'2026-09-25',label:'首日'}]):{},dayStatus);
    if(path==='/api/trips/t1')return json({tripId:'t1',title:'測試行程',destinations:[]});
    return json([]);
  }));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function open(entry=false,day='',path?:string){
 render(<MemoryRouter initialEntries={[path ?? (entry?`/trip/t1/add-entry${day}`:'/favorites/5/add-to-trip')]}><ActiveTripProvider><Link to="/trip/t2/add-entry?day=1">切換目的行程</Link><Routes>
   <Route path="/trips" element={<p>已回行程</p>}/>
   <Route path="/trip/:tripId/add-stop" element={<AddStopPage/>}/>
   <Route path="/trip/:tripId/stop/:entryId/change-poi" element={<ChangePoiPage/>}/>
   <Route path="/trip/:tripId/add-entry" element={<AddEntryPage/>}/>
   <Route path="/favorites/:id/add-to-trip" element={<AddPoiFavoriteToTripPage/>}/>
 </Routes></ActiveTripProvider></MemoryRouter>);
}
it.each([403,404,500])('收藏日期 %s 顯示可重試錯誤並保留 POI/時間',async(status)=>{
  dayStatus=status;open();
  const retry=await screen.findByRole('button',{name:'重試載入日期'});
  expect(screen.queryByText('該行程沒有天數')).not.toBeInTheDocument();
  pickTime('favorites-add-to-trip-start','09:00');pickTime('favorites-add-to-trip-end','10:00');
  expect(screen.getByTestId('favorites-add-to-trip-submit')).toBeDisabled();
  dayStatus=200;fireEvent.click(retry);
  expect(await screen.findByText(/Day 1/)).toBeInTheDocument();
  expect(screen.getByText('保留景點')).toBeInTheDocument();
  expect(screen.getByTestId('favorites-add-to-trip-start')).toHaveTextContent('09:00');
  expect(screen.getByTestId('favorites-add-to-trip-end')).toHaveTextContent('10:00');
  expect(screen.getByTestId('favorites-add-to-trip-submit')).toBeEnabled();
});
it('新增 entry 帶 day 的失敗不能繼續選 POI，重試後恢復',async()=>{
  open(true,'?day=1');
  const retry=await screen.findByRole('button',{name:'重試載入日期'});
  expect(screen.getByRole('button',{name:/搜尋/})).toBeDisabled();
  dayStatus=200;fireEvent.click(retry);
  expect(await screen.findByRole('button',{name:/搜尋/})).toBeEnabled();
});
it('成功空陣列才顯示沒有天數',async()=>{
  dayStatus=200;empty=true;open();
  expect(await screen.findByText('該行程沒有天數')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'重試載入日期'})).not.toBeInTheDocument();
  expect(screen.getByTestId('favorites-add-to-trip-submit')).toBeDisabled();
});

it.each(['','?day=9','?day=1junk'])('新增 entry deep link %s 只容許載入確認的日期',async(day)=>{
 dayStatus=200;open(true,day);
 await screen.findByTestId('add-entry-daypicker');
 const button=screen.getByTestId('add-entry-pick-search');
 if(day==='')await waitFor(()=>expect(button).toBeEnabled());
 else expect(button).toBeDisabled();
});
it('舊新增入口沒有合法日期不得提交，選一天才啟用',async()=>{
 dayStatus=200;open(false,'','/trip/t1/add-stop?tab=favorites&day=9');
 fireEvent.click(await screen.findByRole('checkbox'));
 expect(screen.getByTestId('add-stop-confirm')).toBeDisabled();
 fireEvent.click(await screen.findByTestId('add-stop-daypicker-chip-1'));
 // 日期改變會清除原選取，需明確選回 POI。
 fireEvent.click(screen.getByRole('checkbox'));
 expect(screen.getByTestId('add-stop-confirm')).toBeEnabled();
});
it('直接進新增 POI 頁也不能提交無效日期',async()=>{
 dayStatus=200;open(false,'','/trip/t1/stop/0/change-poi?mode=new&day=9&tab=favorites');
 fireEvent.click(await screen.findByTestId('change-poi-favorite-item-5'));
 expect(screen.getByTestId('change-poi-submit')).toBeDisabled();
 expect(await screen.findByText('所選日期已失效，請返回選擇日期')).toBeInTheDocument();
});
it('切换行程後提交目前 trip/day，409 保留 POI 與時間供修正',async()=>{
 dayStatus=200;writeStatus=409;tripList=[{tripId:'t1',name:'第一行程'},{tripId:'t2',name:'第二行程'}];open();
 await screen.findByTestId('favorites-add-to-trip-trip');
 await pickFromTripSelect('favorites-add-to-trip-trip','第一行程');
 await screen.findByText(/Day 1/);
 pickTime('favorites-add-to-trip-start','09:00');pickTime('favorites-add-to-trip-end','10:00');
 await pickFromTripSelect('favorites-add-to-trip-trip','第二行程');
 await waitFor(()=>expect(screen.getByTestId('favorites-add-to-trip-submit')).toBeEnabled());
 fireEvent.click(screen.getByTestId('favorites-add-to-trip-submit'));
 expect(await screen.findByText('既有景點')).toBeInTheDocument();
 expect(writes).toEqual([{path:'/api/poi-favorites/5/add-to-trip',body:{tripId:'t2',dayNum:1,startTime:'09:00',endTime:'10:00'}}]);
 expect(screen.getByText('保留景點')).toBeInTheDocument();
 expect(screen.getByTestId('favorites-add-to-trip-start')).toHaveTextContent('09:00');
});

it('必要行程資料載入失敗可以重試',async()=>{
 tripStatus=500;dayStatus=200;open();
 const retry=await screen.findByRole('button',{name:'重試'});
 tripStatus=200;fireEvent.click(retry);
 expect(await screen.findByText('保留景點')).toBeInTheDocument();
 expect(await screen.findByText(/Day 1/)).toBeInTheDocument();
});
it('收藏端點要求完整時間，畫面與提交門檻一致',async()=>{
 dayStatus=200;open();await screen.findByText(/Day 1/);
 const submit=screen.getByTestId('favorites-add-to-trip-submit');
 expect(submit).toBeDisabled();expect(screen.getByText('必填 — 選擇開始時間')).toBeInTheDocument();
 pickTime('favorites-add-to-trip-start','09:00');expect(submit).toBeDisabled();
 pickTime('favorites-add-to-trip-end','10:00');expect(submit).toBeEnabled();
});

it('切換目的行程時不能保留舊行程標題',async()=>{
 dayStatus=200;open(true,'?day=1');
 await screen.findByText('新增景點 · 測試行程');
 fireEvent.click(screen.getByRole('link',{name:'切換目的行程'}));
 expect(screen.queryByText('新增景點 · 測試行程')).not.toBeInTheDocument();
 await waitFor(()=>expect(screen.getByTestId('add-entry-pick-search')).toBeEnabled());
});
