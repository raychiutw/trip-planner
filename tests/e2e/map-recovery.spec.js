import { test, expect } from '@playwright/test';

async function setup(page) {
  await page.route('**/api/**', r => r.fulfill({ json: [] }));
  await page.route('**/api/oauth/userinfo', r => r.fulfill({ json: { id: 'reader', email: 'reader@test.com' } }));
  await page.route('**/api/my-trips', r => r.fulfill({ json: [{ tripId: 't1', name: '唯讀行程' }] }));
  await page.route('**/api/trips/t1', r => r.fulfill({ json: { id: 't1', name: '唯讀行程', published: 1 } }));
  await page.route('**/api/trips/t1/days?all=1', r => r.fulfill({ json: [1, 2].map(dayNum => ({
    id: dayNum, dayNum, timeline: [1, 2].map(i => ({ id: dayNum * 10 + i, sortOrder: i, startTime: '09:00',
      stopPois: [{ poiId: dayNum * 10 + i, sortOrder: 1, name: `第${dayNum}天景點${i}非常長的景點名稱測試`, type: 'attraction', lat: 25 + dayNum + i / 10, lng: 127 }],
    })),
  })) }));
  await page.route('**/api/route**', r => r.fulfill({ json: { polyline: [], duration: null, distance: 0 } }));
  await page.addInitScript(() => {
    class Map {
      constructor(el, options) {
        this.el = el; this.zoom = options.zoom;
        const credit = document.createElement('a'); credit.textContent = 'Google attribution'; credit.href = '#'; credit.dataset.testid = 'sdk-attribution';
        credit.style.cssText = 'position:absolute;bottom:0;left:0;background:white;height:20px;z-index:1'; el.append(credit);
        const controls = document.createElement('div'); controls.style.cssText = 'position:absolute;right:8px;top:50%;transform:translateY(-50%);display:grid;z-index:2';
        for (const [label, delta] of [['放大地圖', 1], ['縮小地圖', -1]]) {
          const button = document.createElement('button'); button.textContent = delta > 0 ? '+' : '−'; button.setAttribute('aria-label', label); button.style.cssText = 'width:44px;height:44px;background:white';
          button.onclick = () => this.setZoom(this.zoom + delta); controls.append(button);
        }
        if (options.zoomControl) el.append(controls);
      }
      addListener() { return { remove() {} }; }
      panTo(coord) { this.center = coord; this.el.dataset.center = JSON.stringify(coord); }
      setCenter(coord) { this.panTo(coord); }
      setZoom(zoom) { this.zoom = zoom; this.el.dataset.zoom = String(zoom); }
      getZoom() { return this.zoom; }
      fitBounds() {}
      setMapTypeId() {}
    }
    class Marker {
      constructor(options) {
        this.el = document.createElement('button'); this.el.textContent = options.title;
        this.el.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:36px;max-height:36px;overflow:hidden;background:white';
        this.el.setAttribute('aria-label', options.title); this.map = options.map;
      }
      set map(value) { if (value) value.el.append(this.el); else this.el.remove(); }
      addListener(_, fn) { this.el.onclick = fn; return { remove: () => { this.el.onclick = null; } }; }
      set content(_) {}
    }
    window.google = { maps: { Map, marker: { AdvancedMarkerElement: Marker }, LatLngBounds: class { extend() {} }, Polyline: class { setMap() {} setOptions() {} },
      ControlPosition: { RIGHT_CENTER: 8 }, event: { trigger() {} }, importLibrary: async () => ({ Map }),
    } };
  });
}

for (const viewport of [{ width: 320, height: 450 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
test(`map controls, attribution and selected card remain reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
  await page.setViewportSize(viewport); await setup(page);
  await page.goto('/trip/t1/map?day=all');
  const day2 = page.getByTestId('map-day-2'); await day2.click();
  const card = page.locator('[data-card-entry-id="22"]'); await card.click(); await expect(card).toHaveAttribute('aria-current', 'true');
  const map = page.getByRole('application'); await expect(map).toHaveAttribute('data-center', JSON.stringify({ lat: 27.2, lng: 127 }));
  const zoom = page.getByRole('button', { name: '放大地圖', exact: true }); await zoom.click(); await expect(map).toHaveAttribute('data-zoom', '17');
  await zoom.focus(); await page.keyboard.press('Enter'); await expect(map).toHaveAttribute('data-zoom', '18');
  const attribution = page.getByTestId('sdk-attribution'); await attribution.scrollIntoViewIfNeeded();
  for (const item of [attribution, page.getByTestId('map-fab-layers'), page.getByRole('link', { name: '查看行程列表' })]) {
    await item.scrollIntoViewIfNeeded(); await expect(item).toBeVisible();
    expect(await item.evaluate(el => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { clear: el === hit || el.contains(hit), rect: r.toJSON(), hit: hit?.outerHTML.slice(0, 240) }; }), await item.textContent()).toMatchObject({ clear: true });
  }
  const selectedMarker = page.getByRole('button', { name: '第 2 站：第2天景點2非常長的景點名稱測試', exact: true });
  await selectedMarker.click(); await expect(card).toHaveAttribute('aria-current', 'true');
});

}

test('failed trip data remains a failure and provides a list entry', async ({ page }) => {
  await setup(page); await page.route('**/api/trips/t1/days?all=1', r => r.fulfill({ status: 503, json: {} }));
  await page.goto('/trip/t1/map'); await expect(page.getByText('行程資料載入失敗')).toBeVisible();
  await expect(page.getByRole('link', { name: '查看行程列表' })).toHaveAttribute('href', '/trip/t1');
  await expect(page.getByText('這趟行程尚無景點')).toHaveCount(0);
});
