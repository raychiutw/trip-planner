## Context

目前 localStorage 使用 `trip-planner-` prefix（12 字元），key 有 4 個：`trip-pref`、`color-mode`、`dark`、`sidebar-collapsed`。已有一組從無 prefix 舊 key 遷移到 `trip-planner-*` 的邏輯在 `app.js` IIFE 中。

行程載入（`loadTrip`）在 fetch 失敗時只顯示錯誤文字，不清除 localStorage，也不提供復原路徑。使用者每次重新進入都會重複失敗。

## Goals / Non-Goals

**Goals:**
- LS_PREFIX 從 `trip-planner-` 縮短為 `tp-`，含自動遷移
- loadTrip 失敗時清除 trip-pref、顯示訊息與設定頁連結
- 移除 DEFAULT_SLUG 及其 fallback 邏輯

**Non-Goals:**
- 不改變 localStorage 的 TTL 機制（維持 6 個月）
- 不改變 setting.html 的行程選擇 UI
- 不處理 edit.html 的行程載入邏輯（edit.js 有自己的 slug 解析）

## Decisions

### D1：遷移邏輯放在 shared.js，取代 app.js 的舊遷移 IIFE

**選擇**：在 `shared.js` 的 LS helper 區塊加入 `trip-planner-*` → `tp-*` 遷移，同時移除 `app.js` 中已有的 `tripFile` / `tripPref` / `dark` 無 prefix 遷移（兩步合一：無 prefix → `tp-*`）。

**替代方案**：在 app.js 保留兩層遷移（無 prefix → trip-planner- → tp-）。

**理由**：shared.js 在所有頁面（index、edit、setting）都會載入，遷移放在這裡確保任何一頁先被開啟都能完成遷移。兩步遷移沒必要 — 直接無 prefix → `tp-*` 一步到位。

### D2：失敗顯示使用 tripContent 內嵌訊息 + 連結按鈕

**選擇**：在 `#tripContent` 區域渲染錯誤訊息區塊，包含文字「行程不存在」和一個連結按鈕「前往選擇行程」指向 `setting.html`。

**替代方案 A**：toast + 延遲跳頁（toast 可能來不及看到就跳走）。
**替代方案 B**：query param 傳到 setting 頁顯示 toast（多一層耦合）。

**理由**：內嵌訊息讓使用者有時間閱讀、主動點擊，不會有時間競爭問題。沿用既有的 `.trip-error` 樣式即可。

### D3：resolveAndLoad 移除 DEFAULT_SLUG fallback

**選擇**：當 URL 無 `?trip=` 且 localStorage 無 `trip-pref` 時，不再自動載入預設行程，改為顯示同樣的「請選擇行程」訊息。

**理由**：使用者第一次訪問或清除 localStorage 後，引導至設定頁選擇行程，比靜默載入一個可能不相關的行程更合理。

## Risks / Trade-offs

- **第一次訪問的使用者體驗**：原本會直接看到預設行程，改後會先看到「請選擇行程」→ 多一步操作。但這對行程規劃網站來說合理，使用者本來就該選自己的行程。
- **舊 prefix 遷移一次性**：遷移邏輯會一直存在程式碼中（偵測 `trip-planner-*` key），但成本極低（一次 localStorage 掃描），未來可在確認所有使用者都遷移完後清除。
