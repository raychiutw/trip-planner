import {afterAll,beforeAll,expect,it} from 'vitest';
import {onRequestPost} from '../../functions/api/oauth/verify';
import {D1Adapter} from '../../src/server/oauth-d1-adapter';
import {createTestDb,disposeMiniflare} from './setup';
import {mockContext,mockEnv,seedUser,jsonRequest} from './helpers';
let db:D1Database;
beforeAll(async()=>{db=await createTestDb();},30000);afterAll(()=>disposeMiniflare());
function verify(token:unknown){return onRequestPost(mockContext({env:mockEnv(db),request:jsonRequest('https://example.com/api/oauth/verify','POST',{token})}));}
it('真實 POST 消耗有效 token，再次驗證回 used 並保留登入出口所需結果',async()=>{
 const userId=await seedUser(db,'verify-flow@example.com');const tokens=new D1Adapter(db,'EmailVerification');await tokens.upsert('valid-token',{userId,email:'verify-flow@example.com',createdAt:Date.now()},86400);
 const success=await verify('valid-token');expect(success.status).toBe(200);expect(await success.json()).toEqual({ok:true});expect(success.headers.get('Referrer-Policy')).toBe('no-referrer');
 const used=await verify('valid-token');expect(used.status).toBe(400);expect(await used.json()).toEqual({error:'used'});
});
it('空白與錯誤型別 token 回 missing_token；未知及過期 token 回 expired',async()=>{
 for(const token of ['', '  ',42])expect(await (await verify(token)).json()).toEqual({error:'missing_token'});
 expect(await (await verify('absent')).json()).toEqual({error:'expired'});
 const userId=await seedUser(db,'expired-flow@example.com');await new D1Adapter(db,'EmailVerification').upsert('expired-token',{userId},-1);expect(await (await verify('expired-token')).json()).toEqual({error:'expired'});
});
