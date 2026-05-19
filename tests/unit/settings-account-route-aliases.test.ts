/**
 * v2.32.4 fix — `/account/*` vs `/settings/*` direct URL 跨 prefix routing。
 *
 * Bug context：account hub 用 `/account/*` (appearance/notifications)，sessions
 * 跟 connected-apps 歷史上配在 `/settings/*`。User 直接打 URL 或舊書籤可能
 * 用任一 prefix，但 React Router 沒 alias → catch-all 落 /trips。
 *
 * Fix：4 個 alias route 讓兩個 prefix 都 valid。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const MAIN_SRC = readFileSync(
  path.resolve(__dirname, '../../src/entries/main.tsx'),
  'utf8',
);

describe('main.tsx — account/settings cross-prefix route aliases', () => {
  it('/account/sessions alias 指 SessionsPage', () => {
    expect(MAIN_SRC).toMatch(
      /path="\/account\/sessions"[\s\S]{0,80}<SessionsPage/,
    );
  });

  it('/account/connected-apps alias 指 ConnectedAppsPage', () => {
    expect(MAIN_SRC).toMatch(
      /path="\/account\/connected-apps"[\s\S]{0,80}<ConnectedAppsPage/,
    );
  });

  it('/settings/appearance alias 指 AppearanceSettingsPage', () => {
    expect(MAIN_SRC).toMatch(
      /path="\/settings\/appearance"[\s\S]{0,80}<AppearanceSettingsPage/,
    );
  });

  it('/settings/notifications alias 指 NotificationsSettingsPage', () => {
    expect(MAIN_SRC).toMatch(
      /path="\/settings\/notifications"[\s\S]{0,80}<NotificationsSettingsPage/,
    );
  });

  it('原 /settings/sessions canonical 保留', () => {
    expect(MAIN_SRC).toMatch(/path="\/settings\/sessions"[\s\S]{0,80}<SessionsPage/);
  });

  it('原 /settings/connected-apps canonical 保留', () => {
    expect(MAIN_SRC).toMatch(/path="\/settings\/connected-apps"[\s\S]{0,80}<ConnectedAppsPage/);
  });

  it('原 /account/appearance canonical 保留', () => {
    expect(MAIN_SRC).toMatch(/path="\/account\/appearance"[\s\S]{0,80}<AppearanceSettingsPage/);
  });

  it('原 /account/notifications canonical 保留', () => {
    expect(MAIN_SRC).toMatch(
      /path="\/account\/notifications"[\s\S]{0,80}<NotificationsSettingsPage/,
    );
  });
});
