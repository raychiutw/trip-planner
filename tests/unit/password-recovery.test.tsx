import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MemoryRouter,Route,Routes,useLocation,useNavigate} from 'react-router-dom';
import ResetPasswordPage from '../../src/pages/ResetPasswordPage';
import ForgotPasswordPage from '../../src/pages/ForgotPasswordPage';
const reply=(body:unknown,status=200,headers:HeadersInit={})=>new Response(JSON.stringify(body),{status,headers});
let http:ReturnType<typeof vi.fn>;
function Destination(){const l=useLocation();return <output>{l.pathname+l.search}</output>;}
function Harness(){const nav=useNavigate();return <><button onClick={()=>nav('/help')}>Help</button><button onClick={()=>nav('/auth/password/reset?token=B')}>Token B</button><Routes><Route path='/auth/password/reset' element={<ResetPasswordPage/>}/><Route path='/login/forgot' element={<ForgotPasswordPage/>}/><Route path='*' element={<Destination/>}/></Routes></>;}
function setup(url='/auth/password/reset?token=A'){render(<MemoryRouter initialEntries={[url]}><Harness/></MemoryRouter>);}
function fill(password='password123',confirm=password){fireEvent.change(screen.getByTestId('reset-password-input'),{target:{value:password}});fireEvent.change(screen.getByTestId('reset-confirm'),{target:{value:confirm}});}
function submit(id='reset-submit'){fireEvent.submit(screen.getByTestId(id).closest('form')!);}
beforeEach(()=>{http=vi.fn().mockResolvedValue(reply({ok:true}));vi.stubGlobal('fetch',http);});afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it.each([['short','short','reset-password-input','至少 8 字元'],['password123','different','reset-confirm','不一致']])('可修正錯誤對應欄位與焦點：%s / %s', (password,confirm,id,message)=>{
 setup();fill(password,confirm);submit();const input=screen.getByTestId(id);expect(input).toHaveAttribute('aria-invalid','true');expect(input).toHaveAccessibleDescription(new RegExp(message));expect(input).toHaveFocus();expect(http).not.toHaveBeenCalled();
});
it.each(['RESET_PASSWORD_TOO_SHORT','RESET_PASSWORD_FORMAT'])('後端 %s 聚焦新密碼而非確認欄位',async(code)=>{
 http.mockResolvedValue(reply({error:{code}},400));setup();fill();submit();await act(async()=>{});expect(screen.getByTestId('reset-password-input')).toHaveFocus();expect(screen.getByTestId('reset-password-input')).toHaveAttribute('aria-invalid','true');expect(screen.getByTestId('reset-password-input')).toHaveAccessibleDescription(/密碼/);expect(screen.getByTestId('reset-confirm')).toHaveValue('password123');
});
it('重設只送一次，網路失敗保留密碼可重試，成功焦點與登入入口清楚',async()=>{
 let fail!:(e:Error)=>void;http.mockImplementation(()=>new Promise<Response>((_,reject)=>{fail=reject;}));setup();fill();submit();submit();expect(http).toHaveBeenCalledTimes(1);await act(async()=>fail(new Error('offline')));expect(screen.getByRole('alert')).toHaveFocus();expect(screen.getByTestId('reset-password-input')).toHaveValue('password123');expect(screen.queryByTestId('reset-retry')).toBeNull();http.mockResolvedValue(reply({ok:true}));submit();await act(async()=>{});expect(screen.getByRole('heading',{name:'密碼已更新'})).toHaveFocus();expect(screen.getByRole('link',{name:'前往登入'})).toHaveAttribute('href','/login');
});
it('換 token 重建表單，不顯示舊請求的失效結果',async()=>{
 let finish!:(r:Response)=>void;http.mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve;}));setup();fill();submit();fireEvent.click(screen.getByText('Token B'));expect(screen.getByTestId('reset-password-input')).toHaveValue('');await act(async()=>finish(reply({error:{code:'RESET_TOKEN_INVALID'}},400)));expect(screen.queryByTestId('reset-retry')).toBeNull();fill();submit();expect(JSON.parse(http.mock.calls[1][1].body)).toEqual({token:'B',password:'password123'});
});
it.each(['reset','forgot'])('%s 不把 edge 200 HTML 當成功',async(kind)=>{
 http.mockResolvedValue(new Response('<html>challenge</html>',{status:200,headers:{'Content-Type':'text/html'}}));setup(kind==='reset'?'/auth/password/reset?token=A':'/login/forgot');if(kind==='reset')fill();else fireEvent.change(screen.getByTestId('forgot-email'),{target:{value:'a@example.com'}});submit(kind==='reset'?'reset-submit':'forgot-submit');await act(async()=>{});expect(screen.getByRole('alert')).toHaveTextContent('暫時無法處理');expect(screen.getByTestId(kind==='reset'?'reset-password-input':'forgot-email')).toBeVisible();
});
it('申請只送一次；回覆指向已提交信箱，不把途中修改信箱當成已申請',async()=>{
 let finish!:(r:Response)=>void;http.mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve;}));setup('/login/forgot');fireEvent.change(screen.getByTestId('forgot-email'),{target:{value:'a@example.com'}});submit('forgot-submit');submit('forgot-submit');expect(http).toHaveBeenCalledTimes(1);fireEvent.change(screen.getByTestId('forgot-email'),{target:{value:'b@example.com'}});await act(async()=>finish(reply({ok:true})));expect(screen.getByRole('heading',{name:'查看你的信箱'})).toHaveFocus();expect(screen.getByText(/已註冊/)).toHaveTextContent('a@example.com');expect(screen.getByText(/已註冊/)).toHaveTextContent('將寄至信箱');expect(screen.getByRole('link',{name:'回登入'})).toHaveAttribute('href','/login');
});
it('申請網路失敗保留信箱可重試，離開後晚到成功不改目前頁面',async()=>{
 http.mockRejectedValueOnce(new Error('offline'));setup('/login/forgot');fireEvent.change(screen.getByTestId('forgot-email'),{target:{value:'a@example.com'}});submit('forgot-submit');await act(async()=>{});expect(screen.getByRole('alert')).toHaveFocus();expect(screen.getByTestId('forgot-email')).toHaveValue('a@example.com');let finish!:(r:Response)=>void;http.mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve;}));submit('forgot-submit');fireEvent.click(screen.getByText('Help'));await act(async()=>finish(reply({ok:true})));expect(screen.getByText('/help')).toBeVisible();
});
it.each(['RESET_TOKEN_INVALID','RESET_TOKEN_MISSING'])('%s 提供重新申請且結果取得焦點',async(code)=>{
 http.mockResolvedValue(reply({error:{code}},400));setup();fill();submit();await act(async()=>{});expect(screen.getByRole('heading',{name:'這個連結無法使用了'})).toHaveFocus();expect(screen.getByRole('link',{name:'重新申請重設密碼'})).toHaveAttribute('href','/login/forgot');
});
it('空白 token 直接呈現失效出口，不提交',()=>{setup('/auth/password/reset?token=%20');expect(screen.getByTestId('reset-retry')).toHaveAttribute('href','/login/forgot');expect(http).not.toHaveBeenCalled();});
it('長度符合既有政策的純字母密碼可重設，混合字元只是建議',async()=>{
 setup();fill('longpassword');expect(screen.getByText('建議包含字母與數字')).toBeVisible();submit();await act(async()=>{});expect(screen.getByRole('heading',{name:'密碼已更新'})).toBeVisible();expect(JSON.parse(http.mock.calls[0][1].body).password).toBe('longpassword');
});
it.each([['forgot','120','120 秒'],['forgot',null,'幾分鐘後'],['reset','120','120 秒']])('%s 限流有可理解等待時間 %s',async(kind,header,message)=>{
 http.mockResolvedValue(reply({error:{code:kind==='forgot'?'FORGOT_PASSWORD_RATE_LIMITED':'RESET_RATE_LIMITED'}},429,header?{'Retry-After':header}:{}));setup(kind==='forgot'?'/login/forgot':'/auth/password/reset?token=A');if(kind==='forgot')fireEvent.change(screen.getByTestId('forgot-email'),{target:{value:'a@example.com'}});else fill();submit(kind==='forgot'?'forgot-submit':'reset-submit');await act(async()=>{});expect(screen.getByRole('alert')).toHaveTextContent(message);expect(screen.getByRole('alert')).toHaveFocus();
});
