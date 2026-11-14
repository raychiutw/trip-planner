import { describe, it, expect } from 'vitest';
import { tripDestination } from '../../src/components/shell/navItems';

describe('tripDestination（#1693 側欄與 trip switcher 共用）', () => {
  it('聊天留在 /chat 並帶行程（⌘-click 開新分頁也停在該行程）', () => expect(tripDestination('/chat', 'a b')).toBe('/chat?tripId=a%20b'));
  it('地圖去該行程地圖', () => {
    expect(tripDestination('/map', 'a b')).toBe('/trip/a%20b/map');
    expect(tripDestination('/trip/x/map', 'y')).toBe('/trip/y/map');
  });
  it('其他 root tab 去行程詳情', () => {
    expect(tripDestination('/favorites', 'a')).toBe('/trips?selected=a');
    expect(tripDestination('/trips', 'a')).toBe('/trips?selected=a');
  });
});
