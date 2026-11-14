import { describe, it, expect } from 'vitest';
import { resolvePage } from '../../src/hooks/useDocumentTitle';

describe('resolvePage 路由對應頁名', () => {
  const cases: Array<[string, string, boolean]> = [
    ['/trip/abc/add-custom-stop', '自訂景點', true],
    ['/trip/abc/add-stop', '加入景點', true],
    ['/trip/abc/stop/9/map', '地圖', true],
    ['/trip/abc', '行程', true],
    ['/trips/new', '新增行程', false],
    ['/favorites/12/add-to-trip', '收藏', false],
    ['/signup/check-email', '註冊', false],
    ['/oauth/consent', '授權', false],
    ['/s/tok', '分享行程', false],
  ];
  for (const [path, label, withTrip] of cases) {
    it(path, () => expect(resolvePage(path)).toEqual([label, withTrip]));
  }
  it('未知路徑回 null', () => expect(resolvePage('/nope')).toBeNull());
});
