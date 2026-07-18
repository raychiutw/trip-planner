## Context

桌機（rev2 三欄 shell）走 macOS HIG。owner 已研究 iOS HIG 的 CRUD 互動（新增/加入/移除/刪除、可復原→undo、不可逆→Alert、破壞性紅色非 default）並要求整理出 macOS 對應規範寫成文件。`DESIGN.md` 是專案 UI/UX 的 SoT（見 CLAUDE.md「Design SoT」），既有互動 surface 決策（Toast vs Dialog vs Banner）已在其中。此變更把桌機 CRUD 互動規範補進同一份 SoT，並以 OpenSpec spec 落成可測 requirements。

## Goals / Non-Goals

**Goals:**
- `DESIGN.md` 新增「Desktop CRUD Interaction (macOS HIG)」段：動詞語意、確認 vs undo 判準、破壞性樣式與 Alert 排列、macOS 動作入口（toolbar/hover/右鍵/鍵盤），含 iOS↔macOS↔Tripline 桌機對照表。
- OpenSpec `desktop-crud-interaction` spec 作為 normative requirements（可測 scenario）。
- 附「現況對齊盤點」：列現有桌機 CRUD 流程與 macOS-HIG 對齊狀態（informational），供後續實作變更引用。

**Non-Goals:**
- 不改任何現有 CRUD 行為（不加 undo、不加右鍵選單、不改 Alert）— 那是後續獨立實作變更。
- 不涵蓋手機（Flutter）；本規範限桌機 web。
- 不動 code / API / migration。

## Decisions

- **寫進 `DESIGN.md`（非另開 doc）**：DESIGN.md 已是 UI/UX SoT 且含互動 surface 決策，CRUD 規範放同處避免 SoT 分裂。替代方案（獨立 `docs/desktop-crud.md`）被否，理由是增加查找面、易與 DESIGN.md 漂移。
- **OpenSpec spec 為 normative、DESIGN.md 為 human-facing SoT**：spec 用 SHALL/MUST + WHEN/THEN 可被 review/測試引用；DESIGN.md 用對照表 + 規則供設計/實作快速對齊。兩者同義、DESIGN.md 指向 spec。
- **對齊盤點放 design.md 附錄（本檔）而非 DESIGN.md 正文**：盤點是此變更的一次性快照、會隨實作過時；DESIGN.md 只留穩定規範。

## Risks / Trade-offs

- [規範寫了但行為沒對齊，讀者以為已實作] → DESIGN.md 段明標「規範（SoT），現況對齊見 openspec change / 待後續實作」；盤點列出待對齊項。
- [macOS HIG 細節（Alert 按鈕排列、hasDestructiveAction）在 web 無法 1:1 照搬] → 規範以「原則 + web 對映」寫（如「default 最右、破壞非 default」對映到 web 對話框按鈕順序與 class），非要求 native NSAlert。

## Migration Plan

純文件，無部署/回滾。DESIGN.md 段 + OpenSpec spec 合入即生效；後續 CRUD 實作變更引用本 spec 對齊。

## Open Questions

- 現有「刪除景點」是否已有 undo？「移除收藏」是否已無確認？→ 由 tasks 的盤點步驟實查後填入，決定後續實作變更範圍（本變更不修）。

## 附錄：現況對齊盤點（由 tasks 盤點步驟填入）

| 桌機 CRUD 流程 | macOS HIG 規範 | 現況 | 對齊 |
|---|---|---|---|
| 刪除單一景點 | 直接刪 + undo，不確認 | （盤點填） | ⬜ |
| 移除收藏 / 備選 | 「移除」+ 無確認 + 可還原 | （盤點填） | ⬜ |
| 刪除整趟行程 | Alert + 紅色非-default + 動詞 | （盤點填） | ⬜ |
| 批次刪除 | 多選 + 僅永久才確認 | （盤點填） | ⬜ |
| 單筆動作入口 | hover + 右鍵 contextual menu | （盤點填） | ⬜ |
