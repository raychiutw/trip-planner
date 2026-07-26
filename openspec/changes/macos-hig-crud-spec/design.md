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

- ~~現有「刪除景點」是否已有 undo？「移除收藏」是否已無確認？~~ → **2026-07-25 盤點完成**，見下方附錄。兩者答案都是「否」，而且**「移除收藏」的規範本身已被 W12 推翻、需要 owner 重新裁決** —— 見附錄的「⚠ 規範衝突」。

## ⚖️ 已裁決：收藏走 W12（不可復原、跳確認、無 restore）

**本 change 是 2026-07-18 的提案（commit `f1cd92dd`）。2026-07-24 ship 的 W12 刪除政策（v2.57.21 / PR #1123）對同一件事下了相反的裁決，時間在後。**

| | W12 刪除政策 | 本 change 的 spec |
|---|---|---|
| 日期／狀態 | **2026-07-24 已 ship** | 2026-07-18 提案，未實作 |
| 收藏取消 | 跳同一個不可復原確認、**無 undo**、**不提供 restore** | 不跳確認、**可即刻還原** |
| code 連帶 | 已執行：`functions/api/poi-favorites/[id]/restore.ts` 與 `UNDO_EXPIRED` **已刪除**（同一個 commit `206594b9`），驗收條件是「無 restore 路徑殘留」 | — |
| 佐證 | `docs/plans/apple-hig-compliance/tickets.md` 的 W12 條目 | 本檔 |

`docs/backend-tasks/2026-07-18-poi-favorites-undo-restore-api.md` 首行已自帶 SUPERSEDED banner 指向 W12 —— 也就是**後端側早就知道被推翻了，但本 change 的 spec 沒有同步**。

**下游影響**：#1150 拆出的 #1164（通知訊息支援動作按鈕）與 #1165（收藏刪除接上復原）都建立在本 change 未被推翻的假設上。#1165 的本文更直接寫「按下呼叫**既有的**後端復原端點」、「後端其實**早就有**復原端點，前端從來沒接上」—— **那個端點在 2026-07-24 已被刪除**，票在描述 W12 之前的狀態。

**owner 2026-07-26 裁決：維持 W12（上述選項 1）。** 落地：

- 本 change 的 spec 把「移除收藏」從「可復原」移到「不可逆」一列 —— Scenario 已改寫為「收藏不適用本 Requirement」。
- `DESIGN.md` 的紅字改寫為定案敘述（收藏走不可逆一列；「可復原 → undo」那一列目前零 call-site，為將來預留）。
- **#1165 關為 superseded** —— 它的本文寫「按下呼叫既有的後端復原端點」，而該端點 2026-07-24 已被 W12 刪除，票在描述 W12 之前的狀態。
- **#1164 標為 blocked／待重評** —— 它自述唯一目的是「收藏刪除復原（下一票）要用的能力」，該消費者消失後屬 YAGNI，不先做。
- **動詞條款不受影響、另開 #1187**：「收藏 MUST 用『移除』而非『刪除』」講的是不銷毀底層資料，與 undo 無關；現況 UI 仍寫「刪除」是獨立的待對齊項（純文案）。

## 附錄：現況對齊盤點（2026-07-25 實查）

| 桌機 CRUD 流程 | macOS HIG 規範 | 現況 | 對齊 |
|---|---|---|---|
| 刪除單一景點 | 直接刪 + undo，不確認 | `TimelineRail` 的 ⋯ menu「刪除景點」→ `ConfirmModal`（`showDeleteConfirm`）。**跳確認、無 undo。** 該檔註解自述「與全站其他刪除 confirm（trip-notes / favorites / trips-list）同 pattern」 | ⬜ **但不修** —— #1150 明列「行程項目刪除的復原牽涉車程重算與衝突處理，獨立取捨」，且 W12 要求所有刪除走同一確認 |
| 移除收藏 / 備選 | 「移除」+ 無確認 + 可還原 | 文案用**「刪除」**（`favorites-delete-selected` 工具列鈕）、**會跳 `ConfirmModal`**、**無還原入口**。後端 soft-delete 已實作（migration `0087` + `[id].ts` 寫 `deleted_at` tombstone），但 **restore 端點已被 W12 刪除**；`POST /api/poi-favorites` 會 reactivate soft-deleted row 保留原 id，惟註解明載那是「新的一次收藏，套新 note/favorited_at」—— **語意上不是還原**（原 note 與收藏時間會被覆寫） | 🔴 **規範本身衝突中**，見上節 |
| 刪除整趟行程 | Alert + 紅色非-default + 動詞 | `TripsListPage` / `EditTripPage` 走 `ConfirmModal`：紅色破壞鈕（`.tp-confirm-btn-danger` = `--color-priority-high-dot`，非品牌柔褐）✅、預設焦點在取消鈕（`initialFocusRef: cancelRef`，#1150 P1-1 已修）✅、`confirmLabel="刪除"` 是動詞 ✅。**未達標處**：標題是「確定刪除行程？」**不含對象名稱**（行程名在 message 裡），規範要求「刪除『京都五日行』？」這種可獨立理解的標題；按鈕文案「刪除」也未含對象（規範舉例「刪除行程」） | 🟡 **大致對齊**，差標題／按鈕的對象名稱 |
| 批次刪除 | 多選 + 僅永久才確認 | 收藏頁有批次多選，但用 **checkbox**（`favorites-check-*` + 全選／清除選取）而非規範寫的 **`⌘`／`⇧` 點選**；刪除入口在工具列 ✅；會跳確認（收藏屬可復原 → 依規範不該跳，但受上述衝突影響）。timeline 無批次 | 🟡 部分 —— 入口對、多選手法不同 |
| 單筆動作入口 | hover + 右鍵 contextual menu | hover 列尾動作**有**（`.poi-actions` / `.tp-rail-poi-actions`）✅；`⋯` menu **有**（`timeline-rail-menu-*`）✅；**右鍵 contextual menu 完全沒有**（`grep -rn onContextMenu src/` 零命中）❌；**`Delete` 鍵未綁**（零命中）❌ | ⬜ 缺右鍵選單與 `Delete` 鍵 |
| （額外查核）FAB / hamburger | 桌機 MUST NOT 用 | `MapFabs`（`tp-map-fab`）存在，但那兩顆是**地圖檢視控制**（重新定位／定位我）、**不是 CRUD 入口**，不在本條約束範圍。無 hamburger | ✅ 不算違規 |

**待對齊項的歸屬**（本 change 不修，供後續實作變更引用）：

- 右鍵 contextual menu + `Delete` 鍵 → 兩者都需要**全域快捷鍵註冊機制**，#1150 已明列該機制為 `⌘N`／`Delete`／`⌘Z` 的實作前置且尚不存在 → 另開票，不在 #1150 內
- 刪除行程 Alert 的標題／按鈕加對象名稱 → 小額 XS，可另開票
- `⌘`／`⇧` 多選 → 需求價值待評估（現行 checkbox 在觸控裝置上更好用，而收藏頁手機也用同一份 UI）
