import { test, expect } from '@playwright/test';
const days=[{id:1,dayNum:1,date:'2026-09-25',timeline:[]},{id:2,dayNum:2,date:'2026-09-26',timeline:[]}];
async function setup(page) {
  await page.route('**/api/**',r=>r.fulfill({json:[]}));
  await page.route('https://maps.googleapis.com/**',r=>r.abort());
  await page.route('**/api/oauth/userinfo',r=>r.fulfill({json:{id:'owner',email:'owner@example.com',displayName:'Ray'}}));
  await page.route('**/api/trips/A',r=>r.fulfill({json:{tripId:'A',title:'旅程 A',ownerUserId:'owner',destinations:[]}}));
  await page.route('**/api/trips/A/days**',r=>r.fulfill({json:days}));
  await page.route('**/api/places/autocomplete',r=>r.fulfill({json:{predictions:[{placeId:'A',primaryText:'台北車站',secondaryText:'台灣'}]}}));
}
test('mobile custom POI resolves a Google address without map or geolocation, keeps failed drafts, and submits in a reduced viewport',async({page,context})=>{
  await context.clearPermissions();await page.setViewportSize({width:390,height:844});await setup(page);
  let resolves=0,writes=0,payload;
  await page.route('**/api/places/resolve?*',r=>{resolves++;return r.fulfill({status:resolves===1?503:200,json:resolves===1?{}:{lat:25.047,lng:121.517}});});
  await page.route('**/api/trips/A/days/1/entries',r=>{writes++;payload=r.request().postDataJSON();return r.fulfill({status:writes===1?503:201,json:writes===1?{}:{id:10}});});
  await page.goto('/trip/A/add-custom-stop?day=1');await page.getByTestId('add-custom-stop-title').fill('朋友家');await expect(page.getByTestId('add-custom-stop-confirm')).toBeDisabled();
  await page.getByRole('combobox').fill('台北');await expect(page.getByRole('option')).toBeVisible();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await expect(page.getByText(/無法確認地址位置/)).toBeVisible();
  await page.getByRole('button',{name:'重試地址位置'}).click();await expect(page.getByText(/已選位置：緯度/)).toContainText('25.0470');await expect(page.getByTestId('add-custom-stop-title')).toHaveValue('朋友家');
  await page.getByRole('spinbutton',{name:'停留（分鐘）'}).fill('60');await page.getByRole('button',{name:'開始時間'}).click();await page.getByRole('button',{name:'09',exact:true}).click();
  await page.getByTestId('add-custom-stop-note').fill('按門鈴');await page.getByTestId('add-custom-stop-note').focus();await page.setViewportSize({width:390,height:360});
  await page.getByTestId('add-custom-stop-confirm').click();await expect(page.getByTestId('add-custom-stop-error')).toContainText('儲存失敗');await expect(page.getByTestId('add-custom-stop-note')).toHaveValue('按門鈴');
  await page.getByTestId('add-custom-stop-confirm').click();await expect(page).not.toHaveURL(/add-custom-stop/);expect(writes).toBe(2);expect(payload).toMatchObject({name:'朋友家',lat:25.047,lng:121.517,time:'09:00',note:'60 分 · 按門鈴',source:'custom'});
});
test('mobile back button protects an address-only mobile draft and cancel restores the field',async({page})=>{
  await page.setViewportSize({width:390,height:844});await setup(page);await page.goto('/trip/A/add-custom-stop?day=1');
  await page.getByRole('combobox').fill('尚未選擇的地址');await page.getByRole('button',{name:'返回',exact:true}).click();await expect(page.getByRole('alertdialog')).toBeVisible();await expect(page.getByTestId('confirm-modal-cancel')).toBeFocused();
  await page.getByTestId('confirm-modal-cancel').click();await expect(page.getByRole('combobox')).toHaveValue('尚未選擇的地址');
  await page.getByRole('button',{name:'返回',exact:true}).click();await page.getByTestId('confirm-modal-confirm').click();await expect(page).not.toHaveURL(/add-custom-stop/);
});
test('desktop change POI custom draft protects source switches and resolves without a working map',async({page})=>{
  await page.setViewportSize({width:1280,height:900});await setup(page);
  await page.route('**/api/trips/A/entries/9',r=>r.fulfill({json:{id:9,entryPoisVersion:'v1'}}));
  await page.route('**/api/places/resolve?*',r=>r.fulfill({json:{lat:25.047,lng:121.517}}));
  let body;await page.route('**/api/trips/A/entries/9/poi-id',r=>{body=r.request().postDataJSON();return r.fulfill({json:{ok:true}});});
  await page.goto('/trip/A/stop/9/change-poi?tab=custom');await page.getByTestId('change-poi-custom-title').fill('朋友家');await page.getByRole('combobox').fill('台北');await expect(page.getByRole('option')).toBeVisible();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(page.getByTestId('change-poi-submit')).toBeEnabled();await page.getByTestId('change-poi-tab-search').click();await expect(page.getByRole('alertdialog')).toBeVisible();await page.getByTestId('confirm-modal-cancel').click();await expect(page.getByTestId('change-poi-custom-title')).toHaveValue('朋友家');
  await page.getByTestId('change-poi-submit').click();await expect(page).not.toHaveURL(/change-poi/);expect(body).toMatchObject({name:'朋友家',lat:25.047,lng:121.517,source:'custom'});
});
