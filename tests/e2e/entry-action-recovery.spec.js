import { test, expect } from '@playwright/test';
const days=[{id:71,dayNum:1,date:'2026-09-25',timeline:[]},{id:72,dayNum:2,date:'2026-09-26',timeline:[]}];
async function setup(page) {
 await page.route('**/api/**',r=>r.fulfill({json:[]}));
 await page.route('**/api/oauth/userinfo',r=>r.fulfill({json:{id:'owner',email:'owner@example.com'}}));
 await page.route('**/api/trips/t1/days**',r=>r.fulfill({json:days}));
 await page.route('**/api/trips/t1/entries/42',r=>r.fulfill({json:{id:42,dayId:71}}));
}
test('mobile copy recovers traffic without creating a second entry',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);
 let writes=0,traffic=0,body;
 await page.route('**/api/trips/t1/entries/42/copy',r=>{writes++;body=r.request().postDataJSON();return r.fulfill({json:{id:77}});});
 await page.route('**/api/trips/t1/recompute-travel?*',r=>{traffic++;return r.fulfill({status:traffic===1?503:200,json:{}});});
 await page.goto('/trip/t1/stop/42/copy');await page.getByTestId('entry-action-day-1').click();
 await page.getByRole('button',{name:'複製到時段'}).click();await page.getByRole('option',{name:/午餐/}).click();
 await page.getByTestId('entry-action-confirm').click();await expect(page.getByRole('status').filter({hasText:'景點已複製到 Day 1'})).toBeVisible();
 await expect(page.getByTestId('entry-action-day-2')).toBeDisabled();expect(writes).toBe(1);expect(body).toEqual({targetDayId:71,time:'12:00-13:30'});
 await page.getByRole('button',{name:'重試交通更新'}).click();await expect(page).toHaveURL(/\/trips\?selected=t1/);expect(writes).toBe(1);expect(traffic).toBe(2);
});
test('desktop move retries date loading, uses keyboard day selection and restores only failed source traffic',async({page})=>{
 await page.setViewportSize({width:1280,height:900});await setup(page);
 let failRead=true,writes=0,body;const traffic=[];
 await page.route('**/api/trips/t1/days**',r=>r.fulfill({status:failRead?503:200,json:failRead?{}:days}));
 await page.route('**/api/trips/t1/entries/42',r=>{
  if(r.request().method()==='GET')return r.fulfill({json:{id:42,dayId:71}});
  writes++;body=r.request().postDataJSON();return r.fulfill({json:{id:42,dayId:72}});
 });
 await page.route('**/api/trips/t1/recompute-travel?*',r=>{
  const day=new URL(r.request().url()).searchParams.get('day');traffic.push(day);
  return r.fulfill({status:day==='1'&&traffic.filter(d=>d==='1').length===1?503:200,json:{}});
 });
 await page.goto('/trip/t1/stop/42/move');await expect(page.getByRole('button',{name:'重新載入日期'})).toBeVisible();failRead=false;
 await page.getByRole('button',{name:'重新載入日期'}).click();await expect(page.getByTestId('entry-action-day-1')).toBeDisabled();
 await page.getByTestId('entry-action-day-2').focus();await page.keyboard.press('Space');await expect(page.getByTestId('entry-action-day-2')).toHaveAttribute('aria-checked','true');
 await page.getByTestId('entry-action-confirm').click();await expect(page.getByText(/景點已移動到 Day 2.*交通尚未/)).toBeVisible();
 await page.getByRole('button',{name:'重試交通更新'}).click();await expect(page).toHaveURL(/\/trips\?selected=t1/);
 expect(writes).toBe(1);expect(body).toEqual({day_id:72});expect(traffic.filter(d=>d==='1')).toHaveLength(2);expect(traffic.filter(d=>d==='2')).toHaveLength(1);
});
