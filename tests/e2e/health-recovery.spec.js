import {test,expect} from '@playwright/test';
const {setupApiMocks,MOCK_TRIPS_LIST}=require('./api-mocks');
test('rerun retains last report through failed polling and keyboard retry reads the new result',async({page})=>{
 await setupApiMocks(page);const tripId=MOCK_TRIPS_LIST[0].tripId;let posted=false,fail=false,posts=0;
 const finding={severity:'high',title:'舊報告問題',description:'時程需要調整',actionTarget:{day:2}};
 const report={tripId,status:'completed',requestId:1,createdAt:'2026-09-25 03:00:00',findings:[finding]};
 await page.route('**/api/permissions?*',route=>route.fulfill({json:[]}));await page.route('**/api/invitations?*',route=>route.fulfill({json:[]}));
 await page.route(`**/api/trips/${tripId}/health-check`,route=>{
  if(route.request().method()==='POST'){posted=true;fail=true;posts++;return route.fulfill({json:{report:{...report,status:'pending',requestId:2,findings:[]}}});}
  return route.fulfill({status:fail?500:200,json:fail?{}:{report:posted?{...report,requestId:2,findings:[{...finding,title:'新報告問題'}]}:report}});
 });
 await page.goto(`/trip/${tripId}/health`);await expect(page.getByText('舊報告問題')).toBeVisible();await page.getByTestId('ai-health-start-btn').click();
 await expect(page.getByText('舊報告問題')).toBeVisible();const retry=page.getByRole('button',{name:'重試健檢狀態'});await expect(retry).toBeVisible({timeout:10000});
 await expect(page.getByText(/最新狀態未知/)).toBeVisible();await expect(page.getByTestId('ai-health-start-btn')).toBeDisabled();fail=false;
 await retry.focus();await page.keyboard.press('Enter');await expect(page.getByText('新報告問題')).toBeVisible();expect(posts).toBe(1);
 await expect(page.getByText('高優先')).toBeVisible();await page.getByRole('button',{name:'前往 Day 2'}).click();await expect(page).toHaveURL(new RegExp(`/trips\\?selected=${tripId}&focusDay=2#day2$`));await expect(page.getByTestId('dn-day-2')).toHaveAttribute('aria-current','true');
});
