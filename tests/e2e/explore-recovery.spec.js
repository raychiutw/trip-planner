import { test, expect } from '@playwright/test';
const poi=(id,category='cafe')=>({place_id:id,name:`景點 ${id}`,lat:25,lng:121,category});
async function setup(page){
 await page.route('**/api/**',r=>r.fulfill({json:[]}));
 await page.route('**/api/oauth/userinfo',r=>r.fulfill({json:{id:'u1',email:'user@test.com'}}));
}
test('mobile exploration retains pages through pagination and add-to-trip failure recovery',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);let next=0,searches=0,writes=0;
 await page.route('**/api/poi-search?*',r=>{
  searches++;const more=new URL(r.request().url()).searchParams.has('pageToken');if(more&&++next===1)return r.fulfill({status:503,json:{}});
  return r.fulfill({json:more?{results:[poi('A'),poi('B')]}:{results:[poi('A')],nextPageToken:'next'}});
 });
 await page.route('**/api/my-trips',r=>r.fulfill({json:[{tripId:'t1',title:'旅程一'}]}));
 await page.route('**/api/trips/t1/days**',r=>r.fulfill({json:[{id:71,dayNum:1,date:'2026-09-25'}]}));
 await page.route('**/api/trips/t1/days/1/entries',r=>{writes++;return r.fulfill({status:writes===1?503:201,json:writes===1?{}:{id:99}});});
 await page.goto('/explore');await expect(page.getByRole('button',{name:'重試載入更多'})).toBeVisible();await expect(page.getByText('景點 A',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'重試載入更多'}).click();await expect(page.getByText('景點 B',{exact:true})).toBeVisible();await expect(page.getByText('景點 A',{exact:true})).toHaveCount(1);
 await page.getByTestId('explore-search-input').fill('尚未送出的關鍵字');await page.getByTestId('explore-cat-咖啡廳').click();await page.getByTestId('explore-add-to-trip-btn-B').click();
 await page.getByRole('button',{name:'天數',exact:true}).click();await page.getByRole('option',{name:/Day 1/}).click();
 await page.getByTestId('favorites-add-to-trip-submit').click();await expect(page.getByTestId('favorites-add-to-trip-error')).toBeVisible();await expect(page).toHaveURL(/add-to-trip/);
 await page.getByTestId('favorites-add-to-trip-submit').click();await expect(page).toHaveURL(/\/explore$/);await expect(page.getByRole('status').filter({hasText:'已將「景點 B」加入'})).toBeVisible();
 await expect(page.getByTestId('explore-search-input')).toHaveValue('尚未送出的關鍵字');await expect(page.getByText('景點 A',{exact:true})).toBeVisible();await expect(page.getByText('景點 B',{exact:true})).toBeVisible();await expect(page.getByTestId('explore-cat-咖啡廳')).toHaveAttribute('aria-pressed','true');expect(searches).toBe(3);expect(writes).toBe(2);
});
test('desktop region and overflow category controls support keyboard selection and Escape',async({page})=>{
 await page.setViewportSize({width:1280,height:900});await setup(page);const regions=[];
 await page.route('**/api/poi-search?*',r=>{regions.push(new URL(r.request().url()).searchParams.get('region'));return r.fulfill({json:{results:['cafe','aquarium','ramen_restaurant','art_gallery','department_store','shinto_shrine'].map((c,i)=>poi(String(i),c))}});});
 await page.goto('/explore');await expect(page.getByText('景點 0',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'探索地區'}).focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await expect(page.getByRole('button',{name:'探索地區'})).toContainText('東京');await expect.poll(()=>regions.at(-1)).toBe('東京');
 await page.getByTestId('explore-cat-more').focus();await page.keyboard.press('ArrowDown');await expect(page.getByRole('menu')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByTestId('explore-cat-more')).toBeFocused();
 await page.keyboard.press('ArrowDown');await page.keyboard.press('End');await page.keyboard.press('Enter');await expect(page.getByText('景點 5',{exact:true})).toBeVisible();await expect(page.getByText('景點 0',{exact:true})).toHaveCount(0);await expect(page.getByTestId('explore-cat-more')).toContainText('神社');
});
