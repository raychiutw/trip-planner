import {afterAll,afterEach,beforeAll,expect,it,vi} from 'vitest';
import {onRequestPost as signup} from '../../functions/api/oauth/signup';
import {onRequestPost as forgot} from '../../functions/api/oauth/forgot-password';
import {onRequestPost as reset} from '../../functions/api/oauth/reset-password';
import {onRequestPost as login} from '../../functions/api/oauth/login';
import {getSessionUser} from '../../functions/api/_session';
import {AppError,errorResponse} from '../../functions/api/_errors';
import {createTestDb,disposeMiniflare} from './setup';
import {mockContext,mockEnv,jsonRequest} from './helpers';
let db:D1Database;
beforeAll(async()=>{db=await createTestDb();},30000);afterAll(()=>disposeMiniflare());afterEach(()=>vi.unstubAllGlobals());
it('相同申請回覆保護帳號存在性；信件 token 重設後新密碼可登入、舊密碼及舊 session 失效、token 不可重用',async()=>{
 const email='password-flow@example.com';const env=mockEnv(db,{SESSION_SECRET:'test-secret-32-chars-long-enough',TRIPLINE_API_URL:'https://mailer.tail.ts.net',TRIPLINE_API_SECRET:'test'});
 const mail=vi.fn(async()=>new Response(JSON.stringify({ok:true,messageId:'message',elapsed:1})));vi.stubGlobal('fetch',mail);let seq=0;
 async function invoke(handler:typeof reset,body:unknown){const ctx=mockContext({env,request:jsonRequest('https://example.com/api/oauth','POST',body,{'CF-Connecting-IP':`10.11.0.${++seq}`})});let response:Response;try{response=await handler(ctx);}catch(e){if(e instanceof AppError)response=errorResponse(e);else throw e;}await Promise.all((ctx as unknown as {_waitUntilPromises:Promise<unknown>[]})._waitUntilPromises);return response;}
 expect((await invoke(signup,{email,password:'old-password123',privacyConsent:true})).status).toBe(201);
 const oldLogin=await invoke(login,{email,password:'old-password123'});expect(oldLogin.status).toBe(200);const cookie=oldLogin.headers.get('Set-Cookie')!.split(';')[0]!;const sessionRequest=new Request('https://example.com/api/me',{headers:{Cookie:cookie}});expect(await getSessionUser(sessionRequest,env)).not.toBeNull();
 const known=await invoke(forgot,{email});const unknown=await invoke(forgot,{email:'not-registered@example.com'});expect(known.status).toBe(unknown.status);expect(await known.json()).toEqual(await unknown.json());
 const body=JSON.parse((mail.mock.calls as unknown as [string,RequestInit][])[0]![1].body as string);const link=body.text.match(/https:\/\/[^\s]+\/auth\/password\/reset\?token=[^\s]+/)[0];const token=new URL(link).searchParams.get('token');expect(token).toBeTruthy();
 const result=await invoke(reset,{token,password:'longpassword'});expect(result.status).toBe(200);expect(await result.json()).toMatchObject({ok:true});expect(await getSessionUser(sessionRequest,env)).toBeNull();
 expect((await invoke(login,{email,password:'old-password123'})).status).toBe(401);expect((await invoke(login,{email,password:'longpassword'})).status).toBe(200);expect(await (await invoke(reset,{token,password:'different-password123'})).json()).toMatchObject({error:{code:'RESET_TOKEN_INVALID'}});
},30000);
