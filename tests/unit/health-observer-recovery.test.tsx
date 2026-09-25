import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MemoryRouter,Route,Routes,useNavigate,useLocation} from 'react-router-dom';
import TripHealthCheckPage from '../../src/pages/TripHealthCheckPage';
const http=vi.hoisted(()=>vi.fn());
const user=vi.hoisted(()=>({id:'u1'}));
vi.mock('../../src/lib/apiClient',()=>({apiFetchRaw:(path:string,init?:RequestInit)=>http(path,init)}));
vi.mock('../../src/hooks/useRequireAuth',()=>({useRequireAuth:()=>({user})}));
vi.mock('../../src/hooks/useCurrentUser',()=>({useCurrentUser:()=>({user})}));
vi.mock('../../src/components/shell/DesktopSidebarConnected',()=>({default:()=>null}));
vi.mock('../../src/components/shell/GlobalBottomNav',()=>({default:()=>null}));
const old={tripId:'A',userId:'u1',status:'completed',requestId:1,createdAt:'2026-09-25',findings:[{severity:'high',title:'舊報告的問題',description:'檢查時程',actionTarget:{day:2}}]};
const pending={...old,status:'pending',requestId:2,findings:[]};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
function setup(health:(init?:RequestInit)=>Promise<Response>){http.mockImplementation((path:string,init?:RequestInit)=>path.endsWith('/health-check')?health(init):Promise.resolve(response(path.includes('/days?')?[{timeline:[{id:1}]}]:{id:'A',title:'行程 A'})));}
function renderPage(){return render(<MemoryRouter initialEntries={['/trip/A/health']}><Routes><Route path='/trip/:tripId/health' element={<TripHealthCheckPage/>}/></Routes></MemoryRouter>);}
beforeEach(()=>{http.mockReset();});afterEach(()=>vi.useRealTimers());
it('重跑回 pending 空 findings 時保留舊報告；poll 失敗明示未知並可恢復',async()=>{
 vi.useFakeTimers();let post=false,fail=false;
 setup(async init=>{if(init?.method==='POST'){post=true;return response({report:pending});}if(fail)return response({},500);return response({report:post?{...pending,status:'completed',findings:[{...old.findings[0],title:'新的問題'}]}:old});});
 const view=renderPage();
 try{
  await act(async()=>{});fireEvent.click(screen.getByTestId('ai-health-start-btn'));await act(async()=>{});
  expect(screen.getByText('舊報告的問題')).toBeVisible();fail=true;
  await act(async()=>{await vi.advanceTimersByTimeAsync(3000);});
  expect(screen.getByText(/最新狀態未知/)).toBeVisible();expect(screen.getByTestId('ai-health-start-btn')).toBeDisabled();
  expect(screen.getByText('舊報告的問題')).toBeVisible();fail=false;
  fireEvent.click(screen.getByRole('button',{name:'重試健檢狀態'}));await act(async()=>{});
  expect(screen.getByText('新的問題')).toBeVisible();expect(screen.queryByText('舊報告的問題')).not.toBeInTheDocument();
 }finally{view.unmount();}
});
it('首次讀取失敗不當成未曾健檢，重試不送生成 POST',async()=>{
 let fail=true;setup(async()=>fail?response({},403):response({report:old}));renderPage();
 const retry=await screen.findByRole('button',{name:'重試健檢狀態'});
 expect(screen.queryByText('尚未健檢過此行程')).not.toBeInTheDocument();fail=false;fireEvent.click(retry);
 expect(await screen.findByText('舊報告的問題')).toBeVisible();expect(http.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(0);
});
it.each([{days:[]},{days:[{timeline:[]}]}])('空行程禁止生成：%j',async ({days})=>{
 http.mockImplementation((path:string)=>Promise.resolve(response(path.endsWith('/health-check')?{report:null}:path.includes('/days?')?days:{title:'Empty'})));
 renderPage();expect(await screen.findByTestId('ai-health-empty-hint')).toBeVisible();expect(screen.getByTestId('ai-health-start-btn')).toBeDisabled();
});
it('日期資料失敗不允許從未知 entry count 啟動，重試後可開始',async()=>{
 let fail=true;http.mockImplementation((path:string)=>Promise.resolve(path.includes('/days?')&&fail?response({},500):response(path.endsWith('/health-check')?{report:null}:path.includes('/days?')?[{timeline:[{id:1}]}]:{title:'Trip'})));
 renderPage();const retry=await screen.findByRole('button',{name:'重試健檢狀態'});expect(screen.queryByRole('button',{name:'開始健檢'})).not.toBeInTheDocument();fail=false;fireEvent.click(retry);expect(await screen.findByTestId('ai-health-start-btn')).toBeEnabled();
});
it.each([{actionTarget:{day:2},label:'前往 Day 2',url:'/trips?selected=A&focusDay=2#day2'},{actionTarget:{day:2,entryId:42},label:'前往景點',url:'/trip/A/stop/42/edit'}])('finding 有文字優先級並導向 $url',async({actionTarget,label,url})=>{
 setup(async()=>response({report:{...old,findings:[{...old.findings[0],actionTarget}]}}));
 function Location(){const location=useLocation();return <output>{location.pathname+location.search+location.hash}</output>;}
 render(<MemoryRouter initialEntries={['/trip/A/health']}><Location/><Routes><Route path='/trip/:tripId/health' element={<TripHealthCheckPage/>}/><Route path='*' element={<div>Destination</div>}/></Routes></MemoryRouter>);
 expect(await screen.findByText('高優先')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:label}));expect(screen.getByText(url)).toBeVisible();
});
it('A→B→A 忽略舊 visit 的 POST 回覆',async()=>{
 let finish!:(value:Response)=>void;let aReads=0;
 http.mockImplementation((path:string,init?:RequestInit)=>{
  if(init?.method==='POST')return new Promise<Response>(resolve=>{finish=resolve;});
  if(path.endsWith('/health-check'))return Promise.resolve(response({report:path.includes('/A/')&&++aReads>1?{...old,requestId:3,findings:[{...old.findings[0],title:'本次 A 報告'}]}:old}));
  return Promise.resolve(response(path.includes('/days?')?[{timeline:[{id:1}]}]:{title:path}));
 });
 function Harness(){const navigate=useNavigate();return <><button onClick={()=>navigate('/trip/B/health')}>Go B</button><button onClick={()=>navigate('/trip/A/health')}>Go A</button><Routes><Route path='/trip/:tripId/health' element={<TripHealthCheckPage/>}/></Routes></>;}
 render(<MemoryRouter initialEntries={['/trip/A/health']}><Harness/></MemoryRouter>);
 fireEvent.click(await screen.findByTestId('ai-health-start-btn'));fireEvent.click(screen.getByText('Go B'));await screen.findByTestId('ai-health-start-btn');fireEvent.click(screen.getByText('Go A'));expect(await screen.findByText('本次 A 報告')).toBeVisible();
 await act(async()=>{finish(response({report:pending}));});expect(screen.getByText('本次 A 報告')).toBeVisible();expect(screen.getByTestId('ai-health-start-btn')).toBeEnabled();
});
it('送出失去回應時保留報告並禁止重送；重試只重新讀取',async()=>{
 let posted=false;setup(async init=>{if(init?.method==='POST'){posted=true;throw new Error('connection lost');}return response({report:posted?pending:old});});
 renderPage();const start=await screen.findByTestId('ai-health-start-btn');fireEvent.click(start);fireEvent.click(start);
 const retry=await screen.findByRole('button',{name:'重試健檢狀態'});expect(start).toBeDisabled();expect(screen.getByText('舊報告的問題')).toBeVisible();fireEvent.click(retry);
 await waitFor(()=>expect(screen.queryByRole('button',{name:'重試健檢狀態'})).not.toBeInTheDocument());expect(start).toBeDisabled();expect(http.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
});
it('已接受新任務後，舊 request 的 completed 回覆不當成這次完成',async()=>{
 vi.useFakeTimers();setup(async init=>response({report:init?.method==='POST'?pending:old}));const view=renderPage();
 try{await act(async()=>{});fireEvent.click(screen.getByTestId('ai-health-start-btn'));await act(async()=>{});await act(async()=>{await vi.advanceTimersByTimeAsync(3000);});
  expect(screen.getByTestId('ai-health-start-btn')).toBeDisabled();expect(screen.getByText(/最新狀態未知/)).toBeVisible();expect(screen.getByText('舊報告的問題')).toBeVisible();
 }finally{view.unmount();}
});
