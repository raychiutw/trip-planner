import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MemoryRouter,Route,Routes,useLocation,useNavigate} from 'react-router-dom';
import SignupPage from '../../src/pages/SignupPage';
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
let http:ReturnType<typeof vi.fn>;
function Destination(){const l=useLocation();return <output>{l.pathname+l.search}</output>;}
function Page(){const navigate=useNavigate();return <><button onClick={()=>navigate('/help')}>Help</button><Routes><Route path='/signup' element={<SignupPage/>}/><Route path='*' element={<Destination/>}/></Routes></>;}
function setup(query=''){render(<MemoryRouter initialEntries={['/signup'+query]}><Page/></MemoryRouter>);fireEvent.change(screen.getByLabelText('電子郵件'),{target:{value:'user@example.com'}});fireEvent.change(screen.getByLabelText('密碼'),{target:{value:'password123'}});fireEvent.change(screen.getByTestId('signup-display-name'),{target:{value:'旅人'}});fireEvent.click(screen.getByRole('checkbox'));}
function submit(){fireEvent.submit(screen.getByTestId('signup-submit').closest('form')!);}
beforeEach(()=>{http=vi.fn();vi.stubGlobal('fetch',http);});afterEach(()=>vi.unstubAllGlobals());
it.each([['SIGNUP_INVALID_EMAIL','電子郵件','電子郵件格式無效'],['SIGNUP_PASSWORD_TOO_SHORT','密碼','密碼至少 8 字元'],['SIGNUP_PASSWORD_FORMAT','密碼','密碼格式不符']])('實際 server error %s 關聯並聚焦可修正欄位',async(code,label,message)=>{
 http.mockResolvedValue(reply({error:{code}},400));setup();submit();await screen.findByRole('alert');const field=screen.getByLabelText(label);expect(field).toHaveAttribute('aria-invalid','true');expect(field).toHaveAccessibleDescription(new RegExp(message));await waitFor(()=>expect(field).toHaveFocus());expect(screen.getByTestId('signup-display-name')).toHaveValue('旅人');expect(screen.getByLabelText('密碼')).toHaveValue('password123');
});
it('未同意有說明且直接 submit 也不送出',()=>{setup();fireEvent.click(screen.getByRole('checkbox'));expect(screen.getByRole('checkbox')).toHaveAccessibleDescription('需同意個資條款與隱私權政策才能建立帳號。');submit();expect(http).not.toHaveBeenCalled();expect(screen.getByRole('checkbox')).toHaveFocus();});
it('等待提交只送一次，拒絕後保留輸入且可以重試',async()=>{
 let finish!:(r:Response)=>void;http.mockImplementation(()=>new Promise<Response>(r=>{finish=r;}));setup();submit();submit();expect(http).toHaveBeenCalledTimes(1);await act(async()=>finish(reply({error:{code:'SIGNUP_EMAIL_TAKEN'}},409)));expect(screen.getByRole('alert')).toHaveFocus();expect(screen.getByLabelText('電子郵件')).toHaveValue('user@example.com');submit();expect(http).toHaveBeenCalledTimes(2);
});
it.each([['',{},'/signup/check-email?email=user%40example.com'],['?invitation=token',{joinedTrip:{id:'trip A'}},'/trips?selected=trip%20A'],['?invitation=token',{invitationError:'INVITATION_EXPIRED'},'/signup/check-email?email=user%40example.com&invitationError=INVITATION_EXPIRED']])('成功不被緩慢寄信阻塞，依實際結果導向 %s',async(query,result,destination)=>{
 http.mockImplementation((path:string)=>path.endsWith('/oauth/signup')?Promise.resolve(reply({ok:true,email:'user@example.com',...result})):new Promise(()=>{}));setup(query);submit();expect(await screen.findByText(destination)).toBeVisible();expect(http).toHaveBeenCalledTimes(2);if(query)expect(JSON.parse(http.mock.calls[0][1].body)).toMatchObject({invitationToken:'token'});
});
it('離開頁面後晚到成功不寄信或覆蓋目前位置',async()=>{
 let finish!:(r:Response)=>void;http.mockImplementation(()=>new Promise<Response>(r=>{finish=r;}));setup();submit();fireEvent.click(screen.getByText('Help'));await act(async()=>finish(reply({ok:true,email:'user@example.com'})));expect(screen.getByText('/help')).toBeVisible();expect(http).toHaveBeenCalledTimes(1);
});
it('後端要求重新同意時回到勾選框並保留內容',async()=>{
 http.mockResolvedValue(reply({error:{code:'SIGNUP_CONSENT_REQUIRED'}},400));setup();submit();await act(async()=>{});expect(screen.getByRole('checkbox')).not.toBeChecked();expect(screen.getByRole('checkbox')).toHaveFocus();expect(screen.getByTestId('signup-submit')).toBeDisabled();expect(screen.getByLabelText('密碼')).toHaveValue('password123');
});
it('寄信網路失敗仍保留已建立帳號的成功結果',async()=>{
 http.mockImplementation((path:string)=>path.endsWith('/oauth/signup')?Promise.resolve(reply({ok:true,email:'user@example.com'})):Promise.reject(new Error('offline')));setup();submit();expect(await screen.findByText('/signup/check-email?email=user%40example.com')).toBeVisible();
});
