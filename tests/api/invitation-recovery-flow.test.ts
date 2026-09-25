import {afterAll,beforeAll,beforeEach,expect,it} from 'vitest';
import {onRequestGet as preview} from '../../functions/api/invitations';
import {onRequestPost as accept} from '../../functions/api/invitations/accept';
import {createTestDb,disposeMiniflare} from './setup';
import {mockContext,mockEnv,seedTrip,seedUser,callHandler,jsonRequest} from './helpers';
import {hashInvitationToken} from '../../src/server/invitation-token';
import {signSessionToken} from '../../src/server/session';
let db:D1Database,owner:string,guest:string,other:string;
const secret='invitation-flow-secret';
beforeAll(async()=>{db=await createTestDb();owner=(await seedTrip(db,{id:'invitation-flow-trip',owner:'owner-invite@example.com'})).ownerUserId;guest=await seedUser(db,'guest-invite@example.com');other=await seedUser(db,'other-invite@example.com');},30000);afterAll(()=>disposeMiniflare());
beforeEach(async()=>{await db.prepare('DELETE FROM trip_invitations WHERE trip_id=?').bind('invitation-flow-trip').run();});
async function seed(token:string,expiresAt:string){await db.prepare("INSERT INTO trip_invitations(token_hash,trip_id,invited_email,role,invited_by,expires_at) VALUES(?,'invitation-flow-trip','guest-invite@example.com','member',?,?)").bind(await hashInvitationToken(token,secret),owner,expiresAt).run();}
function ctx(request:Request){return mockContext({request,env:mockEnv(db,{SESSION_SECRET:secret})});}
async function take(token:string,uid:string){return callHandler(accept,ctx(jsonRequest('https://app.test/api/invitations/accept','POST',{token},{Cookie:'tripline_session='+await signSessionToken(uid,secret)})));}
it('真實預覽→錯誤帳號拒絕→正確帳號加入→重複接受只得到已接受結果',async()=>{
 await seed('valid-invite',new Date(Date.now()+86400000).toISOString());const read=await callHandler(preview,ctx(new Request('https://app.test/api/invitations?token=valid-invite')));expect(await read.json()).toMatchObject({tripId:'invitation-flow-trip',invitedEmail:'guest-invite@example.com'});
 const wrong=await take('valid-invite',other);expect(wrong.status).toBe(403);expect(await wrong.json()).toMatchObject({error:{code:'INVITATION_EMAIL_MISMATCH'}});expect(await db.prepare('SELECT id FROM trip_permissions WHERE trip_id=? AND user_id=?').bind('invitation-flow-trip',other).first()).toBeNull();
 const correct=await take('valid-invite',guest);expect(await correct.json()).toMatchObject({ok:true,tripId:'invitation-flow-trip'});expect(await (await take('valid-invite',guest)).json()).toMatchObject({error:{code:'INVITATION_ACCEPTED'}});expect(await (await callHandler(preview,ctx(new Request('https://app.test/api/invitations?token=valid-invite')))).json()).toMatchObject({error:{code:'INVITATION_ACCEPTED'}});expect(await db.prepare('SELECT count(*) AS n FROM trip_permissions WHERE trip_id=? AND user_id=?').bind('invitation-flow-trip',guest).first()).toEqual({n:1});
});
it('過期邀請不取得權限',async()=>{await seed('expired-invite',new Date(Date.now()-1000).toISOString());expect(await (await take('expired-invite',other)).json()).toMatchObject({error:{code:'INVITATION_EXPIRED'}});});
