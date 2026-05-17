// @vitest-environment node
/**
 * v2.31.46 fix #143: desktop trip detail sticky map regression — portal-based。
 *
 * Bug 取證（自 v2.17.17, ~3 months）：viewport ≥1024 進 /trips?selected=X：
 *   - TripsListPage AppShell 沒傳 sheet prop（line 1185-1188）
 *   - TripPage embedded mode `noShell=true` 走 `return wrappedMain`（line 754-755）
 *     → 內部算的 `sheetContent` (TripSheet with map + pins) 直接 throw away
 *   - AppShell layout 退化 3-pane→2-pane，右側空白 ~40vw
 *
 * v2.31.41 #604 attempt 用 callback prop + parent setState → strict mode
 * 雙倍 fire + useMemo deps identity 變動 → infinite re-render → prod
 * ErrorBoundary。已 revert #606。
 *
 * Safer approach (this PR)：React Portal。
 *   1. AppShell `sheetPortalId?: string` prop — 即使 no `sheet` content
 *      也 render empty `<aside id={sheetPortalId} className="app-shell-sheet" />`
 *      + 使用 3-pane layout（讓 grid 第 3 column 存在給 portal 掛載）
 *   2. TripsListPage embedded mode pass `sheetPortalId="trip-sheet-portal"`
 *   3. TripPage embedded mode useEffect 拿 portal node + createPortal
 *      render `sheetContent` 到該 DOM。
 *
 * 為何 portal 安全：
 *   - Portal render 內容直接掛 target DOM，不經 parent state → 無 parent
 *     re-render storm。
 *   - useEffect 拿 DOM 是 read-only（setSheetPortalNode），不依賴 child
 *     content 變動。
 *   - Strict mode 雙倍 fire 第二次 setState 同值，React bail out 不 re-render。
 *
 * Pure-text grep on source（3 個檔）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const APP_SHELL = readFileSync(path.join(ROOT, 'src/components/shell/AppShell.tsx'), 'utf8');
const TRIP_PAGE = readFileSync(path.join(ROOT, 'src/pages/TripPage.tsx'), 'utf8');
const TRIPS_LIST = readFileSync(path.join(ROOT, 'src/pages/TripsListPage.tsx'), 'utf8');

describe('v2.31.46 sticky map portal wiring', () => {
  describe('AppShell sheetPortalId prop', () => {
    it('AppShellProps interface 含 sheetPortalId?: string', () => {
      expect(APP_SHELL).toMatch(/sheetPortalId\?:\s*string/);
    });

    it('layout 3-pane 條件含 sheet OR sheetPortalId', () => {
      // 拿掉舊的 `sheet ? 3PANE : 2PANE`，改 `(sheet || sheetPortalId) ? 3PANE : 2PANE`
      expect(APP_SHELL).toMatch(/sheet\s*\|\|\s*sheetPortalId/);
    });

    it('aside.app-shell-sheet render condition 含 sheetPortalId（即使 no content）', () => {
      expect(APP_SHELL).toMatch(/sheet\s*\|\|\s*sheetPortalId.*\n[\s\S]*?<aside className="app-shell-sheet"[^>]*id=\{sheetPortalId\}/);
    });
  });

  describe('TripsListPage embedded mode wiring', () => {
    it('AppShell 接 sheetPortalId="trip-sheet-portal"（embedded TripPage view）', () => {
      // 允許 string literal 或 JSX conditional expression 含 'trip-sheet-portal'
      expect(TRIPS_LIST).toMatch(/sheetPortalId=\{?[^}]*['"]trip-sheet-portal['"]/);
    });
  });

  describe('TripPage embedded mode portal render', () => {
    it('import createPortal from react-dom', () => {
      expect(TRIP_PAGE).toMatch(/import\s*\{[^}]*createPortal[^}]*\}\s*from\s*['"]react-dom['"]/);
    });

    it('useEffect 取 portal DOM node + state', () => {
      expect(TRIP_PAGE).toMatch(/sheetPortalNode/);
      expect(TRIP_PAGE).toMatch(/getElementById\(\s*['"]trip-sheet-portal['"]\s*\)/);
    });

    it('embedded mode return 含 createPortal call（sheetContent → portal node）', () => {
      expect(TRIP_PAGE).toMatch(/createPortal\(/);
    });

    it('不再用 callback prop setSheet（pre v2.31.41 revert pattern）', () => {
      expect(TRIP_PAGE).not.toMatch(/setSheet\?:/);
      expect(TRIP_PAGE).not.toMatch(/setSheet\(sheetContent\)/);
    });
  });
});
