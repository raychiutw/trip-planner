import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MemoryRouter,useNavigate} from 'react-router-dom';
import ConsentPage from '../../src/pages/ConsentPage';
const params=(client='A')=>new URLSearchParams({client_id:client,scope:'openid email',redirect_uri:'https://client.test/cb',response_type:'code',state:'csrf',code_challenge:'challenge',code_challenge_method:'S256'}).toString();
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
const info={app_name:'旅遊應用',app_description:null,app_logo_url:null,homepage_url:null};
let http:ReturnType<typeof vi.fn>;
function setup(query=params()){function Page(){const nav=useNavigate();return <><button onClick={()=>nav('/oauth/consent?'+params('B'))}>Client B</button><ConsentPage/></>;}render(<MemoryRouter initialEntries={['/oauth/consent?'+query]}><Page/></MemoryRouter>);}
beforeEach(()=>{http=vi.fn().mockResolvedValue(reply(info));vi.stubGlobal('fetch',http);});afterEach(()=>vi.unstubAllGlobals());
it('client-info 暫時失敗不提供同意，重試讀取可信名稱後才能決定',async()=>{
 http.mockRejectedValueOnce(new Error('offline'));setup();expect(await screen.findByRole('alert')).toHaveTextContent('無法載入');expect(screen.queryByTestId('consent-allow')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'重試'}));expect(await screen.findByRole('heading',{name:/旅遊應用/})).toBeVisible();expect(screen.getByRole('button',{name:'同意',exact:true})).toBeEnabled();expect(screen.getByRole('button',{name:'拒絕',exact:true})).toBeEnabled();
});
it.each([404,503])('client-info %s 不產生可提交的授權表單',async(status)=>{
 http.mockResolvedValue(reply({},status));setup();expect(await screen.findByRole('alert')).toBeVisible();expect(screen.queryByTestId('consent-allow')).toBeNull();expect(screen.queryByTestId('consent-deny')).toBeNull();
});
it('切換 client 時清除可信名稱，舊讀取回覆不能覆蓋新請求',async()=>{
 let finish!:(r:Response)=>void;http.mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve;}));setup();const old=finish;fireEvent.click(screen.getByText('Client B'));const newer=finish;await act(async()=>old(reply({...info,app_name:'舊應用'})));expect(screen.queryByText('舊應用')).toBeNull();await act(async()=>newer(reply({...info,app_name:'新應用'})));expect(screen.getByRole('heading',{name:/新應用/})).toBeVisible();expect(new FormData(screen.getByTestId('consent-allow').closest('form')!).get('client_id')).toBe('B');
});
it('同意或拒絕只放行一次原生表單，保留完整協定參數且 bfcache 返回可再操作',async()=>{
 setup();const allow=await screen.findByTestId('consent-allow'),deny=screen.getByTestId('consent-deny');const form=allow.closest('form')!;expect(form).toHaveAttribute('method','POST');expect(form).toHaveAttribute('action','/api/oauth/consent');expect(Object.fromEntries(new FormData(form))).toMatchObject({decision:'allow',client_id:'A',scope:'openid email',state:'csrf',code_challenge:'challenge',code_challenge_method:'S256'});
 expect(fireEvent.submit(form)).toBe(true);expect(fireEvent.submit(form)).toBe(false);expect(fireEvent.submit(deny.closest('form')!)).toBe(false);expect(allow).toBeDisabled();const restored=new Event('pageshow');Object.defineProperty(restored,'persisted',{value:true});fireEvent(window,restored);expect(allow).toBeEnabled();expect(fireEvent.submit(deny.closest('form')!)).toBe(true);
});
it.each(['','javascript:alert(1)'])('缺少或不安全 callback %j 不提供授權',async(redirect)=>{
 const query=new URLSearchParams(params());query.set('redirect_uri',redirect);setup(query.toString());expect(await screen.findByRole('alert')).toHaveTextContent('redirect_uri');expect(http).not.toHaveBeenCalled();
});
