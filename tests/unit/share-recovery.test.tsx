import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {Link,MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import TripSharePage from '../../src/pages/TripSharePage';
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const payload=(title='目前分享')=>({meta:{title,name:title,sharedBy:'分享者'},days:[],notes:{}});
let read: (token:string)=>Promise<Response>;
let clone:()=>Promise<Response>;
let loggedIn:boolean;
let cloneCalls:number;
beforeEach(()=>{
 loggedIn=false;cloneCalls=0;read=async token=>json(payload(token));clone=async()=>json({tripId:'copy-id'});
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
  const path=new URL(String(input),'https://test').pathname;
  if(path==='/api/oauth/userinfo')return loggedIn?json({id:'u1',email:'u@test.com'}):json({},401);
  if(path.endsWith('/clone')){cloneCalls++;return clone();}
  if(path.startsWith('/api/share/'))return read(path.split('/').at(-1)!);
  return json([]);
 }));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function Location(){return <p data-testid="location">{useLocation().pathname+useLocation().search}</p>;}
function open(){render(<MemoryRouter initialEntries={['/s/a']}><Link to="/s/b">換分享</Link><Location/><Routes><Route path="/s/:token" element={<TripSharePage/>}/><Route path="/login" element={<p>登入</p>}/><Route path="/trips" element={<p>副本</p>}/></Routes></MemoryRouter>);}
it.each([500,403,0])('暫時讀取錯誤 %s 不宣稱失效，重試只讀取',async(status)=>{
 read=async()=>{if(status===0)throw new Error('offline');return json({},status);};open();
 const retry=await screen.findByRole('button',{name:'重新載入分享'});
 expect(screen.queryByText('連結已失效')).not.toBeInTheDocument();
 read=async()=>json(payload());fireEvent.click(retry);
 expect(await screen.findByRole('heading',{level:1,name:'目前分享'})).toBeInTheDocument();
 expect(cloneCalls).toBe(0);
});
it.each([404,410])('服務端明確失效 %s 顯示失效',async(status)=>{
 read=async()=>json({},status);open();
 expect(await screen.findByText('連結已失效')).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'重新載入分享'})).not.toBeInTheDocument();
});
it('换 token 後不呈現舊資料，晚到舊回覆不能覆寫',async()=>{
 let finish!:(value:Response)=>void;
 read=async token=>token==='a'?new Promise(resolve=>{finish=resolve;}):json(payload('新的分享'));
 open();fireEvent.click(screen.getByRole('link',{name:'換分享'}));
 expect(await screen.findByRole('heading',{name:'新的分享'})).toBeInTheDocument();
 await act(async()=>finish(json(payload('過期回覆'))));
 expect(screen.queryByText('過期回覆')).not.toBeInTheDocument();
});
it('未登入複製保留原分享 redirect',async()=>{
 open();fireEvent.click(await screen.findByTestId('share-copy'));
 expect(screen.getByTestId('location')).toHaveTextContent('/login?redirect_after=%2Fs%2Fa');
 expect(cloneCalls).toBe(0);
});
it('複製防重送，失敗後由使用者重試',async()=>{
 loggedIn=true;let finish!:(value:Response)=>void;clone=()=>new Promise(resolve=>{finish=resolve;});open();
 const button=await screen.findByTestId('share-copy');fireEvent.click(button);fireEvent.click(button);
 await waitFor(()=>expect(cloneCalls).toBe(1));expect(button).toBeDisabled();
 await act(async()=>finish(json({},500)));
 expect(await screen.findByRole('alert')).toHaveTextContent('複製失敗');
 clone=async()=>json({tripId:'copy-id'});fireEvent.click(button);
 expect(await screen.findByText('副本')).toBeInTheDocument();expect(cloneCalls).toBe(2);
});
it('離開分享後晚到的複製結果不能導航離开新分享',async()=>{
 loggedIn=true;let finish!:(value:Response)=>void;clone=()=>new Promise(resolve=>{finish=resolve;});open();
 fireEvent.click(await screen.findByTestId('share-copy'));await waitFor(()=>expect(cloneCalls).toBe(1));
 fireEvent.click(screen.getByRole('link',{name:'換分享'}));await screen.findByTestId('share-title');
 await act(async()=>finish(json({tripId:'old-copy'})));
 expect(screen.getByTestId('location')).toHaveTextContent('/s/b');
});
it('已讀取的分享在換 token 後立即清除，等待新分享',async()=>{
 open();await screen.findByRole('heading',{name:'a'});
 let finish!:(value:Response)=>void;read=()=>new Promise(resolve=>{finish=resolve;});
 fireEvent.click(screen.getByRole('link',{name:'換分享'}));
 expect(screen.queryByRole('heading',{name:'a'})).not.toBeInTheDocument();
 expect(screen.getByRole('status')).toHaveTextContent('載入中');
 await act(async()=>finish(json(payload('新行程'))));
 expect(await screen.findByRole('heading',{name:'新行程'})).toBeInTheDocument();
});
it('尚未確認登入狀態不能誤導到登入或送出複製',async()=>{
 let finish!:(value:Response)=>void;
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
   if(String(input).endsWith('/oauth/userinfo'))return new Promise<Response>(resolve=>{finish=resolve;});
   return json(payload());
 }));
 open();const button=await screen.findByTestId('share-copy');expect(button).toBeDisabled();
 await act(async()=>finish(json({},401)));
 expect(button).toBeEnabled();
});
