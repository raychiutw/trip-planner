/**
 * v2.31.42 fix — Sessions / Trip MapPage 缺 TitleBar back button
 *
 * QA loop @ /settings/sessions + /trip/:id/map screenshot：TitleBar 沒有
 * 返回箭頭，user 進去後只能用 browser back。同 #601 (ConnectedAppsPage /
 * DeveloperAppsPage 缺 back) 的 nav regression 家族。
 *
 * Fix：
 *   - SessionsPage TitleBar 加 back={() => navigate('/account')}
 *   - MapPage TitleBar 加 back={tripId ? () => navigate(`/trip/${tripId}`) : undefined}
 *     （global mode /map → 無 tripId → 無 back ✓；trip-scoped /trip/:id/map →
 *     有 tripId → back to /trip/:id ✓）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SESSIONS_SRC = readFileSync(
  resolve(__dirname, '../../src/pages/SessionsPage.tsx'),
  'utf8',
);
const MAP_SRC = readFileSync(
  resolve(__dirname, '../../src/pages/MapPage.tsx'),
  'utf8',
);

describe('v2.31.42 SessionsPage back button', () => {
  it('import useNavigate', () => {
    expect(SESSIONS_SRC).toMatch(
      /import\s*\{[^}]*\buseNavigate\b[^}]*\}\s*from\s*['"]react-router-dom['"]/,
    );
  });

  it('TitleBar 帶 back callback navigate /account', () => {
    expect(SESSIONS_SRC).toMatch(
      /<TitleBar\s+[^>]*title="登入裝置"[\s\S]*?back=\{\(\)\s*=>\s*navigate\(['"]\/account['"]\)\}/,
    );
  });
});

describe('v2.31.42 MapPage back button (trip-scoped only)', () => {
  it('TitleBar 帶 conditional back callback 用 tripId', () => {
    expect(MAP_SRC).toMatch(
      /<TitleBar[\s\S]*?back=\{tripId\s*\?\s*\(\)\s*=>\s*navigate\(`\/trip\/\$\{[^}]+tripId[^}]*\}`\)\s*:\s*undefined\}/,
    );
  });
});
