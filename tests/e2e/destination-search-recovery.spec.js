import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks');

for (const edit of [false, true]) {
  test(`destination search keyboard selection and recovery (edit=${edit})`, async ({page}) => {
    await setupApiMocks(page);
    await page.route(/maps\.googleapis\.com/, route => route.abort());
    let fail = false;
    await page.route('**/api/poi-search?**', route => route.fulfill({
      status: fail ? 503 : 200, contentType: 'application/json',
      body: JSON.stringify({results:[{place_id:'test-destination',name:'測試目的地',lat:35,lng:139}]}),
    }));
    await page.goto(edit ? `/trip/${MOCK_TRIPS_LIST[0].tripId}/edit` : '/trips/new');
    if(edit) await page.getByTestId('edit-trip-dest-add-btn').click();
    const input = page.getByTestId(edit ? 'edit-trip-dest-search-input' : 'new-trip-destination-input');
    await input.fill('測試');
    const option = page.getByRole('option',{name:'測試目的地'});
    await expect(option).toBeVisible();
    await input.press('Tab');
    await expect(option).toBeFocused();
    await page.keyboard.press('Enter');
    const selected = page.getByTestId(edit ? 'edit-trip-dest-rows' : 'new-trip-destination-rows');
    await expect(selected).toContainText('測試目的地');
    if(edit) await page.getByTestId('edit-trip-dest-add-btn').click();
    fail = true;
    await input.fill('第二站');
    await page.getByRole('button',{name:'重試搜尋'}).waitFor();
    await expect(selected).toContainText('測試目的地');
    fail = false;
    await page.getByRole('button',{name:'重試搜尋'}).click();
    await expect(option).toBeVisible();
    await expect(selected).toContainText('測試目的地');
  });
}
