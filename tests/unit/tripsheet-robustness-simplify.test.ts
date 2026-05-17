// @vitest-environment node
/**
 * v2.31.54 /simplify follow-up: 3 個 robustness fix from 3-agent review of
 * recent ship chain (v2.31.43-49)。
 *
 * 1. **Critical**: TripPage `sheetPortalNode` useEffect deps `[noShell]` only。
 *    AppShell remount（如 host re-render 觸發 portal target 重建）後 cached
 *    ref 變 stale → createPortal 推到 detached DOM → sheet 內容 silent
 *    disappear。改 per-render lookup（`document.getElementById` O(1) cheap）。
 *
 * 2. **High**: TripPage `sheetContent` 沒 useMemo → 每 render 重建 JSX tree
 *    → portal reconcile waste。Memo with deps `[loading, trip, mapRailData,
 *    isDark]`。
 *
 * 3. **Medium**: TripSheet `[role="tabpanel"][hidden]` selector 全 document
 *    scope reach beyond `.trip-sheet-body`。Scope to `.trip-sheet-body
 *    [role="tabpanel"][hidden]` 避免影響其他 page 的 tabpanel。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const TRIP_PAGE = readFileSync(path.join(ROOT, 'src/pages/TripPage.tsx'), 'utf8');
const TRIP_SHEET = readFileSync(path.join(ROOT, 'src/components/trip/TripSheet.tsx'), 'utf8');

describe('v2.31.54 TripSheet robustness simplify', () => {
  describe('TripPage portal node per-render lookup', () => {
    it('不再用 useState<Element> + useEffect setSheetPortalNode 模式（stale ref hazard）', () => {
      expect(TRIP_PAGE).not.toMatch(/const \[sheetPortalNode, setSheetPortalNode\] = useState/);
      expect(TRIP_PAGE).not.toMatch(/setSheetPortalNode\(document\.getElementById/);
    });

    it('改 per-render lookup（getElementById fall through render，非 cached state）', () => {
      expect(TRIP_PAGE).toMatch(/const sheetPortalNode = noShell[\s\S]{0,80}document\.getElementById\(\s*['"]trip-sheet-portal['"]/);
    });
  });

  describe('TripPage sheetContent memoization', () => {
    it('sheetContent 用 useMemo 包（避免每 render 重建 portal subtree）', () => {
      expect(TRIP_PAGE).toMatch(/const sheetContent = useMemo<[\s\S]{0,80}>\(\s*\(\)\s*=>/);
    });
  });

  describe('TripSheet hidden + active flex selectors scope', () => {
    it('[hidden] selector 限定 .trip-sheet-body 子元素（避免影響其他 page）', () => {
      expect(TRIP_SHEET).toMatch(/\.trip-sheet-body\s+\[role=["']tabpanel["']\]\[hidden\]\s*\{\s*display:\s*none/);
    });

    it('active tabpanel flex selector 同樣 scope 到 .trip-sheet-body', () => {
      expect(TRIP_SHEET).toMatch(/\.trip-sheet-body\s+\[role=["']tabpanel["']\]:not\(\[hidden\]\)\s*\{[\s\S]{0,80}flex:\s*1/);
    });
  });
});
