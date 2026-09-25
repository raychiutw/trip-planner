import {test,expect} from '@playwright/test';
const {setupApiMocks,MOCK_TRIPS_LIST}=require('./api-mocks');
test('date dialog keyboard lifecycle, failed shift and read-only refresh recovery',async({page})=>{
 await setupApiMocks(page);const tripId=MOCK_TRIPS_LIST[0].tripId;let shifted=false,failWrite=true,failRead=true,posts=0;
 await page.route('**/api/permissions?*',route=>route.fulfill({json:[]}));await page.route('**/api/invitations?*',route=>route.fulfill({json:[]}));
 await page.route(`**/api/trips/${tripId}/days?all=1`,route=>route.fulfill({status:shifted&&failRead?500:200,json:shifted&&failRead?{}:[{id:1,dayNum:1,date:shifted?'2026-05-03':'2026-05-01',dayOfWeek:'五',timeline:[]},{id:2,dayNum:2,date:shifted?'2026-05-04':'2026-05-02',dayOfWeek:'六',timeline:[]}]}));
 await page.route(`**/api/trips/${tripId}/days/shift`,route=>{posts++;if(failWrite)return route.fulfill({status:500,json:{error:{message:'日期提交失敗'}}});shifted=true;return route.fulfill({json:{shifted:2}});});
 await page.goto(`/trip/${tripId}/edit`);const opener=page.getByTestId('edit-trip-day-shift-btn');await opener.focus();await page.keyboard.press('Enter');
 let dialog=page.getByTestId('edit-trip-shift-modal');await expect(dialog).toHaveAccessibleName('變更出發日期');await expect(dialog).toBeFocused();
 await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'變更出發日期'})).toBeFocused();await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(opener).toBeFocused();
 await opener.click();dialog=page.getByTestId('edit-trip-shift-modal');await dialog.getByRole('button',{name:'變更出發日期'}).click();await dialog.getByRole('button',{name:/May 3rd,/}).click();
 await expect(dialog.getByTestId('edit-trip-shift-preview')).toContainText('5/4');await dialog.getByRole('button',{name:'確認變更'}).click();await expect(dialog.getByRole('alert')).toHaveText('日期提交失敗');await expect(dialog.getByRole('button',{name:'變更出發日期'})).toContainText('2026-05-03');
 failWrite=false;await dialog.getByRole('button',{name:'確認變更'}).click();await expect(dialog).toBeHidden();const retry=page.getByRole('button',{name:'重試讀取天數'});await expect(retry).toBeVisible();await expect(page.getByText('行程天數',{exact:true})).toBeFocused();
 failRead=false;await retry.click();await expect(opener).toContainText('5/3');expect(posts).toBe(2);
});
