import {test,expect} from '@playwright/test';
const {setupApiMocks}=require('./api-mocks');
test('public share retry preserves the link and keyboard login return path',async({page})=>{
 await setupApiMocks(page);
 await page.route('**/api/oauth/userinfo',route=>route.fulfill({status:401,json:{}}));
 let fail=true;let clones=0;
 await page.route('**/api/share/**',route=>{
  if(route.request().method()==='POST'){clones++;return route.fulfill({json:{tripId:'copy'}});}
  return route.fulfill({status:fail?500:200,json:fail?{}:{meta:{name:'分享行程',title:'沖繩分享',sharedBy:'Ray'},days:[],notes:{}}});
 });
 await page.goto('/s/browser-token');
 await expect(page.getByRole('heading',{name:'暫時無法載入分享'})).toBeVisible();
 await expect(page.getByText('連結已失效')).toHaveCount(0);
 const retry=page.getByRole('button',{name:'重新載入分享'});fail=false;
 await retry.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{level:1,name:'沖繩分享'})).toBeVisible();
 expect(clones).toBe(0);
 const copy=page.getByTestId('share-copy');await copy.focus();await page.keyboard.press('Enter');
 await expect(page).toHaveURL(/login\?redirect_after=%2Fs%2Fbrowser-token/);
 expect(clones).toBe(0);
});
test('expired public share has no copy or export controls',async({page})=>{
 await setupApiMocks(page);
 await page.route('**/api/share/**',route=>route.fulfill({status:404,json:{error:'NOT_FOUND'}}));
 await page.goto('/s/expired-token');
 await expect(page.getByRole('heading',{name:'連結已失效'})).toBeVisible();
 await expect(page.getByTestId('share-copy')).toHaveCount(0);
 await expect(page.getByTestId('share-pdf')).toHaveCount(0);
});
