import { test, expect } from '@playwright/test';
const row=(id,region='東京')=>({id,poiId:id*100,poiName:`收藏 ${id}`,poiAddress:region,poiType:'restaurant',favoritedAt:'2026-09-25',note:null});
async function setup(page,rows){
 await page.route('**/api/**',r=>r.fulfill({json:[]}));
 await page.route('**/api/oauth/userinfo',r=>r.fulfill({json:{id:'u1',email:'user@test.com'}}));
 await page.route('**/api/poi-favorites',r=>r.fulfill({json:rows}));
}
test('mobile cross-filter selection confirms names and retries only the failed removal',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page,[row(1),row(2,'京都'),row(3,'京都')]);const removed=[];let second=0;
 await page.route('**/api/poi-favorites/*',r=>{
  const id=Number(r.request().url().split('/').at(-1));removed.push(id);return id===2&&++second===1?r.fulfill({status:503,json:{}}):r.fulfill({status:204});
 });
 await page.goto('/favorites');await page.getByTestId('favorites-check-1').check();await page.getByTestId('favorites-region-京都').click();await expect(page.getByTestId('favorites-region-京都')).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'全選本頁'}).click();await expect(page.getByTestId('favorites-toolbar')).toContainText('已選 3 個（1 個不在本頁）');
 await page.getByTestId('favorites-delete-selected').click();const dialog=page.getByRole('alertdialog');await expect(dialog).toContainText('收藏 1（東京）');await expect(dialog).toContainText('收藏 3（京都）');await expect(page.getByTestId('confirm-modal-cancel')).toBeFocused();await page.getByTestId('confirm-modal-confirm').click();
 await expect(page.getByTestId('favorites-delete-result')).toContainText('已移除 2 個');await expect(page.getByTestId('favorites-check-2')).toBeChecked();await expect(page.getByTestId('favorites-card-3')).toHaveCount(0);
 await page.getByTestId('favorites-delete-selected').click();await expect(dialog).toContainText('收藏 2');await expect(dialog).not.toContainText('收藏 1');await page.getByTestId('confirm-modal-confirm').click();await expect(page.getByTestId('favorites-empty')).toBeVisible();expect(removed.sort()).toEqual([1,2,2,3]);
});
test('bottom action bar remains reachable with the 320x450 layout viewport of a 640x900 desktop at 200 percent zoom',async({page})=>{
 await page.setViewportSize({width:320,height:450});await setup(page,Array.from({length:30},(_,i)=>row(i+1)));
 await page.goto('/favorites');await page.getByTestId('favorites-check-1').check();await page.getByTestId('favorites-card-15').scrollIntoViewIfNeeded();
 const toolbar=page.getByTestId('favorites-toolbar');await expect(toolbar).toBeInViewport();const box=await toolbar.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(321);
 await page.getByTestId('favorites-delete-selected').click();await expect(page.getByRole('alertdialog')).toBeVisible();await page.getByTestId('confirm-modal-cancel').click();await expect(page.getByTestId('favorites-check-1')).toBeChecked();
});
