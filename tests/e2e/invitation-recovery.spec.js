import {test,expect} from '@playwright/test';
import { createServer } from 'node:http';
const invitation={tripId:'trip-A',tripTitle:'旅程 A',invitedEmail:'guest@example.com',inviterDisplayName:'Ray',inviterEmail:'ray@example.com',expiresAt:'2026-10-01'};
const user={id:'guest',email:'guest@example.com',displayName:'Guest'};
test('invitation read retry preserves token and accepting a temporary failure can recover',async({page})=>{
 let reads=0,accepts=0;await page.route('**/api/**',route=>route.fulfill({json:{}}));await page.route('**/api/oauth/userinfo',route=>route.fulfill({json:user}));await page.route('**/api/invitations?*',route=>{reads++;return route.fulfill({status:reads===1?503:200,json:reads===1?{}:invitation});});await page.route('**/api/invitations/accept',route=>{accepts++;expect(route.request().postDataJSON().token).toBe('original-token');return route.fulfill({status:accepts===1?503:200,json:accepts===1?{}:{ok:true,tripId:'trip-A'}});});await page.goto('/invite?token=original-token');await expect(page.getByRole('alert')).toContainText('無法載入');await page.getByRole('button',{name:'重試'}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:/Ray.*旅程 A/s})).toBeVisible();await page.getByTestId('invite-accept-btn').click();await expect(page.getByRole('alert')).toBeVisible();await page.getByTestId('invite-accept-btn').click();await expect(page).toHaveURL(/\/trips\?selected=trip-A$/);expect(accepts).toBe(2);
});
test('switch-account link logs out and carries the same invitation into login',async({page})=>{
 await page.route('**/api/**',route=>route.fulfill({json:{}}));await page.route('**/api/oauth/userinfo',route=>route.fulfill({json:{...user,email:'other@example.com'}}));await page.route('**/api/invitations?*',route=>route.fulfill({json:invitation}));let logoutUrl;
 const server=createServer((request,response)=>{
  request.resume();response.writeHead(302,{Location:'http://localhost:3000'+logoutUrl.searchParams.get('redirect_after')});response.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
 await page.route('**/api/oauth/logout?*',route=>{logoutUrl=new URL(route.request().url());return route.continue({url:`http://127.0.0.1:${server.address().port}/logout`});});await page.goto('/invite?token=a%2Fb');await expect(page.getByTestId('invite-mismatch')).toContainText('other@example.com');await page.getByRole('link',{name:'切換帳號並加入'}).focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/\/login\?invitation=a%2Fb$/);expect(new URL(logoutUrl.searchParams.get('redirect_after'),'https://app.test').searchParams.get('invitation')).toBe('a/b');
 } finally { await new Promise(resolve=>server.close(resolve)); }
});
