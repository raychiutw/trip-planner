# 2026-04-27 Unified Layout Plan

## Goal

聊天、行程、地圖、探索、帳號目前已經開始使用共用 shell，但 titlebar、sidebar、bottom nav、content width、scroll chrome 行為仍不完全一致。本次決策先把規格固定，後續實作以此文件與 `DESIGN.md` 為準。

## Decisions

### Responsive Model

| Mode | Rule | Layout |
|------|------|--------|
| compact | default | 手機和平板共用：sticky titlebar、右側 hamburger、bottom nav |
| desktop | `@media (min-width: 1024px) and (pointer: fine)` | 桌機：sticky sidebar、sticky titlebar、無 bottom nav |

不再維護 tablet-only layout。所有不符合 desktop 條件的環境都走 compact。

### Titlebar

- 全站主功能頁 titlebar 一律 sticky。
- 桌機與 compact 都只保留單行標題。
- 桌機不要 eyebrow、meta、helper text。
- Compact 右側統一 hamburger menu，展開後放 secondary actions、帳號、設定等。

### Navigation Chrome

- Desktop sidebar 與 compact bottom nav 使用同一組 IA：聊天 / 行程 / 地圖 / 探索 / 帳號。
- Anonymous state 可把帳號入口替換成登入，但位置不變。
- Bottom nav 下滑消失、上滑顯示；所有頁面使用同一套 scroll direction state。
- 行程明細頁 DayNav 也跟 bottom nav 一樣：下滑消失、上滑顯示。
- Compact bottom nav 是主功能定位，不是 breadcrumb；子頁 active item 依所屬主功能決定。
- Active item 使用不同於 CTA 的定位設計：terracotta 淡底 pill + 2px top indicator + accent icon/label。

| Route family | Active bottom nav |
|--------------|-------------------|
| `/chat`、聊天明細 | 聊天 |
| `/trips`、行程列表、行程明細、新增行程 | 行程 |
| `/map`、行程地圖、全域地圖 | 地圖 |
| `/explore`、探索結果、POI 詳細 | 探索 |
| `/account`、connected apps、developer apps | 帳號 |

### Trip Detail Shared Structure

- 行程明細頁 desktop / compact 必須共用同一個 `TripDetail` 內容結構與狀態來源。
- 共用範圍包含 DayNav、stop list、住宿、交通、地圖摘要、loading、empty、error、mutation state。
- Desktop 只改外層 shell、content width、可選輔助欄；compact 只改單欄、hamburger、bottom nav。
- 不允許桌機與手機維護兩套行程明細功能，避免 UI 與行為漂移。

### Content Width

- 一般內容頁外層統一 `max-width: 1040px`，desktop padding `24px`，compact padding `16px`。
- Chat / Trips / Explore / Account 不再各自使用不同外層寬度。
- 地圖頁是唯一 full bleed 例外，但仍需共用 sidebar、titlebar、bottom nav 行為。
- 表單或文字段落可以在內容區內部限寬；不能改變頁面外層節奏。

### New Trip Modal

- 移除桌機新增行程頁的大型形象圖 / split hero。
- 改成 form-first single-column modal，desktop 與 compact 共用同一套 RWD。
- Desktop modal max width 約 `680-720px`，讓主要設定能在常見桌機高度內一屏完成。
- Footer actions sticky bottom；compact 可用近全寬 sheet/dialog。

### Typography

- 桌機與 compact 共用同一組 font family：Inter + Noto Sans TC + system fallback。
- 桌機與 compact 各自一套 role-based type scale；頁面和元件吃 token，不直接寫零散 `font-size`。
- Titlebar 是 chrome，不是內容主角：desktop 20px / compact 18px。
- 內容主標題才使用 page-title：desktop 28px / compact 24px。
- 中文 body 固定 16px / 26px，不因 compact 再縮小。
- 中文 `letter-spacing` 一律 0；只有 uppercase eyebrow 可用 `0.12em`。
- 中文常規最高字重用 700；800 僅限極少數英文品牌字樣。

### Error & Status Messaging

- Toast 只用於離線、恢復連線、複製成功等低風險狀態。
- 其他錯誤使用 persistent surface，不自動消失，直到使用者處理或關閉。
- 欄位錯誤：欄位下方 inline error；送出後可在表單頂部加 summary。
- 表單送出 / 儲存失敗：表單或受影響區塊上方 `FormErrorBanner` / persistent alert。
- 登入過期 / 權限不足：titlebar 下方 global banner，必要時阻擋操作。
- 頁面資料載入失敗：內容區 `PageErrorState`；地圖頁使用 floating error panel。
- 重要操作失敗：desktop 可用 dialog；compact 使用 bottom sheet。
- 錯誤色使用 semantic error `#C13515`，不要使用 Terracotta。Terracotta 保留給品牌、active state、CTA。
- 文案必須交代「發生什麼事」、「現在可以怎麼做」、「資料是否保留」。

## Route Mapping

| Area | Desktop | Compact | Notes |
|------|---------|---------|-------|
| Chat | sidebar + titlebar + 1040px content | titlebar + hamburger + bottom nav | 內容可依聊天訊息內部限寬 |
| Trips list | sidebar + titlebar + 1040px content | titlebar + hamburger + bottom nav | 新增行程 modal 使用 form-first |
| Trip detail | sidebar + titlebar + DayNav + 1040px content | titlebar + hamburger + DayNav + bottom nav | 共用同一份 `TripDetail`；bottom nav active = 行程 |
| Map | sidebar + titlebar + full bleed map | titlebar + hamburger + bottom nav + full bleed map | 唯一 content width 例外 |
| Explore | sidebar + titlebar + 1040px content | titlebar + hamburger + bottom nav | 篩選/排序走 hamburger 或 local controls |
| Account | sidebar + titlebar + 1040px content | titlebar + hamburger + bottom nav | connected/developer apps 需補 bottom nav |

## Implementation Order

1. 在 `AppShell` 統一 desktop/compact 判斷與 scroll direction state。
2. 讓 `PageHeader` 支援 compact hamburger slot，並移除桌機 eyebrow/meta/helper text。
3. 統一 `DesktopSidebar` / `GlobalBottomNav` 的 IA 與顯示條件。
4. 為 compact bottom nav 建立 route-owner active mapping 與定位樣式。
5. 確認 Trip detail desktop / compact 共用同一份內容樹與狀態來源。
6. 抽出標準 content wrapper，套到 Chat / Trips / Explore / Account；Map 保留 full bleed。
7. 改 Trip detail DayNav 為 sticky + hide-on-scroll。
8. 改 `NewTripModal` 為 form-first single-column，移除大型 hero。
9. 建立錯誤訊息 primitives：`FieldError`、`FormErrorBanner`、`PersistentAlert`、`GlobalStatusBanner`、`PageErrorState`、`MapErrorPanel`、`StatusToast`。
10. 用桌機與 compact 截圖驗證五大功能 chrome、content width、typography、error surfaces。

## Non-goals

- 不在此階段重設資料模型或 API。
- 不改地圖本身的 marker/polyline 邏輯。
- 不新增 tablet 專屬設計。
