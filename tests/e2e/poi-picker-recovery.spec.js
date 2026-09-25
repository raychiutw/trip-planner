import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks');

for (const add of [false, true]) {
  test(`POI picker keyboard selection and source recovery (add=${add})`, async ({page}) => {
    await setupApiMocks(page);
    await page.route(/maps\.googleapis\.com/, route => route.abort());
    let fail = true;
    await page.route('**/api/poi-favorites', route => route.fulfill({
      status: fail ? 503 : 200, contentType: 'application/json',
      body: JSON.stringify(fail ? {} : [{id:1,poiId:5,poiName:'收藏景點',poiType:'attraction',poiLat:35,poiLng:139}]),
    }));
    await page.route('**/api/poi-search?**', route => route.fulfill({contentType:'application/json',body:'{"results":[]}'}));
    const tripId = MOCK_TRIPS_LIST[0].tripId;
    await page.goto(add ? `/trip/${tripId}/add-stop?day=1&tab=favorites` : `/trip/${tripId}/stop/12/change-poi?mode=alternate&tab=favorites`);
    const retry = page.getByRole('button',{name:'重試載入收藏'});
    await expect(retry).toBeVisible();
    await expect(page.getByRole('alert').filter({hasText:'收藏載入失敗'})).toBeVisible();
    fail = false;
    await retry.focus();
    await page.keyboard.press('Enter');
    const choice = add ? page.getByTestId('add-stop-favorites-card-1').getByRole('checkbox') : page.getByTestId('change-poi-favorite-item-1');
    await expect(choice).toBeVisible();
    await choice.focus();
    await page.keyboard.press('Space');
    if(add) await expect(choice).toBeChecked();
    else await expect(choice).toHaveAttribute('aria-pressed','true');
    await page.getByTestId(add?'add-stop-tab-search':'change-poi-tab-search').click();
    await page.getByPlaceholder('搜尋景點、餐廳、住宿⋯').fill('無結果');
    await expect(page.getByRole('status').filter({hasText:'沒有找到結果'})).toBeVisible();
    await page.getByTestId(add?'add-stop-tab-favorites':'change-poi-tab-favorites').click();
    if(add) await expect(choice).not.toBeChecked();
    else await expect(choice).toHaveAttribute('aria-pressed','false');
  });
}
