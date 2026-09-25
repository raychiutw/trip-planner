import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MemoryRouter,Routes,Route,useNavigate,useLocation} from 'react-router-dom';
import InvitePage from '../../src/pages/InvitePage';
import LoginPage from '../../src/pages/LoginPage';
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
const invitation={tripId:'trip-A',tripTitle:'旅程 A',invitedEmail:'guest@example.com',inviterDisplayName:'Ray',inviterEmail:'ray@example.com',expiresAt:'2026-10-01'};
const user={id:'guest',email:'guest@example.com',displayName:'Guest'};
let http:ReturnType<typeof vi.fn>;
function Destination(){const l=useLocation();return <output>{l.pathname+l.search}</output>;}
function Harness(){const nav=useNavigate();return <><button onClick={()=>nav('/invite?token=B')}>Invite B</button><button onClick={()=>nav('/help')}>Help</button><Routes><Route path='/invite' element={<InvitePage/>}/><Route path='/login' element={<LoginPage/>}/><Route path='*' element={<Destination/>}/></Routes></>;}
function setup(url='/invite?token=A'){render(<MemoryRouter initialEntries={[url]}><Harness/></MemoryRouter>);}
beforeEach(()=>{http=vi.fn(async(path:string)=>reply(path.includes('userinfo')?user:invitation));vi.stubGlobal('fetch',http);});afterEach(()=>vi.unstubAllGlobals());
it('暫時讀取失敗可以只重讀同一邀請，不能顯示需要重寄',async()=>{
 let failed=true;http.mockImplementation(async(path:string)=>path.includes('userinfo')?reply(user):failed?reply({},503):reply(invitation));setup();expect(await screen.findByRole('alert')).toHaveTextContent('無法載入');expect(screen.queryByText(/請聯絡邀請者重寄/)).toBeNull();failed=false;fireEvent.click(screen.getByRole('button',{name:'重試'}));expect(await screen.findByRole('heading',{name:/旅程 A/})).toBeVisible();expect(http.mock.calls.filter(([path])=>path.includes('/accept'))).toHaveLength(0);
});
it('帳號不符有切換入口，登入與註冊仍保留原 invitation',async()=>{
 http.mockImplementation(async(path:string)=>reply(path.includes('userinfo')?{...user,email:'other@example.com'}:invitation));setup('/invite?token=a%2Fb');expect(await screen.findByTestId('invite-mismatch')).toHaveTextContent('guest@example.com');const target=new URL(screen.getByRole('link',{name:'切換帳號並加入'}).getAttribute('href')!,'https://app.test');expect(target.pathname).toBe('/api/oauth/logout');const login=new URL(target.searchParams.get('redirect_after')!,'https://app.test');expect(login.pathname).toBe('/login');expect(login.searchParams.get('invitation')).toBe('a/b');
});
it('同一 email 正規化遵守後端政策',async()=>{
 http.mockImplementation(async(path:string)=>reply(path.includes('userinfo')?{...user,email:' ＧＵＥＳＴ＠example.com '}:invitation));setup();expect(await screen.findByTestId('invite-accept-btn')).toBeVisible();
});
it('等待接受只送一次；換邀請後舊接受成功不能搶走目前頁面',async()=>{
 let finish!:(r:Response)=>void;http.mockImplementation((path:string)=>path.includes('/accept')?new Promise<Response>(resolve=>{finish=resolve;}):Promise.resolve(reply(path.includes('userinfo')?user:path.includes('token=B')?{...invitation,tripId:'trip-B',tripTitle:'旅程 B'}:invitation)));setup();const button=await screen.findByTestId('invite-accept-btn');act(()=>{button.click();button.click();});expect(http.mock.calls.filter(([p])=>p.includes('/accept'))).toHaveLength(1);fireEvent.click(screen.getByText('Invite B'));await screen.findByRole('heading',{name:/旅程 B/});await act(async()=>finish(reply({ok:true,tripId:'trip-A'})));expect(screen.getByRole('heading',{name:/旅程 B/})).toBeVisible();expect(screen.getByTestId('invite-accept-btn')).toBeEnabled();fireEvent.click(screen.getByTestId('invite-accept-btn'));const calls=http.mock.calls.filter(([p])=>p.includes('/accept'));expect(JSON.parse(calls[1][1].body).token).toBe('B');await act(async()=>finish(reply({ok:true,tripId:'trip-B'})));expect(screen.getByText('/trips?selected=trip-B')).toBeVisible();
});
it.each(['INVITATION_ACCEPTED','INVITATION_EXPIRED'])('%s 有正確出口',async(code)=>{
 http.mockImplementation(async(path:string)=>path.includes('userinfo')?reply(user):reply({error:{code,message:code==='INVITATION_ACCEPTED'?'此邀請已接受過':'邀請已過期'}},410));setup();await screen.findByRole('alert');if(code==='INVITATION_ACCEPTED'){expect(screen.getByRole('link',{name:'前往行程'})).toHaveAttribute('href','/trips');expect(screen.queryByText(/重寄/)).toBeNull();}else expect(screen.getByText(/重寄/)).toBeVisible();
});
it('登入狀態暫時失敗不當成匿名，重試後才顯示正確接受入口',async()=>{
 let failed=true;http.mockImplementation(async(path:string)=>path.includes('userinfo')?failed?reply({},503):reply(user):reply(invitation));setup();expect(await screen.findByRole('alert')).toHaveTextContent('登入狀態');expect(screen.queryByTestId('invite-login-btn')).toBeNull();failed=false;fireEvent.click(screen.getByRole('button',{name:'重試登入狀態'}));expect(await screen.findByTestId('invite-accept-btn')).toBeVisible();
});
it.each([403,200])('登入成功但自動接受回覆 %s 未確認成功時回原邀請',async(status)=>{
 http.mockImplementation(async(path:string)=>path.includes('userinfo')?reply({...user,email:'other@example.com'}):path.includes('/invitations/accept')?reply({error:{code:'INVITATION_EMAIL_MISMATCH'}},status):path.includes('/invitations?')?reply(invitation):reply({ok:true}));setup('/login?invitation=A');fireEvent.change(screen.getByTestId('login-email'),{target:{value:'other@example.com'}});fireEvent.change(screen.getByTestId('login-password'),{target:{value:'password123'}});fireEvent.click(screen.getByTestId('login-submit'));expect(await screen.findByTestId('invite-mismatch')).toBeVisible();expect(http.mock.calls.some(([p])=>p==='/api/invitations?token=A')).toBe(true);
});
it('無效預覽資料留在可重試狀態，不顯示可接受的假邀請',async()=>{
 http.mockImplementation(async(path:string)=>reply(path.includes('userinfo')?user:{}));setup();expect(await screen.findByRole('alert')).toHaveTextContent('無法載入');expect(screen.queryByTestId('invite-accept-btn')).toBeNull();expect(screen.getByRole('button',{name:'重試'})).toBeVisible();
});
it('預覽後才被接受的邀請顯示已接受出口，不繼續提供重送',async()=>{
 http.mockImplementation(async(path:string)=>path.includes('/accept')?reply({error:{code:'INVITATION_ACCEPTED',message:'此邀請已接受過'}},410):reply(path.includes('userinfo')?user:invitation));setup();fireEvent.click(await screen.findByTestId('invite-accept-btn'));expect(await screen.findByRole('link',{name:'前往行程'})).toBeVisible();expect(screen.queryByTestId('invite-accept-btn')).toBeNull();
});
