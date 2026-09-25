import {afterAll,beforeAll,beforeEach,expect,it} from 'vitest';
import {onRequestPost as consent} from '../../functions/api/oauth/consent';
import {onRequestGet as authorize} from '../../functions/api/oauth/authorize';
import {createTestDb,disposeMiniflare} from './setup';
import {mockContext,mockEnv,seedUser} from './helpers';
import {signSessionToken} from '../../src/server/session';
import {D1Adapter} from '../../src/server/oauth-d1-adapter';
let db:D1Database,cookie:string,uid:string;
const secret='test-consent-secret';
const body={client_id:'consent-client',redirect_uri:'https://client.test/cb',response_type:'code',scope:'openid email',state:'csrf',code_challenge:'challenge',code_challenge_method:'S256',decision:'allow'};
beforeAll(async()=>{db=await createTestDb();uid=await seedUser(db,'consent-owner@example.com');cookie='tripline_session='+await signSessionToken(uid,secret);await db.prepare("INSERT INTO client_apps (client_id,client_type,app_name,redirect_uris,allowed_scopes,status) VALUES (?, 'public', '旅遊應用', ?, ?, 'active')").bind(body.client_id,JSON.stringify([body.redirect_uri]),JSON.stringify(['openid','email'])).run();},30000);
afterAll(()=>disposeMiniflare());beforeEach(async()=>{await db.prepare("DELETE FROM oauth_models WHERE name IN ('Consent','AuthorizationCode')").run();});
function context(request:Request){return mockContext({request,env:mockEnv(db,{SESSION_SECRET:secret})});}
function post(overrides:Record<string,string>={},authenticated=true){return consent(context(new Request('https://app.test/api/oauth/consent',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',...(authenticated?{Cookie:cookie}:{})},body:new URLSearchParams({...body,...overrides})})));}
it.each([{client_id:'missing'},{redirect_uri:'https://evil.test/cb'},{scope:'admin'},{code_challenge:''},{response_type:'token'}])('無效同意 %j 不持久化且不產生成功 redirect',async(overrides)=>{
 const response=await post(overrides);expect(response.status).toBe(400);expect(response.headers.get('Location')).toBeNull();expect(await new D1Adapter(db,'Consent').find(`${uid}:${overrides.client_id??body.client_id}`)).toBeUndefined();
});
it('拒絕只回已註冊 callback 的 access_denied + state，不授權；不安全 callback 留在原站',async()=>{
 const denied=await post({decision:'deny'});const location=new URL(denied.headers.get('Location')!);expect(location.origin+location.pathname).toBe(body.redirect_uri);expect(location.searchParams.get('error')).toBe('access_denied');expect(location.searchParams.get('state')).toBe('csrf');expect(location.searchParams.has('code')).toBe(false);expect(await new D1Adapter(db,'Consent').find(`${uid}:${body.client_id}`)).toBeUndefined();expect((await post({decision:'deny',redirect_uri:'https://evil.test/cb'})).headers.get('Location')).toBeNull();
});
it('重複同意維持一份 consent，再由 authorize 產生帶 state 的 code；session 過期回登入',async()=>{
 const first=await post(),second=await post();expect(first.status).toBe(302);expect(second.headers.get('Location')).toBe(first.headers.get('Location'));const stored=await new D1Adapter(db,'Consent').find(`${uid}:${body.client_id}`);expect(stored).toMatchObject({scopes:['openid','email']});
 const result=await authorize(context(new Request(new URL(first.headers.get('Location')!,'https://app.test'),{headers:{Cookie:cookie}})));const callback=new URL(result.headers.get('Location')!);expect(callback.origin+callback.pathname).toBe(body.redirect_uri);expect(callback.searchParams.get('state')).toBe('csrf');expect(callback.searchParams.get('code')).toBeTruthy();
 const expired=await post({},false);const login=new URL(expired.headers.get('Location')!,'https://app.test');expect(login.pathname).toBe('/login');expect(login.searchParams.get('redirect_after')).toContain('code_challenge=challenge');
});
it.each(['{', 'null', JSON.stringify({...body,scope:7})])('格式錯誤的 JSON %s 被拒絕而非寫入或丟出例外',async(payload)=>{
 const result=await consent(context(new Request('https://app.test/api/oauth/consent',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:payload})));expect(result.status).toBe(400);expect(result.headers.get('Location')).toBeNull();expect(await new D1Adapter(db,'Consent').find(`${uid}:${body.client_id}`)).toBeUndefined();
});
