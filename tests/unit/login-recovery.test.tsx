import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MemoryRouter,Route,Routes,useLocation,useNavigate} from 'react-router-dom';
import LoginPage from '../../src/pages/LoginPage';
const reply=(body:unknown,status=200,headers:HeadersInit={})=>new Response(JSON.stringify(body),{status,headers});
let http:ReturnType<typeof vi.fn>;
function renderPage(query=''){return render(<MemoryRouter initialEntries={['/login'+query]}><Routes><Route path='/login' element={<LoginPage/>}/><Route path='*' element={<Destination/>}/></Routes></MemoryRouter>);}
function Destination(){const location=useLocation();return <output>{location.pathname+location.search}</output>;}
function fill(){fireEvent.change(screen.getByTestId('login-email'),{target:{value:'user@example.com'}});fireEvent.change(screen.getByTestId('login-password'),{target:{value:'a-password'}});}
beforeEach(()=>{sessionStorage.clear();http=vi.fn(async()=>reply({providers:{google:false}}));vi.stubGlobal('fetch',http);});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('密碼欄名稱不包含忘記密碼，password manager 屬性維持',()=>{
 renderPage();expect(screen.getByLabelText('密碼',{exact:true})).toHaveAttribute('autocomplete','current-password');expect(screen.getByTestId('login-email')).toHaveAttribute('autocomplete','email');expect(screen.getByRole('link',{name:'忘記密碼？'})).toHaveAttribute('href','/login/forgot');
});
it('同一登入在等待回覆時只送一次，失敗保留欄位供重試',async()=>{
 let finish!:(response:Response)=>void;http.mockImplementation((path:string)=>path.endsWith('/oauth/login')?new Promise<Response>(resolve=>{finish=resolve;}):Promise.resolve(reply({})));
 renderPage();fill();const form=screen.getByTestId('login-submit').closest('form')!;fireEvent.submit(form);fireEvent.submit(form);
 expect(http.mock.calls.filter(([path])=>path.endsWith('/oauth/login'))).toHaveLength(1);
 await act(async()=>{finish(reply({error:{code:'LOGIN_INVALID'}},401));});expect(await screen.findByRole('alert')).toHaveTextContent('電子郵件或密碼錯誤');expect(screen.getByTestId('login-password')).toHaveValue('a-password');
});
it.each(['/trips?selected=A','//evil.example','/\t/evil.example'])('登入成功遵守 redirect 契約：%j',async(target)=>{
 http.mockImplementation(async()=>reply({ok:true}));renderPage('?redirect_after='+encodeURIComponent(target));fill();fireEvent.click(screen.getByTestId('login-submit'));
 expect(await screen.findByText(target.startsWith('/trips')?target:'/trips')).toBeVisible();
});
it('離開登入頁後晚到成功不覆蓋目前路由',async()=>{
 let finish!:(response:Response)=>void;http.mockImplementation((path:string)=>path.endsWith('/oauth/login')?new Promise<Response>(resolve=>{finish=resolve;}):Promise.resolve(reply({})));
 function Harness(){const navigate=useNavigate();return <><button onClick={()=>navigate('/help')}>Help</button><Routes><Route path='/login' element={<LoginPage/>}/><Route path='*' element={<Destination/>}/></Routes></>;}
 render(<MemoryRouter initialEntries={['/login']}><Harness/></MemoryRouter>);fill();fireEvent.click(screen.getByTestId('login-submit'));fireEvent.click(screen.getByText('Help'));
 await act(async()=>{finish(reply({ok:true}));});expect(screen.getByText('/help')).toBeVisible();
});
it('鎖定訊息取得焦點；實際等待時間到期後恢復欄位及焦點',async()=>{
 vi.useFakeTimers();http.mockImplementation(async(path:string)=>path.endsWith('/oauth/login')?reply({error:{code:'LOGIN_RATE_LIMITED'}},429,{'Retry-After':'2'}):reply({}));
 const view=renderPage();fill();fireEvent.click(screen.getByTestId('login-submit'));
 try{await act(async()=>{});expect(screen.getByRole('heading',{name:'登入嘗試太多次'})).toHaveFocus();expect(screen.getByRole('timer',{name:'距離可再次登入的時間'})).toHaveTextContent('00:02');
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});expect(screen.getByTestId('login-email')).toHaveFocus();expect(screen.getByTestId('login-password')).toHaveValue('a-password');
 }finally{view.unmount();}
});
it.each(['garbage','-10','Infinity'])('無效 Retry-After %j 不產生 NaN 或永久失效倒數',async(header)=>{
 http.mockImplementation(async(path:string)=>path.endsWith('/oauth/login')?reply({error:{code:'LOGIN_RATE_LIMITED'}},429,{'Retry-After':header}):reply({}));renderPage();fill();fireEvent.click(screen.getByTestId('login-submit'));
 expect(await screen.findByRole('timer')).toHaveTextContent('30:00');expect(screen.getByRole('link',{name:'重設密碼'})).toHaveAttribute('href','/login/forgot');
});
it('提交驗證訊息可由輔助科技讀取，修正後可成功重試',async()=>{
 let failed=true;http.mockImplementation(async(path:string)=>path.endsWith('/oauth/login')&&failed?reply({error:{code:'LOGIN_INVALID_INPUT'}},400):reply({ok:true}));renderPage();fireEvent.click(screen.getByTestId('login-submit'));
 expect(await screen.findByRole('alert')).toHaveTextContent('請輸入電子郵件與密碼');failed=false;fill();fireEvent.click(screen.getByTestId('login-submit'));expect(await screen.findByText('/trips')).toBeVisible();
});
