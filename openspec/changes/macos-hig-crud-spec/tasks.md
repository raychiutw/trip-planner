## 1. 現況對齊盤點（只讀，不改行為）

- [ ] 1.1 盤點「刪除單一景點」：是否直接刪 + undo（toast）還是跳確認？（查 TimelineRail / EditEntryPage 刪除路徑）
- [ ] 1.2 盤點「移除收藏 / 備選」：文案是「移除」還是「刪除」？有無確認？可否還原？（查 PoiFavoritesPage / 備選 UI）
- [ ] 1.3 盤點「刪除整趟行程」：是否 Alert + 紅色破壞按鈕 + 非 default + 動詞文案？（查 EditTripPage / overflow menu / ConfirmModal）
- [ ] 1.4 盤點「批次刪除」與「單筆動作入口」：有無多選？入口是 hover 列尾 / 右鍵 contextual menu，還是只有固定按鈕？有無誤用 FAB / hamburger？
- [ ] 1.5 把 1.1–1.4 結果填進 `design.md` 附錄對齊表（現況 + ✅/⬜），標出待對齊項供後續實作變更引用

## 2. 寫入 DESIGN.md（互動規範 SoT）

- [ ] 2.1 在 `DESIGN.md` 新增「Desktop CRUD Interaction (macOS HIG)」段：動詞語意（New/Add/Remove/Delete）
- [ ] 2.2 補「可復原→undo（⌘Z/toast）vs 不可逆→Alert」判準 + iOS↔macOS↔Tripline 桌機對照表
- [ ] 2.3 補破壞性規則：紅色、非 default/主色；Alert 按鈕右下橫排、default 最右且只做安全動作、高誤觸時 Cancel 當 default；按鈕用動詞非「確定/是/否」
- [ ] 2.4 補 macOS 動作入口：toolbar 標準 ＋（⌘N）/ hover 列尾 + 右鍵 contextual menu（+ Delete）/ undo ⌘Z / 批次多選；明標桌機不用 FAB / hamburger / 滑動手勢
- [ ] 2.5 段首標「規範為 SoT，現況對齊見 openspec change `macos-hig-crud-spec`」，並 cross-link `openspec/specs/desktop-crud-interaction`

## 3. 驗證與收尾

- [ ] 3.1 `openspec validate macos-hig-crud-spec --strict` 通過
- [ ] 3.2 走 `/ship`（feature branch + PR），本變更純文件、無 code/測試
