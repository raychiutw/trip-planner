import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router-dom';
import AddPoiFavoriteToTripPage from '../../src/pages/AddPoiFavoriteToTripPage';
import ExplorePage from '../../src/pages/ExplorePage';
import { resetToasts } from '../../src/lib/toastBus';
const poi=(id:string)=>({place_id:id,name:`景點 ${id}`,lat:25,lng:121,category:'cafe'});
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status});
let http: ReturnType<typeof vi.fn>;
let observer: IntersectionObserverCallback | undefined;
const searchCalls=()=>http.mock.calls.filter(([p])=>p.includes('/poi-search'));
function setup(){return render(<MemoryRouter><ExplorePage/></MemoryRouter>);}
beforeEach(()=>{
 resetToasts();observer=undefined;vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 vi.stubGlobal('IntersectionObserver',class{constructor(cb:IntersectionObserverCallback){observer=cb;}observe(){}disconnect(){}unobserve(){}});
 http=vi.fn(async(p:string)=>p.includes('userinfo')?reply({id:'u1',email:'user@test.com'}):p.includes('/poi-search')?reply({results:[poi('A')],nextPageToken:'next-A'}):reply([]));vi.stubGlobal('fetch',http);
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function intersect(){act(()=>observer?.([{isIntersecting:true}] as IntersectionObserverEntry[],{} as IntersectionObserver));}
it('failed next page preserves results, retries explicitly and deduplicates overlapping places',async()=>{
 let nextAttempts=0;http.mockImplementation(async(p:string)=>p.includes('userinfo')?reply({id:'u1',email:'user@test.com'}):p.includes('pageToken')?++nextAttempts===1?reply({},503):reply({results:[poi('A'),poi('B')]}):p.includes('/poi-search')?reply({results:[poi('A')],nextPageToken:'next-A'}):reply([]));
 setup();await screen.findByText('景點 A');intersect();
 expect(await screen.findByRole('button',{name:'重試載入更多'})).toBeVisible();expect(screen.getByText('景點 A')).toBeVisible();
 intersect();await act(async()=>{});expect(nextAttempts).toBe(1);
 fireEvent.click(screen.getByRole('button',{name:'重試載入更多'}));expect(await screen.findByText('景點 B')).toBeVisible();expect(screen.getAllByText('景點 A')).toHaveLength(1);
});
it('pagination uses the submitted query, not the edited draft, and late pages cannot join a new search',async()=>{
 let release!:(r:Response)=>void;http.mockImplementation(async(p:string)=>p.includes('userinfo')?reply({id:'u1',email:'user@test.com'}):p.includes('pageToken')?new Promise<Response>(r=>{release=r;}):p.includes('q=%E4%BA%AC%E9%83%BD')?reply({results:[poi('京都')]}):p.includes('/poi-search')?reply({results:[poi('A')],nextPageToken:'next-A'}):reply([]));
 setup();await screen.findByText('景點 A');fireEvent.change(screen.getByTestId('explore-search-input'),{target:{value:'京都'}});intersect();
 await waitFor(()=>expect(searchCalls()).toHaveLength(2));expect(new URL(searchCalls()[1][0],'https://test').searchParams.get('q')).toBe('東京');
 fireEvent.click(screen.getByTestId('explore-search-submit'));await screen.findByText('景點 京都');
 await act(async()=>{release(reply({results:[poi('舊頁')]}));});expect(screen.queryByText('景點 舊頁')).toBeNull();expect(screen.queryByText('景點 A')).toBeNull();
});
it('a failed first page has a durable retry and is not presented as zero matches',async()=>{
 let failed=true;http.mockImplementation(async(p:string)=>p.includes('userinfo')?reply({id:'u1',email:'user@test.com'}):p.includes('/poi-search')?failed?reply({},503):reply({results:[]}):reply([]));setup();
 expect(await screen.findByRole('button',{name:'重試搜尋'})).toBeVisible();expect(screen.queryByText(/沒有找到/)).toBeNull();failed=false;fireEvent.click(screen.getByRole('button',{name:'重試搜尋'}));expect(await screen.findByTestId('explore-landing-empty')).toBeVisible();
});
it('three pages remain capped and a remaining token is not described as all search results',async()=>{
 let page=0;http.mockImplementation(async(p:string)=>p.includes('userinfo')?reply({id:'u1',email:'user@test.com'}):p.includes('/poi-search')?reply({results:[poi(String(++page))],nextPageToken:`token-${page}`}):reply([]));setup();await screen.findByText('景點 1');intersect();await screen.findByText('景點 2');intersect();await screen.findByText('景點 3');
 expect(screen.getByTestId('explore-results-end')).toHaveTextContent('請縮小搜尋範圍');intersect();await act(async()=>{});expect(page).toBe(3);
});

it('adding to a trip retains the search across failure, then returns to the read results on success',async()=>{
 let writes=0;http.mockImplementation(async(p:string,o?:RequestInit)=>{
  if(p.includes('userinfo'))return reply({id:'u1',email:'user@test.com'});
  if(p.includes('/my-trips'))return reply([{tripId:'t1',title:'旅程一'}]);
  if(p.includes('/days')&&!p.includes('/entries'))return reply([{id:71,dayNum:1,date:'2026-09-25'}]);
  if(p.includes('/entries'))return ++writes===1?reply({error:{message:'加入暫時失敗'}},503):reply({id:99});
  if(p.includes('/poi-search'))return reply({results:[poi('A')],nextPageToken:null});
  return reply(o?.method?{}:[]);
 });
 const router=createMemoryRouter([{path:'/explore',element:<ExplorePage/>},{path:'/add-to-trip',element:<AddPoiFavoriteToTripPage/>},{path:'*',element:<p>離開探索</p>}],{initialEntries:['/explore']});render(<RouterProvider router={router}/>);
 await screen.findByText('景點 A');fireEvent.change(screen.getByTestId('explore-search-input'),{target:{value:'京都咖啡'}});fireEvent.click(screen.getByTestId('explore-search-submit'));await waitFor(()=>expect(searchCalls()).toHaveLength(2));
 fireEvent.click(screen.getByTestId('explore-cat-咖啡廳'));fireEvent.click(screen.getByTestId('explore-add-to-trip-btn-A'));
 await screen.findByTestId('favorites-add-to-trip-submit');fireEvent.click(screen.getByRole('button',{name:'天數'}));fireEvent.click(await screen.findByRole('option',{name:/Day 1/}));
 fireEvent.click(screen.getByTestId('favorites-add-to-trip-submit'));expect(await screen.findByTestId('favorites-add-to-trip-error')).toBeVisible();
 fireEvent.click(screen.getByTestId('favorites-add-to-trip-submit'));await screen.findByTestId('explore-search-input');
 expect(screen.getByTestId('explore-search-input')).toHaveValue('京都咖啡');expect(screen.getByTestId('explore-cat-咖啡廳')).toHaveClass('is-active');expect(screen.getByText('景點 A')).toBeVisible();expect(searchCalls()).toHaveLength(2);expect(writes).toBe(2);
});
it('favorites read failure is recoverable instead of treating every result as unsaved',async()=>{
 let failed=true;http.mockImplementation(async(p:string)=>p.includes('userinfo')?reply({id:'u1',email:'user@test.com'}):p.includes('/poi-search')?reply({results:[poi('A')]}):p.includes('/poi-favorites')?failed?reply({},503):reply([{id:7,poiId:8,poiName:'景點 A',poiType:'food',poiPlaceId:'A'}]):reply([]));setup();await screen.findByText('景點 A');
 expect(screen.getByTestId('explore-save-btn-A')).toBeDisabled();failed=false;fireEvent.click(await screen.findByRole('button',{name:'重試收藏狀態'}));await waitFor(()=>expect(screen.getByTestId('explore-save-btn-A')).toBeEnabled());expect(screen.getByTestId('explore-save-btn-A')).toHaveAccessibleName('已收藏 · 點擊取消');
});
it('accepted favorite updates only its canonical place, prevents double writes, and does not depend on a refresh',async()=>{
 let writes=0,reads=0;http.mockImplementation(async(p:string,o?:RequestInit)=>{
  if(p.includes('userinfo'))return reply({id:'u1',email:'user@test.com'});
  if(p.includes('/poi-search'))return reply({results:[poi('A'),{...poi('B'),name:'景點 A'}]});
  if(p.includes('find-or-create'))return reply({id:8});
  if(p.includes('/poi-favorites')&&o?.method==='POST'){writes++;return reply({id:7,poiId:8},201);}
  if(p.includes('/poi-favorites'))return ++reads===1?reply([]):reply({},503);
  return reply([]);
 });setup();await screen.findAllByText('景點 A');await waitFor(()=>expect(screen.getByTestId('explore-save-btn-A')).toBeEnabled());const save=screen.getByTestId('explore-save-btn-A');act(()=>{save.click();save.click();});
 await waitFor(()=>expect(save).toHaveAccessibleName('已收藏 · 點擊取消'));expect(screen.getByTestId('explore-save-btn-B')).toHaveAccessibleName('加入收藏');expect(writes).toBe(1);expect(searchCalls()).toHaveLength(1);
});
it('region keyboard selection submits the same query in the chosen region',async()=>{
 setup();await screen.findByText('景點 A');const trigger=screen.getByTestId('explore-region-pill').querySelector('button') ?? screen.getByTestId('explore-region-pill');trigger.focus();fireEvent.keyDown(trigger,{key:'ArrowDown'});
 const option=await screen.findByRole('option',{name:'東京'});fireEvent.click(option);
 await waitFor(()=>expect(searchCalls()).toHaveLength(2));expect(new URL(searchCalls()[1][0],'https://test').searchParams.get('region')).toBe('東京');expect(screen.getByTestId('explore-region-pill')).toHaveTextContent('東京');
});
it('an already-existing favorite is confirmed by a read and can subsequently be removed',async()=>{
 let posts=0,reads=0,deletes=0;http.mockImplementation(async(p:string,o?:RequestInit)=>{
  if(p.includes('userinfo'))return reply({id:'u1',email:'user@test.com'});
  if(p.includes('/poi-search'))return reply({results:[poi('A')]});
  if(p.includes('find-or-create'))return reply({id:8});
  if(o?.method==='POST'){posts++;return reply({error:{code:'DATA_CONFLICT',message:'已收藏'}},409);}
  if(o?.method==='DELETE'){deletes++;return new Response(null,{status:204});}
  if(p.includes('/poi-favorites'))return reply(++reads===1?[]:[{id:7,poiId:8,poiPlaceId:'A'}]);
  return reply([]);
 });setup();await screen.findByText('景點 A');await waitFor(()=>expect(screen.getByTestId('explore-save-btn-A')).toBeEnabled());fireEvent.click(screen.getByTestId('explore-save-btn-A'));
 await waitFor(()=>expect(screen.getByTestId('explore-save-btn-A')).toHaveAccessibleName('已收藏 · 點擊取消'));expect(posts).toBe(1);
 fireEvent.click(screen.getByTestId('explore-save-btn-A'));await waitFor(()=>expect(screen.getByTestId('explore-save-btn-A')).toHaveAccessibleName('加入收藏'));expect(deletes).toBe(1);expect(searchCalls()).toHaveLength(1);
});

it('a queued pagination observation after leaving cannot start another request',async()=>{
 const page=setup();await screen.findByText('景點 A');page.unmount();intersect();await act(async()=>{});expect(searchCalls()).toHaveLength(1);
});
