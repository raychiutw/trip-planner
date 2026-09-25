import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import ChangePoiPage from '../../src/pages/ChangePoiPage';
import AddStopPage from '../../src/pages/AddStopPage';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
let failFavorites:boolean;
let failSearch:boolean;
let favorites: Array<typeof favorite>;
let writeStatus = 200;
let failSecond = false;
let writes: Array<{path:string; method:string; body:Record<string,unknown>}> = [];
const favorite={id:1,poiId:5,poiName:'收藏景點',poiType:'attraction',poiLat:35,poiLng:139};
beforeEach(()=>{
  failFavorites=true;failSearch=false;favorites=[favorite];writeStatus=200;failSecond=false;writes=[];localStorage.clear();
  vi.stubGlobal('fetch',vi.fn(async (input:RequestInfo|URL, init?:RequestInit)=>{
    const url=new URL(String(input),'https://test');
    if(init?.method && ['POST','PUT','PATCH'].includes(init.method)) {
      if(url.pathname.includes('recompute-travel'))return response({},503);
      const body=JSON.parse(String(init.body));
      writes.push({path:url.pathname,method:init.method,body});
      const status=failSecond && body.name==='第二收藏'?503:writeStatus;
      return response(status===200?{id:90}:{error:{code:'STALE_ENTRY',message:'版本過期'}},status);
    }
    if(url.pathname==='/api/oauth/userinfo')return response({id:'owner',email:'owner@test.com'});
    if(url.pathname==='/api/poi-favorites')return response(failFavorites?{}:favorites,failFavorites?503:200);
    if(url.pathname==='/api/poi-search')return response(failSearch?{}:{results:[{place_id:'search-1',name:'搜尋景點',lat:35,lng:139}]},failSearch?503:200);
    if(url.pathname==='/api/trips/t1')return response({id:'t1',name:'行程',destinations:[]});
    if(url.pathname.endsWith('/entries/12'))return response({id:12,entryPoisVersion:'1'});
    if(url.pathname.endsWith('/days'))return response([{id:1,dayNum:1,date:'2026-09-25',timeline:[]}]);
    return response([]);
  }));
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
function open(add=false, mode="alternate"){
  render(<MemoryRouter initialEntries={[add?'/trip/t1/add-stop?day=1&tab=favorites':`/trip/t1/stop/12/change-poi?mode=${mode}&day=1&tab=favorites`]}><ActiveTripProvider>
    <Link to="/trip/t1/stop/12/change-poi?mode=master&tab=favorites">換成正選意圖</Link>
    <Routes><Route path="/trips" element={<p>已回行程</p>}/><Route path="/trip/:tripId/stop/:entryId/edit" element={<p>已回編輯</p>}/><Route path="/trip/:tripId/stop/:entryId/change-poi" element={<ChangePoiPage/>}/><Route path="/trip/:tripId/add-stop" element={<AddStopPage/>}/></Routes>
  </ActiveTripProvider></MemoryRouter>);
}
it('更換景點的收藏失敗可重試，不會永久停在載入中',async()=>{
  open();
  expect(await screen.findByRole('button',{name:'重試載入收藏'})).toBeInTheDocument();
  expect(screen.queryByText('載入收藏⋯')).not.toBeInTheDocument();
  failFavorites=false;
  fireEvent.click(screen.getByRole('button',{name:'重試載入收藏'}));
  expect(await screen.findByText('收藏景點')).toBeInTheDocument();
});

it('新增景點的收藏失敗可重試，不會被當成空收藏',async()=>{
  open(true);
  expect(await screen.findByRole('button',{name:'重試載入收藏'})).toBeInTheDocument();
  expect(screen.queryByText('還沒收藏景點')).not.toBeInTheDocument();
  failFavorites=false;
  fireEvent.click(screen.getByRole('button',{name:'重試載入收藏'}));
  expect(await screen.findByText('收藏景點')).toBeInTheDocument();
});

it('改變正選／備選意圖會清除原選取',async()=>{
  failFavorites=false;open();
  fireEvent.click(await screen.findByTestId('change-poi-favorite-item-1'));
  expect(screen.getByTestId('change-poi-favorite-item-1')).toHaveAttribute('aria-pressed','true');
  fireEvent.click(screen.getByRole('link',{name:'換成正選意圖'}));
  expect(screen.getByTestId('change-poi-favorite-item-1')).toHaveAttribute('aria-pressed','false');
});

it.each([false,true])('景點搜尋失敗能重試且不顯示空結果（新增=%s）',async(add)=>{
  failFavorites=false;failSearch=true;open(add);
  fireEvent.click(await screen.findByTestId(add?'add-stop-tab-search':'change-poi-tab-search'));
  fireEvent.input(screen.getByPlaceholderText('搜尋景點、餐廳、住宿⋯'),{target:{value:'東京'}});
  expect(await screen.findByRole('button',{name:'重試搜尋'})).toBeInTheDocument();
  expect(screen.queryByText('沒有找到結果，換個關鍵字試試')).not.toBeInTheDocument();
  failSearch=false;fireEvent.click(screen.getByRole('button',{name:'重試搜尋'}));
  expect(await screen.findByText('搜尋景點')).toBeInTheDocument();
});

it('新增景點切換來源後不會恢復先前的收藏勾選',async()=>{
  failFavorites=false;open(true);
  fireEvent.click(await screen.findByRole('checkbox'));
  expect(screen.getByRole('checkbox')).toBeChecked();
  fireEvent.click(screen.getByTestId('add-stop-tab-search'));
  fireEvent.click(screen.getByTestId('add-stop-tab-favorites'));
  expect(await screen.findByRole('checkbox')).not.toBeChecked();
});

it.each([
  ['master','PUT','/api/trips/t1/entries/12/poi-id','已回行程'],
  ['alternate','POST','/api/trips/t1/entries/12/alternates','已回編輯'],
  ['new','POST','/api/trips/t1/days/1/entries','已回編輯'],
])('畫面意圖 %s 使用正確提交，交通失敗不重送景點',async(mode,method,path,landing)=>{
  failFavorites=false;open(false,mode);
  fireEvent.click(await screen.findByTestId('change-poi-favorite-item-1'));
  fireEvent.click(screen.getByTestId('change-poi-submit'));
  expect(await screen.findByText(landing)).toBeInTheDocument();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({path,method,body:{poiId:5}});
});
it('409 保留選取及頁面，顯示衝突而不聲稱成功',async()=>{
  failFavorites=false;writeStatus=409;open(false,'master');
  fireEvent.click(await screen.findByTestId('change-poi-favorite-item-1'));
  fireEvent.click(screen.getByTestId('change-poi-submit'));
  expect(await screen.findByText('資料已被其他操作更新，請重新整理')).toBeInTheDocument();
  expect(screen.getByTestId('change-poi-favorite-item-1')).toHaveAttribute('aria-pressed','true');
  expect(writes).toHaveLength(1);
});
it('部分新增成功後只重試失敗項目，保留收藏 POI 身分',async()=>{
  failFavorites=false;failSecond=true;
  favorites=[favorite,{...favorite,id:2,poiId:6,poiName:'第二收藏'}];open(true);
  const boxes=await screen.findAllByRole('checkbox');boxes.forEach(box=>fireEvent.click(box));
  fireEvent.click(screen.getByTestId('add-stop-confirm'));
  expect(await screen.findByText('1/2 個項目儲存失敗，請重試')).toBeInTheDocument();
  expect(screen.getAllByRole('checkbox')[0]).not.toBeChecked();
  expect(screen.getAllByRole('checkbox')[1]).toBeChecked();
  failSecond=false;fireEvent.click(screen.getByTestId('add-stop-confirm'));
  await waitFor(()=>expect(writes).toHaveLength(3));
  expect(writes.map(write=>write.body.poiId)).toEqual([5,6,6]);
});
