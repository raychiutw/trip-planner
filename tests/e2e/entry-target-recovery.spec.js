import {test,expect} from '@playwright/test';
const {setupApiMocks,MOCK_TRIPS_LIST}=require('./api-mocks');
for(const favorite of [true,false]){
 test(`entry target dates recover without losing input (favorite=${favorite})`,async({page})=>{
  await setupApiMocks(page);
  await page.route(/maps\.googleapis\.com/,route=>route.abort());
  const tripId=MOCK_TRIPS_LIST[0].tripId;
  await page.route('**/api/my-trips',route=>route.fulfill({json:[{tripId,name:'目標行程'}]}));
  await page.route('**/api/poi-favorites',route=>route.fulfill({json:[{id:5,poiId:1,poiName:'保留景點',poiType:'attraction'}]}));
  let fail=true;
  await page.route(`**/api/trips/${tripId}/days`,route=>route.fulfill({status:fail?500:200,json:fail?{}:[{id:1,dayNum:1,date:'2026-09-25',label:'首日'}]}));
  await page.goto(favorite?'/favorites/5/add-to-trip':`/trip/${tripId}/add-entry?day=1`);
  const retry=page.getByRole('button',{name:'重試載入日期'});
  await expect(retry).toBeVisible();
  if(favorite){
   await expect(page.getByText('該行程沒有天數')).toHaveCount(0);
   for(const [field,hour] of [['start','09'],['end','10']]){
    await page.getByTestId(`favorites-add-to-trip-${field}`).getByRole('button').click();
    await page.locator(`[data-h="${hour}"]`).click();
    await page.getByTestId(`favorites-add-to-trip-${field}`).getByRole('button').click();
    await page.locator('[data-m="00"]').click();
   }
  }
  const submit=page.getByTestId(favorite?'favorites-add-to-trip-submit':'add-entry-pick-search');
  await expect(submit).toBeDisabled();
  fail=false;await retry.focus();await page.keyboard.press('Enter');
  await expect(submit).toBeEnabled();
  if(favorite){
   await expect(page.getByText('保留景點')).toBeVisible();
   await expect(page.getByTestId('favorites-add-to-trip-start')).toContainText('09:00');
   await expect(page.getByTestId('favorites-add-to-trip-end')).toContainText('10:00');
  }else{
   await submit.click();
   await expect(page).toHaveURL(/change-poi\?mode=new&day=1&tab=search/);
  }
 });
}
