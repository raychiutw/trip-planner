# macOS HIG 桌機 CRUD 互動規範

## Why

桌機（rev2 三欄 shell）已定調走 macOS HIG，但「新增／加入／移除／刪除」的互動規範（何時直接執行+undo、何時跳確認、破壞性樣式、動作入口）散在對話與 owner 口頭決策裡，沒有落成單一可查的文件。新增/改 CRUD 流程時沒有 SoT 對齊，容易做出 iOS 手勢式（滑動刪除）或誤把可復原操作也跳確認的反 macOS-HIG 設計。此變更把 owner 研究過的 macOS HIG CRUD 對照寫成文件，當桌機互動 SoT。

## What Changes

- 新增 **桌機 CRUD 互動規範** 到 `DESIGN.md`（macOS HIG 對照 iOS 版）：動詞語意（New/Add/Remove/Delete）、可復原→undo vs 不可逆→Alert 的判準、破壞性按鈕樣式與排列、動作入口（toolbar / hover 列尾 / 右鍵 contextual menu / 鍵盤 ⌘N・Delete・⌘Z）。
- 文件化 macOS 特有規則：**不用 FAB / hamburger**；Alert 按鈕右下橫排、**default 最右且只能是安全動作**（破壞按鈕紅色、非 default、高誤觸時 Cancel 當 default）；破壞按鈕固定系統紅、不套品牌色。
- 附「現況對齊盤點」：列出目前桌機 CRUD 流程（刪景點/移除收藏/刪整趟/批次）哪些已符合、哪些待對齊（如缺 undo、缺右鍵選單），供後續實作變更引用（本變更**只寫文件、不改行為**）。
- 純文件（DESIGN.md + OpenSpec spec）；行為對齊留後續獨立變更。

## Capabilities

### New Capabilities
- `desktop-crud-interaction`: 桌機（macOS HIG）新增/加入/移除/刪除的互動規範 — 動詞語意、確認 vs undo 判準、破壞性樣式與 Alert 按鈕排列、動作入口（toolbar/hover/右鍵/鍵盤）。

### Modified Capabilities
<!-- 無既有 capability 的 requirement 變更（本變更為文件化，不改現有行為）。 -->

## Impact

- `DESIGN.md`：新增「Desktop CRUD Interaction (macOS HIG)」段落（互動規範 SoT）。
- `openspec/specs/desktop-crud-interaction/spec.md`：新 capability spec。
- 現況對齊盤點（列在 design.md / 或 DESIGN.md 附錄）：指出待對齊項，供後續實作變更引用。
- **無** code / API / migration 變更；不改任何現有 CRUD 行為。
