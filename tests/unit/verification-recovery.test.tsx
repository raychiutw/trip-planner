import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MemoryRouter,Route,Routes,useLocation,useNavigate} from 'react-router-dom';
import VerifyEmailPage from '../../src/pages/VerifyEmailPage';
import EmailVerifyPendingPage from '../../src/pages/EmailVerifyPendingPage';
const reply=(body:unknown,status=200,headers:HeadersInit={})=>new Response(JSON.stringify(body),{status,headers});
let http:ReturnType<typeof vi.fn>;
function Destination(){const l=useLocation();return <output>{l.pathname+l.search}</output>;}
function Harness(){const nav=useNavigate();return <><button onClick={()=>nav('/help')}>Help</button><button onClick={()=>nav('/auth/verify-email?token=B')}>Token B</button><button onClick={()=>nav('/signup/check-email?email=b%40example.com')}>Email B</button><Routes><Route path='/auth/verify-email' element={<VerifyEmailPage/>}/><Route path='/signup/check-email' element={<EmailVerifyPendingPage/>}/><Route path='*' element={<Destination/>}/></Routes></>;}
function setup(url='/auth/verify-email?token=A'){render(<MemoryRouter initialEntries={[url]}><Harness/></MemoryRouter>);}
beforeEach(()=>{http=vi.fn().mockResolvedValue(reply({ok:true}));vi.stubGlobal('fetch',http);});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();});
it('驗證只在明確操作後送出，成功由使用者選擇登入，不自動搶走頁面',async()=>{
 vi.useFakeTimers();setup();expect(http).not.toHaveBeenCalled();fireEvent.click(screen.getByTestId('verify-email-confirm-btn'));await act(async()=>{});
 expect(screen.getByRole('status')).toHaveTextContent('Email 驗證成功');expect(screen.getByRole('link',{name:'前往登入'})).toHaveAttribute('href','/login?verified=1');
 await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});expect(screen.getByTestId('verify-email-page')).toBeVisible();fireEvent.click(screen.getByRole('link',{name:'前往登入'}));expect(screen.getByText('/login?verified=1')).toBeVisible();
});
it('新 token 有自己的待確認狀態，舊 token 晚到成功不覆蓋它',async()=>{
 let finish!:(r:Response)=>void;http.mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve;}));setup();fireEvent.click(screen.getByTestId('verify-email-confirm-btn'));fireEvent.click(screen.getByText('Token B'));expect(screen.getByTestId('verify-email-confirm-btn')).toBeVisible();await act(async()=>finish(reply({ok:true})));expect(screen.getByTestId('verify-email-status-idle')).toBeVisible();expect(http).toHaveBeenCalledTimes(1);fireEvent.click(screen.getByTestId('verify-email-confirm-btn'));expect(JSON.parse(http.mock.calls[1][1].body)).toEqual({token:'B'});
});
it.each(['expired','used','missing_token','network','server_error',{code:'EDGE_ERROR'},null])('驗證結果 %j 有可讀訊息與正確出口',async(error)=>{
 if(error==='network')http.mockRejectedValue(new Error('offline'));else http.mockResolvedValue(reply({error},400));setup();fireEvent.click(screen.getByTestId('verify-email-confirm-btn'));await act(async()=>{});expect(screen.getByRole('alert')).not.toBeEmptyDOMElement();expect(screen.getByRole('alert')).toHaveFocus();
 if(['expired','used','missing_token'].includes(String(error)))expect(screen.getByRole('link',{name:'前往登入'})).toHaveAttribute('href','/login');else{http.mockResolvedValue(reply({ok:true}));fireEvent.click(screen.getByRole('button',{name:'重試'}));expect(await screen.findByTestId('verify-email-status-success')).toHaveTextContent('Email 驗證成功');}
});
it('缺少 token 不呼叫 API，明確提供登入與回首頁',()=>{setup('/auth/verify-email');expect(http).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('缺少 token');expect(screen.getByRole('link',{name:'前往登入'})).toHaveAttribute('href','/login');expect(screen.getByRole('link',{name:'回首頁'})).toHaveAttribute('href','/');});
it('驗證中的重複操作只提交一次；離頁後晚到結果不導航',async()=>{
 vi.useFakeTimers();let finish!:(r:Response)=>void;http.mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve;}));setup();const button=screen.getByTestId('verify-email-confirm-btn');act(()=>{button.click();button.click();});expect(http).toHaveBeenCalledTimes(1);fireEvent.click(screen.getByText('Help'));await act(async()=>finish(reply({ok:true})));await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});expect(screen.getByText('/help')).toBeVisible();
});
it('重寄倒數由 deadline 決定，背景回來立即追上且不是每秒 live announcement',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-25T00:00:00Z'));setup('/signup/check-email?email=a%40example.com');const button=screen.getByTestId('verify-resend');expect(button).toBeDisabled();expect(button.closest('[aria-live="polite"], [aria-live="assertive"], [role="status"], [role="alert"]')).toBeNull();
 vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');fireEvent(document,new Event('visibilitychange'));vi.setSystemTime(new Date('2026-09-25T00:02:00Z'));vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');fireEvent(document,new Event('visibilitychange'));expect(button).toBeEnabled();expect(http).not.toHaveBeenCalled();
});
it('重寄只送一次，失敗可重試且成功回覆不宣稱已送達',async()=>{
 vi.useFakeTimers();let finish!:(r:Response)=>void;http.mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve;}));setup('/signup/check-email?email=%20A%40example.com%20');await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});const button=screen.getByTestId('verify-resend');act(()=>{button.click();button.click();});expect(http).toHaveBeenCalledTimes(1);expect(JSON.parse(http.mock.calls[0][1].body)).toEqual({email:'a@example.com'});await act(async()=>finish(reply({},500)));expect(screen.getByRole('alert')).toHaveTextContent('重寄失敗');expect(button).toBeEnabled();fireEvent.click(button);await act(async()=>finish(reply({ok:true})));expect(screen.getByTestId('verify-resend-sent')).toHaveAttribute('role','status');expect(screen.getByTestId('verify-resend-sent')).toHaveTextContent('若帳號需要驗證');expect(button).toBeDisabled();
});
it('重寄限流遵守伺服器等待時間，不把 1 小時縮成 60 秒',async()=>{
 vi.useFakeTimers();http.mockResolvedValue(reply({error:{code:'VERIFY_RATE_LIMITED'}},429,{'Retry-After':'3600'}));setup('/signup/check-email?email=a%40example.com');await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});fireEvent.click(screen.getByTestId('verify-resend'));await act(async()=>{});expect(screen.getByRole('alert')).toHaveTextContent('寄送次數過多');expect(screen.getByTestId('verify-resend')).toHaveTextContent('3600 秒');await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});expect(screen.getByTestId('verify-resend')).toBeDisabled();
});
it('切換信箱後不沿用舊重寄結果及請求，缺少信箱時有修改出口',async()=>{
 vi.useFakeTimers();let finish!:(r:Response)=>void;http.mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve;}));setup('/signup/check-email?email=a%40example.com');await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});fireEvent.click(screen.getByTestId('verify-resend'));fireEvent.click(screen.getByText('Email B'));await act(async()=>finish(reply({ok:true})));expect(screen.getByTestId('verify-email')).toHaveTextContent('b@example.com');expect(screen.queryByTestId('verify-resend-sent')).toBeNull();expect(screen.getByTestId('verify-resend')).toHaveTextContent('60 秒');await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});fireEvent.click(screen.getByTestId('verify-resend'));expect(JSON.parse(http.mock.calls[1][1].body)).toEqual({email:'b@example.com'});
});
it('沒有目的信箱時不可重寄，保留改用其他信箱出口',()=>{
 setup('/signup/check-email');expect(screen.getByTestId('verify-resend')).toBeDisabled();expect(screen.getByRole('link',{name:'改用其他信箱'})).toHaveAttribute('href','/signup');expect(http).not.toHaveBeenCalled();
});
