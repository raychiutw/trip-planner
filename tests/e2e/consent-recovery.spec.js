import {test,expect} from '@playwright/test';
import { createServer } from 'node:http';
const query=new URLSearchParams({client_id:'partner',redirect_uri:'https://client.test/cb',scope:'openid email',state:'csrf',response_type:'code',code_challenge:'challenge',code_challenge_method:'S256'}).toString();
for(const decision of ['allow','deny'])test(`native ${decision} submits once with PKCE and follows the server result`,async({page})=>{
 const posts=[];await page.route('**/api/**',route=>route.fulfill({json:{}}));await page.route('**/api/oauth/client-info?*',route=>route.fulfill({json:{app_name:'旅遊應用',app_description:null}}));
 // WebKit cannot fulfill an intercepted navigation with 302. Use an actual HTTP redirect.
 const server=createServer((request,response)=>{
  request.resume();
  response.writeHead(302,{Location:'http://localhost:3000/login?'+(decision==='allow'?'code=test':'error=access_denied')+'&state=csrf'});
  response.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
 await page.route('**/api/oauth/consent',route=>{posts.push(new URLSearchParams(route.request().postData()));return route.continue({url:`http://127.0.0.1:${server.address().port}/consent`});});
 await page.goto('/oauth/consent?'+query);await expect(page.getByRole('heading',{name:/旅遊應用/})).toBeVisible();await expect(page.getByRole('list',{name:'請求權限'})).toContainText('您的電子郵件地址');
 const button=page.getByTestId('consent-'+decision);await button.focus();if(decision==='deny')await page.keyboard.press('Enter');else await button.evaluate(node=>{node.form.requestSubmit();node.form.requestSubmit();});await page.waitForURL('**/login?*');expect(posts).toHaveLength(1);expect(Object.fromEntries(posts[0])).toMatchObject({decision,state:'csrf',code_challenge:'challenge',code_challenge_method:'S256'});await expect(page).toHaveURL(decision==='allow'?/code=test&state=csrf/:/error=access_denied&state=csrf/);
 } finally { await new Promise(resolve=>server.close(resolve)); }
});
test('client identity read failure blocks authorization until a keyboard retry succeeds',async({page})=>{
 let reads=0;await page.route('**/api/**',route=>route.fulfill({json:{}}));await page.route('**/api/oauth/client-info?*',route=>{reads++;return reads===1?route.abort('failed'):route.fulfill({json:{app_name:'旅遊應用'}});});await page.goto('/oauth/consent?'+query);await expect(page.getByRole('alert')).toContainText('無法載入');await expect(page.getByTestId('consent-allow')).toHaveCount(0);await page.getByRole('button',{name:'重試'}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:/旅遊應用/})).toBeVisible();await expect(page.getByRole('button',{name:'同意',exact:true})).toBeEnabled();
});
