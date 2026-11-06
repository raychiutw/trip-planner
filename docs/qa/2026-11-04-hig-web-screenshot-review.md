# web 截圖逐張檢查報告（flutter#531／trip-planner#1568 素材）

檢查日期：2026-11-04。對象：[`2026-11-04-hig-web-screenshots/`](2026-11-04-hig-web-screenshots/) 的 80 個場景（原 27 個、第三輪補的 9 個認證流程／邀請／清單空與錯誤態、第四輪補的 14 個彈出層場景，加第五輪（#1567）6 個頁面場景，與 #1566 的 3 個頁面場景及 6 個彈出層場景，與 #1565 的 15 個認證與帳號場景），手機寬（390×844）與桌機寬（1280×800）、淺色與深色，共 316 張（`popup-trip-sheet` 只有桌機寬、`trip-add-custom-stop` 只有手機寬，各 2 張，其餘各 4 張）。依據：flutter repo 的 `docs/research/2026-11-04-hig-screen-checklist.md`。web 條目的依據是 WCAG 2.2 與 WAI-ARIA APG；HIG 只談 Apple 平台，套到 web 的數值（如 44）是專案自訂標準。

## web 取證的缺口與現況

本節是 #1568 的彙整結論；其後各節保留各輪次當時的敘述，數字以當時為準（標「當時」者），**目前數字以本節與文末「覆蓋率」「場景索引」為準**（有守門測試 `tests/unit/hig-web-report-coverage.test.ts`）。

### 做到哪

- 目前 **80 個場景**（60 個頁面與狀態、20 個彈出層）× 手機寬與桌機寬 × 淺色與深色 = **316 張截圖**（`popup-trip-sheet` 只有桌機寬 2 張、`trip-add-custom-stop` 只有手機寬 2 張，其餘各 4 張）。
- 路由表 54 條：已取證 47、已排除（純轉址）6、缺口 1，取證率 **47/48（97.9%）**。彈出層元件 22 個：已取證 19、缺口 3（皆為沒有入口的元件），取證率 **19/22（86.4%）**。逐項對照見文末「覆蓋率」。
- 發現 **55 條**，編號 1～54、70～80；**沒用到的編號**：35～44、55～69、81～99。原因：#1565、#1566、#1567 各預先配了 26～44、45～69、70～99 三個區段以避免撞號，實際只用到 34、54、80 為止，其餘留空，不是遺漏。每條都有場景、條目、發現、證據強度、一手來源標註與截圖連結。
- 觸控目標（44px）有自動量測與棘輪；axe、320px 重排、200% 文字、鍵盤焦點有補掃（範圍見「補掃」節與下方「沒逐張看」）。

### 還沒做（缺口，照實列出）

1. `stop/:entryId/map`（單點地圖）：Google Maps 的 browser key 限制網址，localhost 一律 RefererNotAllowedMapError，只拍得到「地圖暫停服務」錯誤態，**無場景**。`map`、`trip-map` 與 `popup-trip-sheet` 的地圖分頁同樣只是錯誤態，不能當真實地圖的證據（發現 4）。
2. `trip-add-custom-stop` 的「位置」區：錯誤文字「無法載入地圖，位置尚未選定」（發現 72），選位地圖的觸控與手勢沒取證；桌機寬會轉址到 `add-stop`，沒有桌機圖。
3. `trip-stop-change-poi`：只取證初始空搜尋態，沒有搜尋結果、收藏、自訂分頁的狀態。
4. `TripCardMenu`、`TripActionsMenu` 的 owner-only 項（封存、還原）：mock 登入帳號與行程 `ownerUserId` 對不上，選單裡出不來，缺口。
5. **每個彈出層只取證一種狀態**：AI 資料同意只有 consent 模式（owner-missing、stale、withdrawn 橫幅沒做）、Toast 只有 error 與 online（success、info 沒做）、ConfirmModal 只有「登出其他所有裝置」一個呼叫端且沒做 busy 態、日期／時間／下拉面板各只取一個呼叫端。
6. 沒有入口、造不出的 3 個元件：`TripPickerPopover`、`CollabSheet`、`InfoSheet`（死碼；移除另案 #1584）。
7. 路由別名（`/settings/*` 四條）與帳號路由同元件，只取證一次；`/add-to-trip` 缺 query 的「景點資料缺漏」錯誤態未取證。
8. **所有截圖都是 `fullPage:false`，只有第一屏**：`landing`、`privacy` 與其他長頁往下的內容沒有被看到。
9. 只跑 chromium；webkit 只對當時 36 個場景做過掃描，其後新增的場景沒跑。沒有 Firefox、沒有 Safari 真機。
10. 沒有自動量測字級、對比（axe 的「需人工」清單沒有逐筆複核）；沒有實際用螢幕閱讀器走過任何流程。

### 沒逐張看的圖（依各輪紀錄彙整；沒有紀錄的一律視為沒看，**不是每張都逐張看過**）

- **桌機寬深色**：#1565 新場景 `oauth-authorize-login`、`oauth-authorize-error`、`oauth-consent`、`oauth-consent-error` 沒看（只有 proof、量測、axe）；#1567 記錄 `trip-map`、`invite`、`invite-invalid` 仍沒看（`invite`、`invite-invalid` 在第三輪表格另有「#1565 補看」的敘述，兩處矛盾，保守視為沒看；`trip-map` 在第一輪也寫「桌機淺深都看過」，同樣矛盾，保守視為沒看）；`popup-confirm-modal`、`popup-error-banner` 沒有任何一輪補看桌機深色。
- **#1566 新場景**：`add-to-trip`、`favorite-add-to-trip`、`favorites-list`、`popup-trip-card-menu`、`popup-rail-row-menu`、`popup-trip-select`、`popup-trip-date-picker`、`popup-trip-time-picker` 只看了桌機深色與手機淺色，**桌機淺色與手機深色沒看**；`popup-trip-actions-menu` 沒看手機淺色。
- **#1567 範圍**：範圍內既有場景的**手機深色**沒再逐張看（先前輪次只看淺深並排圖）；新場景 `trip-stop-copy`、`trip-stop-move`、`trip-stop-change-poi`、`trip-stop-edit` 只看了手機淺色與桌機深色，手機深色與桌機淺色沒看；這 6 個新場景沒有跑 axe、重排、焦點補掃。
- **#1565 補看的既有 15 個認證與帳號場景桌機寬**是淺深拼成一張看，沒有個別開啟；`trips-list-empty`、`trips-list-error` 只看了桌機深色。
- **#1587 重拍的圖**：`popup-account-sheet`、`popup-trip-sheet`、`popup-ai-consent-sheet`、`chat`、`account` 與未列出的淺深組合重拍後只有 proof、axe 與觸控棘輪，沒有逐張看。
- 前 36 個場景的圖不是在 Linux 容器重拍的，環境未重新確認；既有場景沒重拍，有些圖反映修正前的畫面（例如 `explore` 桌機深色仍是「Sight」，發現 5 已修）。
- #1566 與 #1567 新增場景沒有 axe／重排／焦點補掃的紀錄（#1565 的 15 個有）。

### 不符合項的處理狀態

已修並以測試守住：1～9（#1571）、12～22、24（#1587，其中 14、17 為 owner 決定）。待 owner 決定：23（缺三個交通方式圖示）。無法修（場景限制）：4。已另案：25（#1584 移除死碼）、26（#1589）。**其餘 10、11、27～54、70～80 尚未處理**，交 owner 決定是否開票；與既有 #1562（web 表單慣例一致性）同類的是 27（錯誤欄位的程式化關聯）與 28 內提到的密碼欄顯示切換，未逐條對照 #1562，開票前請 owner 比對避免重複。

### 之後怎麼補

可由實作補的：換用「允許網址」的 Google Maps key 或在 Google Cloud 把測試網址加進 referrer 白名單後，補 `stop/:entryId/map`、`map`、`trip-map` 與選位地圖；mock 登入帳號的 `id` 對上 `ownerUserId` 補 owner-only 選單項；補各彈出層其餘狀態與 `fullPage:true` 長頁截圖；對 #1566、#1567 新場景跑補掃；補跑 webkit。

**需要 owner 人工做的（agent 做不到）**：
- 真機 VoiceOver（iPhone Safari 與 App）走過登入、變更密碼、對話框、Toast、時間軸等流程；
- 真實 Google 地圖畫面的人工判讀（觸控手勢、單點地圖、選位）；
- 螢幕閱讀器實測（NVDA／TalkBack／VoiceOver）確認 `role=alert`、`aria-live`、焦點移動與可存取名稱，axe 與 `aria-label` 只是間接證據；
- 對 axe 的「需人工」對比清單做人工複核，以及發現 11（200% 文字溢位）原因定位。

## 怎麼檢查的

把每個場景同一寬度下的淺色與深色拼成一張並排圖，由我逐張目視（第四輪的彈出層場景改為逐張個別開啟檢視，沒有拼圖）。**沒有自動量測對比或字級**；觸控目標另由 `tests/e2e/hig-scenes.spec.js` 的棘輪守門，本報告不重複。

## 範圍與沒看到的

（以下是各輪次當時的敘述；目前的彙整見上方「web 取證的缺口與現況」。）

- （第一、二輪當時）桌機寬：27 個場景的淺深並排圖都看過（trip-map 的桌機深色後來又被記為沒看，見上節）。
- （第一、二輪當時）手機寬：27 個場景的淺深並排圖都看過（第一輪 15 個，第二輪補看 12 個）。
- **第三輪補的 9 個場景**（`login-error`、`login-rate-limited`、`signup-check-email`、`reset-password`、`verify-email`、`invite`、`invite-invalid`、`trips-list-empty`、`trips-list-error`）：**手機寬淺深都看過；桌機寬的 18 張新圖我沒有逐張看**，只有 proof（畫面上一定出現的文字或 testid）與 axe 掃描。
- **第四輪補的 14 個彈出層場景**（`popup-*`）：手機寬淺深 13 個都個別看過（`popup-trip-sheet` 沒有手機寬）；桌機寬淺色看過 14 個、深色只看了 `popup-trip-sheet`，**其餘 13 個場景的桌機寬深色圖沒有逐張看**，只有 proof 與棘輪。圖是在 Linux 容器（Playwright v1.64.1 noble）截的，前 36 個場景不是本輪重截，截圖環境未重新確認，字型可能不同；Linux 的無頭 Chromium 會畫出傳統捲軸，圖右緣常有約 10px 的窄條，那是環境產物，不是產品問題。
- 只跑 chromium；webkit、firefox 沒截。

## 需要處理的發現

| # | 場景／元件 | 條目 | 發現 | 證據強度 | HIG／W3C 一手來源 | 截圖 |
|---|---|---|---|---|---|---|
| 1 | `account-sessions`、`account-connected-apps`、`developer-apps` | 版面 | 頁面上方小標（帳號／設定／開發者後台）被固定頁首壓住而被裁切或重疊，桌機與手機都有 | 看圖 | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `account-sessions` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/account-sessions.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/account-sessions.png)<br>`account-connected-apps` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/account-connected-apps.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/account-connected-apps.png)<br>`developer-apps` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/developer-apps.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/developer-apps.png) |
| 2 | `trip-detail` | E1 | 桌機右側地圖面板的錯誤態「重試」是未套樣式的原生灰色按鈕 | 看圖 | 有：HIG buttons（App 規範，web 屬類推） | `trip-detail` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trip-detail.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/trip-detail.png) |
| 3 | `trip-detail` | 版面 | 手機寬的移動方式膠囊（`13 min · 6.6 km · 從飯店開車 15 分鐘`）超出右緣被截斷 | 看圖 | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `trip-detail` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trip-detail.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/trip-detail.png) |
| 4 | `trip-map`、`map` | — | 場景擋掉 Google Maps，畫面是「地圖暫停服務」錯誤態，**不是真實地圖**；這兩個場景不能當地圖畫面的證據 | 看圖加 spec 原始碼（`maps.googleapis.com` 被 abort） | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `trip-map` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trip-map.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/trip-map.png)<br>`map` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/map.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/map.png) |
| 5 | `explore` | — | 手機寬的篩選膠囊「Sight 1」與卡片類別「SIGHT」是未在地化的英文原值 | 看圖 | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `explore` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/explore.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/explore.png) |
| 6 | `trips-new` | B | 手機寬日期欄位「選擇日期」字級明顯大於同頁其他 placeholder | 看圖 | 有：HIG typography（App）；web 見 WCAG 1.4.4 | `trips-new` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trips-new.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/trips-new.png) |
| 7 | `trip-detail` | WCAG 2.5.3 | 9 個起訖時間 chip（`EntryTimeChip.tsx:140`）的 `aria-label="編輯起訖時間"` 蓋掉可見的時間文字（如 09:00–12:00），語音操控說出看得到的字會失敗 | axe 加程式碼 | 有：W3C WCAG 2.2 原文（本輪未重新逐條核對） | `trip-detail` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trip-detail.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/trip-detail.png) |
| 8 | `trips-new` | WCAG 2.5.3、ARIA | 出發／回程日期欄（`TripDatePicker`，`NewTripPage.tsx:817-`）：`aria-label` 與可見文字不一致；`aria-required` 加在不允許該屬性的角色上（axe：critical） | axe（TripDatePicker 內部未讀） | 有：W3C WCAG 2.2 原文（本輪未重新逐條核對）；有：W3C WAI-ARIA（本輪未重新逐條核對） | `trips-new` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trips-new.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/trips-new.png) |
| 9 | `trip-print` | C5 | 列印預覽分區的數量標籤 `#8a7a68`、11px，對比 4.14:1（`tripPrintStyles.ts:66`），低於 4.5:1 | axe 加程式碼 | 有：WCAG 1.4.3（W3C） | `trip-print` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trip-print.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/trip-print.png) |
| 10 | `trips-list-error` | G6、G7 | 行程清單載入失敗只有一行「無法載入你的行程清單。」，**沒有重試**（程式碼確認：`TripsListPage` 的錯誤態沒有任何重試或重新載入動作）；使用者只能手動重新整理整頁 | 看圖加程式碼 | 有：HIG feedback（App 規範，web 屬類推）；web 見 WCAG 3.3.1、4.1.3 | `trips-list-error` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trips-list-error.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/trips-list-error.png) |
| 11 | `signup-check-email`、`invite` | B7 | 以「320px 寬、html 字級 200%」近似量測，scrollWidth 為 354、366（對 320）；逐元素掃描找不到右緣超出的元素，**原因未定位**。這只是近似（不是瀏覽器縮放），是否構成 WCAG 1.4.10 違規仍待驗證 | 量測（未定位） | 有：WCAG 1.4.4、1.4.10 | `signup-check-email` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/signup-check-email.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/signup-check-email.png)<br>`invite` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/invite.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/invite.png) |
| 12 | `popup-server-status-banner` | C（WCAG 1.4.3） | **深色**：橫幅文字色寫成 `var(--color-priority-high-text, #8b2828)`，但 `css/` 全無這個 token，永遠落到寫死的 `#8b2828`（`ServerStatusBanner.tsx:26`）；深色底（`rgba(232,160,160,.18)` 疊深色頁底，約 `#413435`）上對比 **1.37:1**，幾乎讀不到 | axe（serious）加看圖加程式碼 | 有：WCAG 1.4.3（W3C） | `popup-server-status-banner` [手機深](2026-11-04-hig-web-screenshots/mobile/dark/popup-server-status-banner.png) [桌機深](2026-11-04-hig-web-screenshots/desktop/dark/popup-server-status-banner.png) |
| 13 | `popup-server-status-banner` | 版面 | 橫幅是 `position: sticky; top: 0`，卻放在 100dvh 的 app-shell 之外，多佔 59px：手機寬離線前後量測 `scrollHeight` 844→903（視窗 844）、shell 上緣 0→59，整頁多出捲軸；桌機寬左側欄底部的使用者卡被擠出視窗下緣 | 量測（離線事件前後）加看圖 | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `popup-server-status-banner` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-server-status-banner.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-server-status-banner.png) |
| 14 | `popup-toast-offline` | G7 | 離線時同時有三個提示：全域橫幅（z-index 9999）、離線 Toast（z-index 250，被橫幅蓋住一半，文字疊在一起）、行程頁自己的「目前是離線模式」卡片。橫幅在場時，Toast 等於看不到 | 看圖（手機寬、桌機寬） | 有：HIG feedback（App 規範，web 屬類推）；web 見 WCAG 3.3.1、4.1.3 | 無畫面（元件不存在，無截圖） |
| 15 | `popup-toast-error` | 版面、規範 | Toast 固定在視窗頂端（`top: max(16px, safe-area)`，`tokens.css:238`），手機寬蓋住 TitleBar 的標題與返回鈕；DESIGN.md「Error & Status Messaging」寫的是桌機右上 titlebar 下方、compact 底部且高於 bottom nav，實作與規範不一致 | 看圖加 DESIGN.md | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `popup-toast-error` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-toast-error.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-toast-error.png) |
| 16 | `popup-toast-error` | G6、WCAG 3.3.1 | 探索頁搜尋少於 2 字，只出現 2 秒的 error Toast「至少輸入 2 個字」；欄位本身沒有錯誤文字，Toast 消失後沒有任何殘留提示（DESIGN.md：欄位格式錯用 FieldError）。另外 Toast 同時設 `role="alert"` 與 `aria-live="polite"`（`Toast.tsx:100-101`），兩者語意互相矛盾（alert 隱含 assertive） | 看圖加程式碼 | 有：HIG feedback（App 規範，web 屬類推）；web 見 WCAG 3.3.1、4.1.3；有：W3C WCAG 2.2 原文（本輪未重新逐條核對） | `popup-toast-error` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-toast-error.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-toast-error.png) |
| 17 | `popup-conflict-modal` | G2、G7 | 對話框問「要怎麼處理？」，元件也支援「改插入到後面」「取代既有」，但呼叫端 `AddPoiFavoriteToTripPage.tsx:561` 只傳 `onCancel`，畫面上只有一顆「取消」：文案承諾的選項不存在，使用者無法在對話框內處理衝突，只能關掉後自己改時間 | 看圖加程式碼 | 有：HIG alerts（App 規範，web 屬類推）；有：HIG feedback（App 規範，web 屬類推）；web 見 WCAG 3.3.1、4.1.3 | `popup-conflict-modal` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-conflict-modal.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-conflict-modal.png) |
| 18 | `popup-share-link-modal` | WCAG 2.5.3、4.1.2 | 同一個對話框內有兩個可存取名稱都是「關閉」的按鈕，動作卻不同：標題列 ✕（關閉對話框，`ShareLinkModal.tsx:313`）與連結卡的「關閉」（停用該連結，`:458`）。螢幕閱讀器與語音控制說「關閉」無法區分，且後者影響較大 | 程式碼加看圖 | 有：W3C WCAG 2.2 原文（本輪未重新逐條核對）；無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `popup-share-link-modal` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-share-link-modal.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-share-link-modal.png) |
| 19 | `popup-share-link-modal` | 版面 | 手機寬的「有效期限」分段控制（永久／24 小時／7 天／30 天／自訂）折成兩列，第二列只有「自訂」，右側留空白格，像是漏了選項 | 看圖 | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `popup-share-link-modal` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-share-link-modal.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-share-link-modal.png) |
| 20 | `popup-share-link-modal`、`popup-account-sheet`、`popup-trip-sheet` | A1 | 彈出層內觸控目標 < 44（只量彈出層本身，Linux）：分享對話框 18 項（✕ 27×27、區塊 pill 與期限分段高 34、匿名勾選 17×17、連結名稱輸入高 34、建立分享連結高 42、編輯／重新產生／關閉／刪除高 34）；帳號 sheet「編輯名稱」32×32；TripSheet 聊天建議 chip 高 39、送出 40×40。有可點擊元素的 10 個彈出層中，其餘 7 個（AI 授權、AI 資料同意、確認、衝突、輸入、排除項目、交通方式）全部 ≥ 44 | 量測 | 有：HIG accessibility（App 數值）；web 套 44 是專案自訂標準 | `popup-share-link-modal` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-share-link-modal.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-share-link-modal.png)<br>`popup-account-sheet` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-account-sheet.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-account-sheet.png)<br>`popup-trip-sheet` [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-trip-sheet.png) |
| 21 | `popup-note-ai-exclusions-dialog`（背景頁 `trip-notes`） | WCAG 4.1.2 | axe `nested-interactive`（serious）：筆記區塊標題列是 `div[role=button]`，展開後內含 AI 的 `<button>`。先前 `trip-notes` 場景手機寬只展開第一區（航班，沒有 AI 鈕）所以沒掃到；桌機寬各區預設全展開就會出現。違規在彈出層背後的頁面，不是對話框本身 | axe 加程式碼 | 有：W3C WCAG 2.2 原文（本輪未重新逐條核對） | `popup-note-ai-exclusions-dialog` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-note-ai-exclusions-dialog.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-note-ai-exclusions-dialog.png)<br>`trip-notes` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trip-notes.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/trip-notes.png) |
| 22 | `popup-ai-consent-sheet` 等 | 標題層級 | 彈出層標題層級不一致：AI 授權 sheet 用 `h4`、AI 資料同意與確認類用 `h2`、交通方式用 `h3`（觀察，不影響功能） | 程式碼 | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `popup-ai-consent-sheet` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-ai-consent-sheet.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-ai-consent-sheet.png) |
| 23 | `popup-travel-pill-dialog` | E4 | 交通方式八個模式中，單軌、地鐵、火車、高鐵的圖示看起來相同，只能靠文字分辨（圖示小，判讀有限） | 看圖 | 有：HIG buttons（App 規範，web 屬類推） | `popup-travel-pill-dialog` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-travel-pill-dialog.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-travel-pill-dialog.png) |
| 24 | `popup-error-banner` | G6、DESIGN.md 文案規則 | 「登出此裝置失敗，請稍後再試。」說了發生什麼，但沒有重試動作，也沒說明該裝置是否仍登入（文案規則三問缺一）；橫幅與上方清單卡的間距只有幾 px，下方卻是 16px | 看圖 | 有：HIG feedback（App 規範，web 屬類推）；web 見 WCAG 3.3.1、4.1.3；專案規範 DESIGN.md，非 HIG | `popup-error-banner` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-error-banner.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-error-banner.png) |
| 25 | `TripPickerPopover`、`CollabSheet`、`InfoSheet` | — | 三個元件沒有任何使用者走得到的入口（死碼，見下「彈出層缺口」），所以無法取證；已另開 PR #1584 移除 | 程式碼（grep 全 `src/`） | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | 無畫面（元件不存在，無截圖） |
| 26 | `change-password-success` | G6 | 變更成功後 `showToast('密碼已更新，其他裝置已登出')` 再導回 `/account`，但 `ChangePasswordPage` 與 `AccountPage` 都沒有掛 `ToastContainer`（全 `src/` 只有 11 個頁面掛），使用者看不到任何成功回饋；場景已用斷言釘住「看不到」，修好後會紅，請改成取證 Toast 本身。已開票 #1589 | 看圖加程式碼（grep）加場景斷言 | 有：HIG feedback（App 規範，web 屬類推）；web 見 WCAG 3.3.1、4.1.3 | `change-password-success` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/change-password-success.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/change-password-success.png) |
| 27 | `change-password-current-invalid` | G6、F | 目前密碼錯誤時，紅字訊息出現在兩列群組下方，欄位本身沒有錯誤外觀（只有 `aria-invalid`，無紅框或圖示）；新密碼欄同時有值，使用者要靠訊息文字才知道錯在哪一欄 | 看圖加程式碼 | 有：HIG feedback（App 規範，web 屬類推）；web 見 WCAG 3.3.1、4.1.3；部分：HIG text-fields 有；passwords 專頁無一手來源 | `change-password-current-invalid` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/change-password-current-invalid.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/change-password-current-invalid.png) |
| 28 | `oauth-authorize-login` | A1 | 「忘記密碼？」是 `display:inline` 的 `<a>`，樣式裡的 `min-height: 44px` 對行內元素無效，實際點擊高度約一行字；觸控量測因規則「不量行內連結」而量不到（量測盲點，不是沒有問題） | 看圖加程式碼 | 有：HIG accessibility（App 數值）；web 套 44 是專案自訂標準 | `oauth-authorize-login` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/oauth-authorize-login.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/oauth-authorize-login.png) |
| 29 | `oauth-consent-unknown-scope` | H、F | 未知範圍（如 `admin:all`）和已知範圍一樣打綠勾圖示，只在文字尾端多一個「⚠ 未知範圍 — 請勿授權」；程式碼加了 `.unknown`／`.tp-consent-scope-warning` 類別，但全 repo 沒有對應樣式，所以警告沒有任何視覺強調，勾號反而暗示可以放行 | 看圖加程式碼（grep） | 有：HIG dark-mode（App 規範，web 屬類推）；部分：HIG text-fields 有；passwords 專頁無一手來源 | `oauth-consent-unknown-scope` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/oauth-consent-unknown-scope.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/oauth-consent-unknown-scope.png) |
| 30 | `oauth-consent-error`、`oauth-authorize-error` | G6 | 錯誤態沒有任何按鈕或連結（Tab 鍵可聚焦元素數為 0），是死路，只靠文字叫使用者回 App 或重新進入；`oauth-consent-error` 還沒有品牌字樣 | 看圖加 a11y 收集（tabbed 0） | 有：HIG feedback（App 規範，web 屬類推）；web 見 WCAG 3.3.1、4.1.3 | `oauth-consent-error` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/oauth-consent-error.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/oauth-consent-error.png)<br>`oauth-authorize-error` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/oauth-authorize-error.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/oauth-authorize-error.png) |
| 31 | `auth-callback` | — | 只有一行純文字「登入中…」，沒有轉圈、品牌或進度；token 兌換沒有逾時，請求卡住時頁面永遠停在這一行且沒有離開路徑（程式碼只有成功與失敗兩條導向） | 看圖加程式碼 | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `auth-callback` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/auth-callback.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/auth-callback.png) |
| 32 | `oauth-authorize`、`oauth-consent` | 版面 | 同一條授權流程的兩頁桌機寬版面不一致：authorize 靠頂端、有 TRIPLINE 字樣；consent 垂直置中、只有「授權請求」 | 看圖 | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `oauth-authorize` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/oauth-authorize.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/oauth-authorize.png)<br>`oauth-consent` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/oauth-consent.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/oauth-consent.png) |
| 33 | `verify-email`（桌機寬） | 版面 | 小卡置中，比其他認證頁窄且沒有 Tripline 標誌與宣傳面板，視覺上像另一套頁面 | 看圖 | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `verify-email` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/verify-email.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/verify-email.png) |
| 34 | `login-rate-limited`（桌機寬） | 版面 | 與 `login` 不同，沒有右側宣傳面板；卡片被拉高、下半是空白 | 看圖 | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `login-rate-limited` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/login-rate-limited.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/login-rate-limited.png) |
| 45 | `add-to-trip`、`favorite-add-to-trip` | 視覺一致 | 同一表單裡兩種欄位語彙：行程／天數（`TripSelect`）文字靠左、框線為強調色；開始／結束時間（`TripTimePicker`）空值「--:--」置中、框線為中性色。桌機與手機都有 | 看圖 | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `add-to-trip` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/add-to-trip.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/add-to-trip.png)<br>`favorite-add-to-trip` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/favorite-add-to-trip.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/favorite-add-to-trip.png) |
| 46 | `popup-rail-row-menu` | A1 | 停留點「⋯」選單的 9 個項目高度都是 42（寬 194），差 2px 到 44；手機寬量測 | 量測（Linux 容器） | 有：HIG accessibility（App 數值）；web 套 44 是專案自訂標準 | `popup-rail-row-menu` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-rail-row-menu.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-rail-row-menu.png) |
| 47 | `popup-trip-date-picker` | A1 | 日期格 40×40（35 格）、月份切換「上個月／下個月」36×36，手機寬量測。清單見 `hig-known-violations.js` | 量測（Linux 容器） | 有：HIG accessibility（App 數值）；web 套 44 是專案自訂標準 | `popup-trip-date-picker` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-trip-date-picker.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-trip-date-picker.png) |
| 48 | `popup-trip-date-picker` | WCAG 3.1.2、2.5.3 | 日期格的 `aria-label` 是英文全名（`Friday, December 4th, 2026`、`Today, Friday, November 6th, 2026`），畫面上星期標頭與月份都是中文；螢幕閱讀器會用英文念，語音控制說看得到的「6」也對不上。與發現 8 是同一元件，但這是格子的名稱，不是欄位 | 量測輸出的標籤文字（未用螢幕閱讀器驗證） | 有：W3C WCAG 2.2 原文（本輪未重新逐條核對）；無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `popup-trip-date-picker` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-trip-date-picker.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-trip-date-picker.png) |
| 49 | `popup-trip-date-picker` | 版面 | 月份切換鈕（‹ ›）靠右、垂直壓在標題下方的分隔線上，分隔線在鈕前就截斷；桌機寬面板下緣超出 800 高的視窗，最後一列被切到邊緣 | 看圖 | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `popup-trip-date-picker` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-trip-date-picker.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-trip-date-picker.png) |
| 50 | `popup-trip-time-picker` | 互動 | 欄位為空時，時間面板固定從 11 時、00 分起算，沒有任何選取態；要選早上的時間得先往上捲。（只看到第一屏，未驗證捲動行為與預設值是否刻意） | 看圖（行為未驗證） | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `popup-trip-time-picker` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-trip-time-picker.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-trip-time-picker.png) |
| 51 | `favorites-list` | A1 | 手機寬：類型 chip（全部／餐廳／景點／購物／住宿）60×36、「加入行程 →」99×34、選取勾選框 13×13、搜尋輸入框內層 288×28；清單見 `hig-known-violations.js` | 量測（Linux 容器） | 有：HIG accessibility（App 數值）；web 套 44 是專案自訂標準 | `favorites-list` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/favorites-list.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/favorites-list.png) |
| 52 | `trips-list`、`popup-trip-card-menu` | 版面 | 桌機寬，選取中的行程卡左上角小圓點與國家小標「日本」重疊 | 看圖（桌機寬深色，兩張一致） | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `trips-list` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trips-list.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/trips-list.png)<br>`popup-trip-card-menu` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-trip-card-menu.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-trip-card-menu.png) |
| 53 | `popup-toast-error` | G6 | 桌機寬：右上 Toast「搜尋失敗，請稍後再試」與頁內橫幅「搜尋失敗，仍顯示先前結果。」同時出現，同一件事通知兩次 | 看圖 | 有：HIG feedback（App 規範，web 屬類推）；web 見 WCAG 3.3.1、4.1.3 | `popup-toast-error` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/popup-toast-error.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/popup-toast-error.png) |
| 54 | `privacy` | 版面、文案 | 桌機寬：「防護時效 過後自動刪除」句中有疑似多餘的空格（未檢查原始文字是否為標記造成） | 看圖（疑似） | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `privacy` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/privacy.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/privacy.png) |
| 70 | `trip-add-custom-stop` | 版面、表單一致性 | 「地址或地標」輸入框（`#cs-address`）套的 `.tp-custom-stop-input` 在 CSS 裡已沒有規則（`AddCustomStopPage.tsx:147` 註解寫明 v2.33.22 移除），畫面上是原生樣式：253×26、沒有內距與圓角，和上方「標題」輸入框（高約 50）明顯不同。淺深色都看得到 | 看圖加程式碼（grep 無規則） | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `trip-add-custom-stop` [手機深](2026-11-04-hig-web-screenshots/mobile/dark/trip-add-custom-stop.png) |
| 71 | `trip-add-custom-stop` | 版面 | 手機寬的全頁表單底部被浮動的主導覽列（聊天／行程／地圖／收藏）蓋住，「備註」欄標題被遮；表單捲到底之前這段是不可用的（捲到底後是否讓出空間沒有驗證） | 看圖（只看第一屏） | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `trip-add-custom-stop` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trip-add-custom-stop.png) |
| 72 | `trip-add-custom-stop` | 場景限制 | 「位置」區是紅色錯誤文字「無法載入地圖，位置尚未選定」：Google Maps 被擋（見發現 4），拍不到真實的選位地圖，也就無法檢查地圖選位的觸控與手勢。列為缺口 | 看圖加 spec 原始碼 | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `trip-add-custom-stop` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trip-add-custom-stop.png) |
| 73 | `trip-share` | A1 | 動作列「列印」「存成 PDF」44×38、「複製到我的行程」248×38，高度都 < 44（Linux 量測） | 量測 | 有：HIG accessibility（App 數值）；web 套 44 是專案自訂標準 | `trip-share` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trip-share.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/trip-share.png) |
| 74 | `trip-share` | 外觀（觀察） | 公開分享頁固定淺色，深色模式不翻轉（`tripPrintStyles.ts:19、107` 註解寫明刻意）：深色下整頁仍是米色底與白紙，只有視窗最上緣約 18px 露出 body 的深色底，看起來像漏出的色帶。手機寬文件內文左側縮排約 52px，吃掉約七分之一的閱讀寬度 | 看圖加程式碼 | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `trip-share` [手機深](2026-11-04-hig-web-screenshots/mobile/dark/trip-share.png) [桌機深](2026-11-04-hig-web-screenshots/desktop/dark/trip-share.png) |
| 75 | `trip-share`、`trip-print` | 資料呈現 | 副標顯示成 `2026-07-01 · ["JP"] · 1 天`：沒有 destinations 時 `mapRawToPrintData` 直接用 `meta.countries` 原字串（`tripPrintData.ts:225`），而它是 JSON 字串。**是否在真實資料出現沒有驗證**（mock 的 destinations 是空陣列）；另 mock 的停留點沒有起訖時間，所以時間欄全是「—」，那是 fixture 限制，不是產品問題 | 看圖加程式碼（真實資料未驗） | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `trip-share` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trip-share.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/trip-share.png)<br>`trip-print` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trip-print.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/trip-print.png) |
| 76 | `trip-stop-edit` | A1 | 景點與備選的「分類：景點／餐廳，點擊更改」chip 78×28，高度 < 44 | 量測 | 有：HIG accessibility（App 數值）；web 套 44 是專案自訂標準 | `trip-stop-edit` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trip-stop-edit.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/trip-stop-edit.png) |
| 77 | `trip-stop-change-poi` | A1 | 「全部地區」地區膠囊 92×27，高度 < 44（與 `trip-add-stop` 同一元件、同一數值） | 量測 | 有：HIG accessibility（App 數值）；web 套 44 是專案自訂標準 | `trip-stop-change-poi` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trip-stop-change-poi.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/trip-stop-change-poi.png) |
| 78 | `trip-stop-copy`、`trip-stop-move`、`trip-stop-change-poi`、`trip-stop-edit`、`trip-add-entry`、`trip-add-stop`、`trip-edit`、`trip-notes`、`trip-collab`、`trip-health`（桌機寬深色） | 外觀 | 桌機右側堆疊面板（`TripStackLayout`）在深色下底色約 #3a3a3a，比左側中欄（約 #222）還亮，面板內的卡片又比面板暗，層次與一般「越靠前越亮」的 elevation 相反；面板左右緣各有一條約 1px 的亮線（x≈743、1269）。淺色沒有這個問題。屬觀察，需設計判斷 | 看圖（10 個場景一致） | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `trip-stop-copy` [手機深](2026-11-04-hig-web-screenshots/mobile/dark/trip-stop-copy.png) [桌機深](2026-11-04-hig-web-screenshots/desktop/dark/trip-stop-copy.png)<br>`trip-stop-move` [手機深](2026-11-04-hig-web-screenshots/mobile/dark/trip-stop-move.png) [桌機深](2026-11-04-hig-web-screenshots/desktop/dark/trip-stop-move.png)<br>`trip-stop-change-poi` [手機深](2026-11-04-hig-web-screenshots/mobile/dark/trip-stop-change-poi.png) [桌機深](2026-11-04-hig-web-screenshots/desktop/dark/trip-stop-change-poi.png)<br>`trip-stop-edit` [手機深](2026-11-04-hig-web-screenshots/mobile/dark/trip-stop-edit.png) [桌機深](2026-11-04-hig-web-screenshots/desktop/dark/trip-stop-edit.png)<br>`trip-add-entry` [手機深](2026-11-04-hig-web-screenshots/mobile/dark/trip-add-entry.png) [桌機深](2026-11-04-hig-web-screenshots/desktop/dark/trip-add-entry.png)<br>`trip-add-stop` [手機深](2026-11-04-hig-web-screenshots/mobile/dark/trip-add-stop.png) [桌機深](2026-11-04-hig-web-screenshots/desktop/dark/trip-add-stop.png)<br>`trip-edit` [手機深](2026-11-04-hig-web-screenshots/mobile/dark/trip-edit.png) [桌機深](2026-11-04-hig-web-screenshots/desktop/dark/trip-edit.png)<br>`trip-notes` [手機深](2026-11-04-hig-web-screenshots/mobile/dark/trip-notes.png) [桌機深](2026-11-04-hig-web-screenshots/desktop/dark/trip-notes.png)<br>`trip-collab` [手機深](2026-11-04-hig-web-screenshots/mobile/dark/trip-collab.png) [桌機深](2026-11-04-hig-web-screenshots/desktop/dark/trip-collab.png)<br>`trip-health` [手機深](2026-11-04-hig-web-screenshots/mobile/dark/trip-health.png) [桌機深](2026-11-04-hig-web-screenshots/desktop/dark/trip-health.png) |
| 79 | `trip-print`（桌機寬深色） | 外觀（觀察） | 列印預覽整頁（米色工具列、底色、白紙）在深色下不翻轉；紙張固定白合理，但工具列與背景也不翻轉，在深色環境下刺眼 | 看圖 | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `trip-print` [手機深](2026-11-04-hig-web-screenshots/mobile/dark/trip-print.png) [桌機深](2026-11-04-hig-web-screenshots/desktop/dark/trip-print.png) |
| 80 | `trip-edit`（桌機寬） | 流程（疑慮，待確認） | 底部列只有草稿／上線切換與「返回」，沒有「儲存」或「完成」；是否即時儲存、離開時是否提示，截圖看不出，沒有驗證 | 看圖（行為未驗） | 無一手來源（看圖、程式碼或專案規範判讀，沒有對應 HIG 條文） | `trip-edit` [手機淺](2026-11-04-hig-web-screenshots/mobile/light/trip-edit.png) [桌機淺](2026-11-04-hig-web-screenshots/desktop/light/trip-edit.png) |

### 修正狀態（trip-planner#1571）

已修並以測試守住（版面類：`tests/e2e/hig-fixes.spec.js`；名稱、ARIA、對比、分類：`tests/unit/hig-web-fixes.test.tsx`）：發現 **1、2、3、5、6、7、8、9**。重跑 axe 收集（當時 36 個場景的 144 筆輸出）：違規由 3 類（`aria-allowed-attr`、`label-content-name-mismatch`、`color-contrast`）降為 0，「需人工」清單前後相同。

- 發現 5：`explore` 的 Sight 是場景 mock 用的分類值 `sight`（真實資料是 Google Places 的 primaryType，未收錄者依 v2.55.73 的設計刻意顯示英文）；補上 `sight` → 景點的對照。真實資料是否出現 `sight` 未驗證。
- 發現 6：placeholder 縮到與同頁一致（1rem），以固定 min-height 維持有值與無值兩欄等高。手機寬 390 下「有值」的日期（如 2026-11-11）會折成兩行，是另一個既有問題，**未處理**。
- 發現 3 的修正讓膠囊文字不再被截出視窗，axe 因而量得到膠囊的 `aria-label` 沒有包含可見文字（先前落在「需人工」），一併修正（名稱改以可見文字開頭）。
- 觸控目標棘輪：起訖 chip 與移動方式膠囊的 accessible name 改變，`hig-known-violations.js` 內兩筆同一元素的標籤跟著更名（尺寸問題本身未改，不算修好）。

**未處理**（不在 #1571 範圍）：發現 4（場景限制）、10（清單載入失敗無重試）、11（200% 文字溢位，原因未定位），以及下列觀察。第四輪（彈出層）新增的發現 12～25 當時只記錄、未修；12～22、24 與 14、17 已在上方 #1587 一節修正，23 待決定，25 由 #1584 移除死碼。

### 修正狀態（trip-planner#1587）

發現 **12～22、24** 與 owner 回覆「照建議」的 **14、17** 已修並以測試守住（單元：`tests/unit/hig-popups-fixes.test.tsx`；版面幾何：`tests/e2e/hig-fixes.spec.js`）。逐項核實後全部成立，沒有不成立的項目。**23 未處理（待決定，見下）。**

- **12 已處理**：橫幅改用存在的 `--color-destructive`（文字）與不透明的 `--color-destructive-bg`（底），不再落到寫死的 `#8b2828`；淺色 4.85:1、深色 4.78:1。
- **13 已處理**：橫幅離線時把自己的高度發布成 `--server-banner-h`，`.app-shell` 的高度改為 `calc(100dvh - var(--server-banner-h, 0px))`，總高不變；e2e 量離線前後 `scrollHeight` 相同、shell 下緣不超出視窗。
- **14 已處理（owner 決定）**：全域橫幅是唯一的離線提示，**離線 Toast 類型整個移除**（`ToastType` 不再有 `'offline'`，`useOfflineToast` 只在恢復連線時跳「已恢復連線」，不留永遠不會跑的路徑與模組層級旗標）。行程頁「目前是離線模式」卡片帶頁面專屬資訊，保留。場景 `popup-toast-offline` 因此改名為 `popup-toast-online`。
- **15 已處理**：Toast 容器改為 `.tp-toast-region`：compact 在底部且高於 bottom nav（`--nav-height-mobile`）；≥1024px 在右上、titlebar 下方（`--titlebar-h`，離線橫幅在場時再讓出橫幅高度）。移除不再使用的 `--spacing-toast-top`。
- **16 已處理**：Toast 只有 `error` 用 `role="alert"`（隱含 assertive），其餘用 `role="status"`（隱含 polite），不再另設 `aria-live`。探索頁少於 2 字改為搜尋欄下方的欄位錯誤文字（`role="alert"`、`aria-invalid`、`aria-describedby`），繼續輸入才清除，不再發 Toast（場景 `popup-toast-error` 因此改取證「搜尋失敗」error Toast，只讓 `q=ab` 失敗）。
- **17 已處理（owner 決定）**：ConflictModal 先不接「改插入到後面」「取代既有」（那需要另外定義兩個動作對行程資料的語意，之後另開票）。呼叫端 `AddPoiFavoriteToTripPage` 改傳 `message`（只陳述「這個時段已經安排了景點，這次沒有加入」）與 `cancelLabel="知道了"`；元件預設文案與選項不動，其他呼叫端（目前沒有）不受影響。
- **18 已處理**：標題列 ✕ 的名稱改「關閉對話框」；連結卡的按鈕可見文字與名稱都改「關閉連結」（名稱含可見文字，符合 2.5.3）。
- **19 已處理**：有效期限分段控制改單列、選項等寬分配（`flex: 1 0 auto`），放不下時橫向捲動，不再折出只有「自訂」的孤列。
- **20 已處理（勾選框除外）**：分享對話框的 ✕、輸入框、區塊 pill、期限分段、建立、編輯／重新產生／關閉連結／刪除，帳號 sheet 與帳號頁的「編輯名稱」，聊天建議 chip 與送出鈕，都補到 `--spacing-tap-min`（44）。原先用不可見偽元素「擴大點擊區」的寫法量測不到，改成元素本身 44。**匿名勾選框本身仍是 17×17**（label 整列已是 44 高），留在 `hig-known-violations.js`；清單以 CI 實測為準。
- **21 已處理**：筆記區塊標題列改為 `div.tp-notes-section-head` 內並列「標題 `<button>`」與 AI `<button>`（兄弟，不再巢狀）；標題按鈕的 `::after` 鋪滿整列，點列上任何位置仍可展開，鍵盤 Enter／Space 由原生 button 處理，焦點環畫在整列。單元以 axe 的 `nested-interactive` 守門。
- **22 已處理**：彈出層標題一律 `h2`（DESIGN.md「Modal 標題 `<h2>`」、頁面只有一個 `h1`）：AI 授權 sheet（`h4`）與交通方式（`h3`）改 `h2`，並設 `margin: 0` 保持版面。設定頁內嵌的「AI 與資料」`h3` 不是彈出層，不動。
- **23 待決定**：圖示庫（`src/components/shared/Icon.tsx`）只有 `train`、`bus`、`ship`、`plane`、`car`、`walking`、`route`，**沒有**單軌、地鐵、高鐵專用圖示，挑不出四個彼此可分辨的；專案規定不引入外部圖示套件、也不自行畫 SVG。缺的是：單軌、地鐵、高鐵（火車可沿用 `train`）。替代方案：圖示維持，三者在 chip 圖示旁加縮寫字角標；或請設計提供三個圖示後新增到 Icon 元件。請 owner 擇一。
- **24 已處理**：`ErrorBanner` 新增 `action`；登出裝置失敗訊息改為「登出此裝置失敗，該裝置可能仍保持登入。」並帶「重試」（重跑同一個動作），「登出其他裝置」同理；「登出此帳號」失敗也補齊：確定仍登入時說「登出失敗，你目前仍保持登入。」，結果無法確認時說「不確定是否仍登入」，兩者都帶「重試」（進行中登出鈕停用，不重複送出）。橫幅上緣補 16px，與清單卡、下方說明卡間距一致。（「可能」是因為網路中斷時伺服器端是否已處理未知。）

**重拍與檢視（#1587）**：受影響場景（`popup-server-status-banner`、`popup-toast-error`、`popup-toast-online`、`popup-conflict-modal`、`popup-travel-pill-dialog`、`popup-share-link-modal`、`popup-error-banner`、`popup-account-sheet`、`popup-trip-sheet`、`popup-ai-consent-sheet`、`trip-notes`、`chat`、`account`）已在 Linux 容器（Playwright v1.64.1 noble）重拍；逐張目視的是：手機寬——橫幅淺深、Toast 錯誤與恢復連線、衝突對話框淺深、交通方式、分享對話框、登出失敗橫幅（深色）；桌機寬——橫幅（深色）、Toast 錯誤（淺色）、恢復連線（深色）、筆記頁。其餘重拍圖（含 `popup-account-sheet`、`popup-trip-sheet`、`popup-ai-consent-sheet`、`chat`、`account` 與未列出的淺深組合）只有場景 proof、axe 與觸控棘輪，**沒有逐張看**。

另有三項觀察、需要設計確認：`trip-print` 淺色與深色圖完全相同（列印預覽固定淺色）；`login`、`signup`、`forgot-password` 的桌機右側宣傳面板與外觀反相；`login` 手機寬卡片內外各一個 Tripline 標誌。

## 逐場景結果

| 場景 | 桌機寬 | 手機寬 | 結論 | 檢查表 | 說明 |
|---|---|---|---|---|---|
| `account-appearance` | 淺深已看 | 淺深已看 | 未見明顯問題 | — | 目視未發現與檢查表衝突之處；僅看圖，未量字級與對比 |
| `account-connected-apps` | 淺深已看 | 淺深已看 | 疑慮 | 版面 | 頁面上方的小標（帳號／設定／開發者後台）被固定頁首壓住而被裁切或重疊，桌機與手機都有 |
| `account-notifications` | 淺深已看 | 淺深已看 | 未見明顯問題 | — | 目視未發現與檢查表衝突之處；僅看圖，未量字級與對比 |
| `account-sessions` | 淺深已看 | 淺深已看 | 疑慮 | 版面 | 頁面上方的小標（帳號／設定／開發者後台）被固定頁首壓住而被裁切或重疊，桌機與手機都有 |
| `account` | 淺深已看 | 淺深已看 | 未見明顯問題 | — | 桌機、手機寬目視未發現與檢查表衝突之處；僅看圖，未量字級與對比 |
| `chat` | 淺深已看 | 淺深已看 | 未見明顯問題 | — | 桌機、手機寬目視未發現與檢查表衝突之處；僅看圖，未量字級與對比 |
| `developer-apps-new` | 淺深已看 | 淺深已看 | 已知 | A1 | scope 勾選框 13px、Redirect URIs 標籤與說明在手機寬擠成多行（觸控目標已在棘輪清單） |
| `developer-apps` | 淺深已看 | 淺深已看 | 疑慮 | 版面 | 頁面上方的小標（帳號／設定／開發者後台）被固定頁首壓住而被裁切或重疊，桌機與手機都有 |
| `explore` | 淺深已看 | 淺深已看 | 疑慮 | — | 手機寬的篩選膠囊「Sight 1」與卡片類別「SIGHT」是未在地化的英文原值，其他文字都是中文 |
| `favorites` | 淺深已看 | 淺深已看 | 未見明顯問題 | — | 桌機、手機寬目視未發現與檢查表衝突之處；僅看圖，未量字級與對比 |
| `forgot-password` | 淺深已看 | 淺深已看 | 觀察 | H2 | 桌機右側宣傳面板與外觀反相（淺色時深褐、深色時米白）；請確認是設計意圖；手機寬未見問題 |
| `landing` | 淺深已看 | 淺深已看 | 未見明顯問題 | — | 桌機、手機寬目視未發現與檢查表衝突之處；僅看圖，未量字級與對比 |
| `login` | 淺深已看 | 淺深已看 | 觀察 | H2 | 手機寬：卡片內與左上角各有一個 Tripline 標誌，重複；桌機右側宣傳面板與外觀反相，請確認是設計意圖 |
| `map` | 淺深已看 | 淺深已看 | 場景限制 | — | 場景擋掉 Google Maps，畫面是「地圖暫停服務」錯誤態，不是真實地圖；手機寬的錯誤橫幅有「重試」與「查看行程」兩個動作，此兩場景不能當地圖畫面的證據 |
| `privacy` | 淺深已看 | 淺深已看 | 未見明顯問題 | — | 桌機、手機寬目視未發現與檢查表衝突之處；僅看圖，未量字級與對比 |
| `signup` | 淺深已看 | 淺深已看 | 觀察 | H2、F5 | 手機寬：未勾同意時「建立帳號」呈停用外觀且有就地說明，與 App 的 `auth-signup`（空表單仍可按）不同；桌機右側宣傳面板與外觀反相，請確認是設計意圖 |
| `trip-add-entry` | 淺深已看 | 淺深已看 | 未見明顯問題 | — | 目視未發現與檢查表衝突之處；僅看圖，未量字級與對比 |
| `trip-add-stop` | 淺深已看 | 淺深已看 | 未見明顯問題 | — | 目視未發現與檢查表衝突之處；僅看圖，未量字級與對比 |
| `trip-collab` | 淺深已看 | 淺深已看 | 未見明顯問題 | — | 目視未發現與檢查表衝突之處；僅看圖，未量字級與對比 |
| `trip-detail` | 淺深已看 | 淺深已看 | 疑慮 | E1、版面 | 桌機右側地圖面板的錯誤態「重試」是未套樣式的原生灰色按鈕；手機寬的移動方式膠囊（13 min · 6.6 km…）超出右緣被截斷 |
| `trip-edit` | 淺深已看 | 淺深已看 | 未見明顯問題 | — | 目視未發現與檢查表衝突之處；僅看圖，未量字級與對比 |
| `trip-health` | 淺深已看 | 淺深已看 | 未見明顯問題 | — | 目視未發現與檢查表衝突之處；僅看圖，未量字級與對比 |
| `trip-map` | 淺深已看 | 淺深已看 | 場景限制 | — | 場景擋掉 Google Maps，畫面是「地圖暫停服務」錯誤態，不是真實地圖；此兩場景不能當地圖畫面的證據 |
| `trip-notes` | 淺深已看 | 淺深已看 | 未見明顯問題 | — | 目視未發現與檢查表衝突之處；僅看圖，未量字級與對比 |
| `trip-print` | 淺深已看 | 淺深已看 | 觀察 | H2 | 淺色與深色圖完全相同（列印預覽固定淺色）；列印情境可接受，但深色模式下不跟隨 |
| `trips-list` | 淺深已看 | 淺深已看 | 未見明顯問題 | — | 桌機、手機寬目視未發現與檢查表衝突之處；僅看圖，未量字級與對比 |
| `trips-new` | 淺深已看 | 淺深已看 | 疑慮 | B | 手機寬日期欄位的「選擇日期」字級明顯大於同頁其他欄位的 placeholder；底部固定操作列蓋住「讓 AI 幫你把行程填滿」卡片的下半（可捲動） |
| `invite` | **未看**（本檔兩處敘述矛盾，保守視為沒看） | 手機已看（淺深並排圖） | 未見明顯問題 | — | 「註冊並加入」為主要、「登入並加入」為次要，說明與有效期齊全；axe 無違規。**200% 文字有橫向捲動（發現 11）** |
| `invite-invalid` | **未看**（同上） | 手機已看（淺深並排圖） | 未見明顯問題 | G6 | 410＋`INVITATION_INVALID`（真實契約）：錯誤橫幅加「請聯絡邀請者重寄一份新的邀請連結」，沒有無意義的重試。觀察：橫幅文字折行剩孤字「寄」，且同一句話在橫幅與下方各出現一次。**注意**：這個場景一開始用了不存在的錯誤碼，拍到不真實的畫面，曾因此誤報一項發現，已撤回並重拍 |
| `login-error` | 淺深已看（#1565，並排圖） | 手機已看（淺深並排圖） | 符合 | G6 | 就地橫幅（圖示加文字）「電子郵件或密碼錯誤」，輸入保留；axe 無違規；「忘記密碼？」64×19 為既有違規 |
| `login-rate-limited` | 淺深已看（#1565，並排圖） | 手機已看（淺深並排圖） | 符合 | G6 | 鎖頭圖示、說明、15:00 倒數與「重設密碼」出口；axe 無違規 |
| `reset-password` | 淺深已看（#1565，並排圖） | 手機已看（淺深並排圖） | 符合 | F | 兩個密碼欄、強度條與規則清單（長度、字母與數字）；axe 無違規 |
| `signup-check-email` | 淺深已看（#1565，並排圖） | 手機已看（淺深並排圖） | 疑慮 | B7 | 內容齊全（信箱、有效期、打開信箱、重寄倒數停用、改用其他信箱）；**200% 文字有橫向捲動（發現 11）** |
| `trips-list-empty` | 深色已看（#1566）；淺色未逐張看 | 手機已看（淺深並排圖） | 符合 | G10 | 圖示、標題、說明與「新增行程」主要動作 |
| `trips-list-error` | 深色已看（#1566）；淺色未逐張看 | 手機已看（淺深並排圖） | 疑慮 | G6、G7 | 見發現 10 |
| `verify-email` | 淺深已看（#1565，並排圖） | 手機已看（淺深並排圖） | 未見明顯問題 | — | 說明與單一主要按鈕；axe 無違規；200% 文字檢查沒有生效（該頁字級不隨 root 變） |
| `popup-account-sheet` | 淺色已看 | 淺深已看 | 疑慮（已知） | A1、D12 | 桌機右側面板、手機全屏，有 ✕ 關閉，名稱「帳號」；「編輯名稱」32×32（與 `account` 頁同一元件）；axe 無違規 |
| `popup-ai-consent-sheet` | 淺色已看 | 淺深已看 | 觀察 | D8、D12、發現 22 | 底部 sheet，主要動作「授權並送出」滿版、次要「取消」為文字鈕，引用將送出的訊息；沒有右上關閉與 grabber（固定高度 sheet 刻意不放，見 DESIGN.md）；觸控目標全 ≥ 44；axe 無違規 |
| `popup-ai-data-consent-sheet` | 淺色已看 | 淺深已看 | 未見明顯問題 | D12 | 標題、可展開章節（第一個預設展開）、「暫不使用」「同意並繼續」並排、輸入已保留提示與版本；觸控 ≥ 44；axe 無違規。只取證 consent 模式（owner-missing 模式未造） |
| `popup-share-link-modal` | 淺色已看 | 淺深已看 | 疑慮 | A1、D16、發現 18、19、20 | 內容完整（名稱、區塊、期限、匿名、既有連結的編輯／重新產生／關閉／刪除）；axe 無違規 |
| `popup-confirm-modal` | 淺色已看 | 淺深已看 | 符合 | G2、G3、G4、G9、E3 | alertdialog，標題具體、有說明；取消（左，預設焦點，e2e 已守）與破壞性「登出全部」（右，紅）；按鈕 ≥ 44；axe 無違規。只有「登出其他所有裝置」一個呼叫端被取證 |
| `popup-conflict-modal` | 淺色已看 | 淺深已看 | 疑慮 | G2 | 見發現 17；axe 無違規 |
| `popup-input-modal` | 淺色已看 | 淺深已看 | 符合 | D12 | 標題、說明、輸入框（開啟即聚焦，焦點環明顯）、取消／切換；≥ 44；axe 無違規 |
| `popup-note-ai-exclusions-dialog` | 淺色已看 | 淺深已看 | 未見明顯問題（背景頁有 axe 違規） | D12、發現 21 | 標題、說明、清單項（標籤、類別、zh-TW 日期）、「恢復」鈕與 ✕ 關閉；axe 違規在背景頁。場景 mock 的 `ai-state` 排除數是 0、對話框卻列 1 項（fixture 不一致，不是產品問題） |
| `popup-travel-pill-dialog` | 淺色已看 | 淺深已看 | 觀察 | D12、E4、發現 23 | 手機底部 sheet、桌機置中；沒有右上關閉，底部有「關閉」；模式 chip 與輸入 ≥ 44；axe 無違規 |
| `popup-trip-sheet` | 淺深已看 | 無（該欄 `display:none`） | 觀察 | A1、發現 20 | 桌機右欄，分頁「地圖／聊天」；只取證聊天分頁（地圖分頁受 Google Maps 被擋的限制，見發現 4） |
| `popup-error-banner` | 淺色已看 | 淺深已看 | 觀察 | G6、發現 24 | 圖示加文字的就地橫幅，role=alert；axe 無違規 |
| `popup-server-status-banner` | 淺色已看 | 淺深已看 | 疑慮 | C、版面、發現 12、13 | 淺色可讀；深色幾乎讀不到（axe 1.37:1），並把整個版面往下推 59px |
| `popup-toast-error` | 重拍已看（桌機寬）| 重拍已看（手機寬）| 已處理 | G6、發現 15、16 | 見修正狀態 15、16；場景改取證「搜尋失敗」Toast；axe 無違規 |
| `popup-toast-online` | 重拍已看（桌機寬）| 重拍已看（手機寬）| 已處理 | G7、發現 14 | 原 `popup-toast-offline` 場景在 #1587 14 之後不再成立（橫幅在場時離線 Toast 不出現），改取證「已恢復連線」Toast；見修正狀態 14 |

## 第五輪（#1565）：認證與帳號類頁面

新增 15 個場景（`change-password` 系列 6、`oauth-authorize` 系列 5、`oauth-consent` 系列 3、`auth-callback`），在 Linux 容器（Playwright v1.64.1 noble）截圖，手機寬與桌機寬各淺深，共 60 張；觸控目標量測全部 0 違規；axe 對這 15 個場景淺深各一次，**沒有違規**（`change-password-success` 有 1 筆 `color-contrast` 需人工：版本號分隔點，內容太短無法判定）；320px 重排與 200% 文字無橫向捲動（`oauth-consent-error` 沒有可量字級，比值為空）。
**看圖範圍**：新場景手機寬淺深並排圖我全看過（15 張）；桌機寬看過 `change-password` 全部 6 個、`oauth-authorize`、`oauth-authorize-scopes`、`oauth-authorize-login-error`、`oauth-consent-unknown-scope`、`auth-callback`；**桌機寬沒有看**：`oauth-authorize-login`、`oauth-authorize-error`、`oauth-consent`、`oauth-consent-error`（只有 proof、量測與 axe）。既有認證與帳號場景的桌機寬淺深並排圖補看了 15 個（`login`、`login-error`、`login-rate-limited`、`signup`、`signup-check-email`、`forgot-password`、`reset-password`、`verify-email`、`account`、`account-appearance`、`account-notifications`、`account-sessions`、`account-connected-apps`、`developer-apps`、`developer-apps-new`），沒有逐張個別開啟，是淺色與深色拼成一張看；這些圖不是本輪重拍的，環境見上方說明。上方三處原寫「桌機未看」的場景（第三輪 9 個）已在此補看，結果見發現 33、34 與下表。

**場景怎麼做出來的**：變更密碼、`/oauth/authorize`、`/auth/callback` 要「新 api 認證」旗標（建置期常數），所以 `playwright.config.js` 多一份旗標開啟的建置（埠 3001，API 網址指向自己，由 `page.route` 攔截）；登入憑證用 `seedNewApiAuth` 直接種進 IndexedDB（結構照 `src/lib/auth/storage.ts`），`/api/oauth/token` 回 DPoP 形狀的假 token，proof 由頁面真的簽。`/auth/callback` 的 token 端點刻意不回應，畫面才會停在「登入中…」（場景設 `noIdle`）。

| 場景 | 結論 | 說明 |
|---|---|---|
| `change-password` | 未見明顯問題 | 設定列式表單、標題列主要動作（桌機「✓ 變更」、手機只有 ✓，是 W3 的有意設計，TitleBarPrimaryAction 註解有寫）、常駐說明；未填時主要動作停用外觀偏淡（停用狀態，不要求對比）；觸控 0 違規；axe 無違規 |
| `change-password-current-invalid` | 疑慮 | 見發現 27 |
| `change-password-too-short` | 符合 | 離開新密碼欄才顯示「新密碼至少 8 字元」，打字中不跳錯；焦點整列畫外框（目前密碼欄），淺深都清楚 |
| `change-password-same` | 符合 | 同上，「新密碼不能和目前密碼相同」 |
| `change-password-rate-limited` | 符合 | 「嘗試次數過多，請在 15 分鐘後再試」，429 的 Retry-After 900 秒換算正確；輸入保留 |
| `change-password-success` | 疑慮 | 成功回到帳號頁，但沒有任何成功回饋，見發現 26 |
| `oauth-authorize` | 未見明顯問題 | 以帳號晶片、單一「繼續」、可展開權限（預設收合）；沒有「拒絕」是設計決定（程式碼註解），改以「不是您本人要求的？直接關閉此頁」說明 |
| `oauth-authorize-scopes` | 未見明顯問題 | 展開後六項權限含說明，文字折行正常 |
| `oauth-authorize-login` | 疑慮 | 見發現 28；密碼欄沒有「顯示密碼」切換（與變更密碼頁不同，未對照 HIG） |
| `oauth-authorize-login-error` | 符合 | 圖示加文字的就地橫幅，輸入保留 |
| `oauth-authorize-error` | 疑慮 | 見發現 30 |
| `oauth-consent` | 未見明顯問題 | 「拒絕授權」（次要）與「同意授權」（主要）等寬並排，說明如何撤銷；手機寬看過，桌機寬未看 |
| `oauth-consent-unknown-scope` | 疑慮 | 見發現 29 |
| `oauth-consent-error` | 疑慮 | 見發現 30 |
| `auth-callback` | 疑慮 | 見發現 31 |

工具限制：焦點收集（`hig-a11y-collect`）對 `change-password*` 回報「輸入框沒有焦點樣式」，那是誤報：輸入框自己 `outline:none`，焦點畫在整列（`:focus-within`），上方 `too-short`／`same` 的圖可見外框；收集器只看被聚焦元素本身。

HIG 結論的依據：本輪沒有查 Apple 一手文件；A1（44px）是專案自訂標準，G6 等條目依 flutter repo 的檢查表（內有的一手來源標註以該表為準），其餘為看圖與程式碼判讀。


## 取證 3（trip-planner#1566）補充

範圍：TripsList、Explore、PoiFavorites、GlobalMap、Map、Chat、Landing、Privacy 與相關彈出層。新場景的圖與棘輪在 Linux 容器（Playwright v1.64.1 noble）取得；**既有場景的圖沒有重拍**，所以有些圖反映的是修正前的畫面（例如 `explore` 桌機深色仍是「Sight」，發現 5 已修）。截圖都是 `fullPage:false`，只有第一屏：`landing`、`privacy` 往下的內容沒有被看到。

### 新增場景（8 個頁面／表單、6 個錨定選單與下拉面板）

| 場景 | 桌機寬 | 手機寬 | 結論 | 說明 |
|---|---|---|---|---|
| `add-to-trip` | 深色已看 | 淺色已看 | 觀察 | direct mode，選完行程後載入天數；見發現 45。觸控目標全 ≥ 44 |
| `favorite-add-to-trip` | 深色已看 | 淺色已看 | 觀察 | 與上同一元件；見發現 45 |
| `favorites-list` | 深色已看 | 淺色已看 | 疑慮 | 見發現 51；既有 `favorites` 只拍到空狀態 |
| `popup-trip-card-menu` | 深色已看 | 淺色已看 | 符合 | 項目 ≥ 44、危險項紅色在最後、有圖示；尚缺 owner-only 的封存項（mock 限制） |
| `popup-trip-actions-menu` | 淺色、深色已看 | 深色已看 | 符合 | 分組（行程／列印分享／下載格式）清楚，項目 ≥ 44 |
| `popup-rail-row-menu` | 深色已看 | 淺色已看 | 疑慮 | 發現 46；分組以分隔線區隔、危險項在最後 |
| `popup-trip-select` | 深色已看 | 淺色已看 | 符合 | 選取項有勾與強調色，項目 ≥ 44 |
| `popup-trip-date-picker` | 深色已看 | 淺色已看 | 疑慮 | 發現 47、48、49 |
| `popup-trip-time-picker` | 深色已看 | 淺色已看 | 觀察 | 發現 50；面板覆蓋下方欄位的說明文字（彈出層本質，不算問題） |

### 既有場景補看桌機寬深色（逐張個別開啟）

| 場景 | 判定 | 說明 |
|---|---|---|
| `landing` | 未見明顯問題（只看第一屏） | 深色標題與強調色對比清楚；右上「登入」是純文字連結，沒量桌機觸控目標（桌機不適用 44） |
| `privacy` | 觀察 | 版面易讀；發現 54 |
| `trips-list` | 疑慮 | 發現 52；「我的 0／共編 2」是 mock 登入帳號與 `ownerUserId` 對不上造成，不是產品問題 |
| `trips-list-empty` | 符合 | 圖示、標題、說明、主要動作齊全 |
| `trips-list-error` | 疑慮（已知） | 發現 10：沒有重試；橫幅與側欄各有一則載入失敗訊息 |
| `explore` | 疑慮（已知） | 圖仍是修正前的「Sight」（發現 5 已修）；卡片上的「＋」「♥」圓鈕看起來夠大，沒另量桌機 |
| `favorites` | 符合 | 空狀態有標題、說明與主要動作 |
| `chat` | 未見明顯問題 | 空狀態、建議 chip、送出鈕停用態可辨；輸入框 placeholder 對比偏低但未量測 |
| `map` | 受限（發現 4） | 地圖被擋，畫面是「地圖暫停服務」加「重試」「查看行程」，下方是 Day 卡片列；**不是真實地圖，無法評估地圖本身** |
| `popup-ai-consent-sheet` | 觀察 | 桌機寬是貼底、置中的窄 sheet，深色層次分明；與淺色看到的一致 |
| `popup-ai-data-consent-sheet` | 未見明顯問題 | 章節展開／收合箭頭方向正確 |
| `popup-conflict-modal` | 疑慮（已知，發現 17） | 只有「知道了」一顆按鈕 |
| `popup-input-modal` | 符合 | 焦點環明顯 |
| `popup-account-sheet` | 符合 | 右側面板、✕ 關閉；內容超過一屏需捲動 |
| `popup-trip-sheet` | 觀察（已知） | 先前已看；地圖分頁受限 |
| `popup-toast-error` | 疑慮 | 發現 53 |
| `popup-toast-online` | 觀察 | 「已恢復連線」疊在右側面板的錯誤卡右上角，短暫遮住卡片標題右端；Toast 本來就會停留 2～3 秒 |
| `popup-server-status-banner` | 疑慮（已知，發現 12、13） | 此圖深色橫幅文字可讀，橫幅把整個版面下推 38px（桌機）；發現 12 若已修正，需重拍確認 |

**沒看到的**：上列新場景的淺色桌機寬與其他寬度未全部逐張看（表內寫「未看」者）；手機寬深色只看了 `popup-trip-actions-menu`；既有場景在桌機寬深色以外的圖沿用前幾輪的結論；地圖類場景無法評估真實地圖；`TripCardMenu`／`TripActionsMenu` 的封存與還原項、`TripPickerPopover`、`CollabSheet`、`InfoSheet` 為缺口。

### 這輪的量測改動

- 觸控量測原本不含 `role=option`，所以下拉面板的選項量不到（`popup-trip-select` 觸發「量測沒有涵蓋彈出層內的任何可點擊元素」而紅燈）；已把 `[role=option]` 納入 `INTERACTIVE`。對既有場景沒有影響（沒有場景開著下拉面板）。
### 第五輪（#1567）：行程詳情與編輯流程新增場景

每個場景手機寬淺深與桌機寬淺深共 4 張（`trip-add-custom-stop` 只有手機寬 2 張），圖是剛在 Linux 容器（Playwright v1.64.1 noble）建置的畫面；**我逐張看了 `mobile/light` 與 `desktop/dark` 各一張、`trip-share` 與 `trip-add-custom-stop` 另看了其餘寬度與主題**，`trip-stop-*` 其餘的淺深組合只靠 proof、棘輪與同組比對，沒有逐張看。

| 場景 | 判定 | 條目 | 發現 | 備註 |
|---|---|---|---|---|
| `trip-share` | 疑慮 | A1、版面 | 73、74、75 | 公開分享頁，無登入；顯示標題、分享者、列印／存成 PDF／複製按鈕與全展開文件，沒有任何編輯入口 |
| `trip-stop-copy` | 未見明顯問題 | A1 | 78 | 日期卡片、時段下拉、「取消／複製」；觸控 ≥ 44；未選日期時「複製」是淡色停用，說明在上方標題「選擇目標日期」 |
| `trip-stop-move` | 未見明顯問題 | A1 | 78 | 同上；目前所在的 Day 1 以淡色停用並標「目前」，停用項對比偏低（屬刻意的停用態） |
| `trip-stop-change-poi` | 疑慮 | A1 | 77、78 | 只取證初始空搜尋態（搜尋、收藏、自訂三分頁；沒有搜尋結果、收藏、自訂分頁的狀態） |
| `trip-stop-edit` | 疑慮 | A1 | 76、78 | 起訖時間欄顯示 `--:--`（mock 沒有時間）；備選項目的上下移、設為正選、移除鈕在手機寬可見 |
| `trip-add-custom-stop` | 疑慮 | 版面 | 70、71、72 | 手機專用路由；桌機寬會轉址到 `add-stop`，不取桌機圖 |

## 彈出層缺口（造不出場景）

| 元件 | 原因 | 證據 |
|---|---|---|
| `TripPickerPopover` | 沒有掛載點：全 `src/` 只有它自己的檔案與測試引用；`ExplorePage` 只剩註解、`TripsListPage` 剩一組無人使用的 `tripPickerOpen` state | grep |
| `CollabSheet`、`InfoSheet` | 唯一掛載點是 `TripPage` 內的 `<InfoSheet open={activeSheet === 'collab'}>`；`activeSheet` 只會被 `TripPageHandle.openSheet()` 設定，全 `src/` 沒有呼叫端，而 `?sheet=collab` 會被轉址到 `/trip/:id/collab` | grep、`TripPage.tsx:576-580` |

三者都是使用者走不到的元件：若硬把元件掛進測試頁來截圖，證明的是「元件單獨能渲染」，不是產品畫面，所以不造。是否移除另案決定。

## 補掃：axe、重排、縮放、鍵盤焦點（工具量測）

`tests/e2e/hig-a11y-collect.spec.js`（收集用，`HIG_COLLECT=1` 才執行，否則 skip；場景清單與 mock 與截圖 spec 共用 `hig-scene-fixtures.js`）。（第一、二輪當時）27 個場景、chromium、共 135 筆輸出。

| 項目 | 範圍 | 結果 |
|---|---|---|
| axe（WCAG 2.0／2.1／2.2 A、AA） | 手機寬，淺深各一次 | 只有 3 類違規，即上表發現 7、8、9；其他場景 axe 沒有違規 |
| axe「需人工」（incomplete） | — | `color-contrast` 15 筆、`label-content-name-mismatch` 12 筆。多半是背景圖或漸層上的文字，axe 無法判定，**不算通過**；沒有逐筆人工複核 |
| 重排（WCAG 1.4.10） | 320×568 | 27 個場景都沒有橫向捲動 |
| 文字放大 200% | `html` font-size 200% | 27 個場景都沒有橫向捲動。**限制**：這只對 rem／em 排版有意義；`landing` 的字級量到沒有跟著放大（比值 1.0），這一頁沒有被檢查到；其餘約 1.88 倍 |
| 鍵盤焦點（WCAG 2.4.7） | 桌機寬，每頁連按 Tab 最多 14 次 | 只有 `explore` 的搜尋欄沒有偵測到外框或陰影（可能用邊框變色，本檢查不認，需目視確認）。**限制**：卡片本來就有陰影的元素會被誤判為有焦點樣式，所以「沒問題」不等於焦點一定清楚 |

### 第四輪：彈出層場景的補掃（Linux 容器，chromium）

`HIG_COLLECT=1`、`hig-a11y-collect.spec.js` 只對 `popup-*` 跑：axe 14 個場景 × 淺深、重排與縮放 13 個（`popup-trip-sheet` 沒有手機寬，略過）、焦點 14 個，共 68 筆輸出。

| 項目 | 結果 |
|---|---|
| axe 違規 | 3 筆：`popup-server-status-banner` 深色 `color-contrast`（發現 12）；`popup-note-ai-exclusions-dialog` 淺深各一筆 `nested-interactive`（發現 21，在背景頁）。其餘 12 個場景無違規 |
| axe「需人工」 | `color-contrast`、`label-content-name-mismatch` 多半來自彈出層背後的頁面（`popup-trip-sheet` 59／8、`popup-toast-offline` 60／9、`popup-travel-pill-dialog` 43／5）；axe 對整份文件執行，不只彈出層，所以數字不能當成彈出層自己的問題。沒有逐筆人工複核 |
| 重排 320px | 13 個都沒有橫向捲動（`scrollWidth` 310，是 Linux 傳統捲軸占掉的寬度） |
| 文字放大 200% | 13 個都沒有橫向捲動，字級比 1.88 |
| 鍵盤焦點 | 14 個場景連按 Tab 14 次，沒有「看不出焦點樣式」的元素。**限制**：沒有驗證焦點是否被關在對話框內（那由 `aria-modal-focus-trap.test.ts` 與 `a11y-axe.spec.js` 負責，本輪未重驗）；Toast 只停留 2～3 秒，axe 掃描時是否仍在畫面上未確認 |

## 沒做的事

- 對比、重排（B7）、鍵盤焦點（J5、J6）已用上面的補掃做過，有各自的限制；沒有 dialog 行為檢查（D16、G9），也沒有實際用螢幕閱讀器走過。
- 場景沒涵蓋：oauth 兩頁、`/add-to-trip`、停留點的單點地圖頁（`stop/:entryId/map`，Google Maps 被擋，列缺口）（見 inventory）；#1567 補了 `/s/:token`、copy／move／change-poi／edit、`add-custom-stop`；彈出層缺 3 個（見上）與各彈出層的其他狀態（AI 資料同意 owner-missing 與 stale／withdrawn 橫幅、Toast 的 success／info／online、ConfirmModal 的 busy、錨定選單與下拉面板）。
- **webkit（Safari 引擎）**：已跑（當時的）36 個場景的截圖與 axe／重排／縮放／焦點掃描（`playwright.hig-webkit.config.js`，需先安裝 webkit）。**axe 違規集合與 chromium 完全相同**（`trips-new` 的 ARIA 與標籤、`trip-print` 對比、時間 chip 標籤）；320px 重排無溢位；200% 文字同樣兩頁溢位（`signup-check-email` 354、`invite` 366，與 chromium 的數字一致，說明是版面本身的問題）；焦點無樣式同樣只有 `explore` 搜尋欄。注意：本輪新增的 14 個彈出層場景只跑 chromium，**沒有跑 webkit**。webkit 下 6 個場景 Tab 一個都跳不到（`landing`、`login-error`、`login-rate-limited`、`signup-check-email`、`invite`、`invite-invalid`），那是 Safari 預設不 Tab 到連結與按鈕的行為，不是缺陷。**沒做**：chromium 與 webkit 的畫面差異沒有逐張比對，只比了掃描結果。

## 第五輪（#1567）沒看的圖

既有範圍內場景的桌機寬深色，本輪補看了：`trip-detail`、`trip-print`、`trip-collab`、`trip-notes`、`trip-edit`、`trip-add-stop`、`trip-add-entry`、`trip-health`、`trips-new`、`popup-share-link-modal`、`popup-travel-pill-dialog`、`popup-note-ai-exclusions-dialog`（見發現 78、79、80；其餘未見新問題）。這批圖是先前輪次的截圖，沒有重拍，環境以當時為準。**仍沒看**：`trip-map`、`invite`、`invite-invalid` 的桌機寬深色；範圍內所有場景的手機寬深色（先前輪次只看過淺深並排圖，本輪未再看）；本輪新增場景的 `trip-stop-*` 其餘主題組合。各場景的 axe、重排、焦點掃描（`hig-a11y-collect.spec.js`）本輪未對新場景執行。

## 覆蓋率（清單項目 → 場景 → 狀態）

資料來源：`2026-11-04-hig-page-inventory.md` 的路由表與彈出層表、`tests/e2e/hig-scene-fixtures.js` 的 `SCENES`，由指令產出對照；場景連結指向手機寬淺色截圖（沒有手機寬者用桌機寬淺色）。

- 路由：54 條，已取證 47、已排除 6、缺口 1；扣除已排除後取證率 **47/48（97.9%）**。
- 彈出層元件：22 個，已取證 19、缺口 3；取證率 **19/22（86.4%）**。
- 合計 66/70（94.3%）；**「已取證」不等於每張圖都逐張看過**，也不代表該頁的所有狀態都取證，見上方缺口與沒看清單。
- 每個場景都對應到至少一個清單項目。

### 路由

| 路由 | 狀態 | 場景（連到手機寬淺色截圖） | 說明／缺口原因 |
|---|---|---|---|
| `/account` | 已取證 | [`account`](2026-11-04-hig-web-screenshots/mobile/light/account.png) | — |
| `/account/appearance` | 已取證 | [`account-appearance`](2026-11-04-hig-web-screenshots/mobile/light/account-appearance.png) | — |
| `/account/notifications` | 已取證 | [`account-notifications`](2026-11-04-hig-web-screenshots/mobile/light/account-notifications.png) | — |
| `/account/sessions` | 已取證 | [`account-sessions`](2026-11-04-hig-web-screenshots/mobile/light/account-sessions.png) | — |
| `/account/password` | 已取證 | [`change-password`](2026-11-04-hig-web-screenshots/mobile/light/change-password.png)、[`change-password-current-invalid`](2026-11-04-hig-web-screenshots/mobile/light/change-password-current-invalid.png)、[`change-password-too-short`](2026-11-04-hig-web-screenshots/mobile/light/change-password-too-short.png)、[`change-password-same`](2026-11-04-hig-web-screenshots/mobile/light/change-password-same.png)、[`change-password-rate-limited`](2026-11-04-hig-web-screenshots/mobile/light/change-password-rate-limited.png)、[`change-password-success`](2026-11-04-hig-web-screenshots/mobile/light/change-password-success.png) | — |
| `/account/connected-apps` | 已取證 | [`account-connected-apps`](2026-11-04-hig-web-screenshots/mobile/light/account-connected-apps.png) | — |
| `/settings/appearance` | 已取證 | [`account-appearance`](2026-11-04-hig-web-screenshots/mobile/light/account-appearance.png) | 路由別名，同元件 |
| `/settings/notifications` | 已取證 | [`account-notifications`](2026-11-04-hig-web-screenshots/mobile/light/account-notifications.png) | 路由別名，同元件 |
| `/settings/sessions` | 已取證 | [`account-sessions`](2026-11-04-hig-web-screenshots/mobile/light/account-sessions.png) | 路由別名，同元件 |
| `/settings/connected-apps` | 已取證 | [`account-connected-apps`](2026-11-04-hig-web-screenshots/mobile/light/account-connected-apps.png) | 路由別名，同元件 |
| `/` | 已取證 | [`landing`](2026-11-04-hig-web-screenshots/mobile/light/landing.png) | — |
| `/admin` | 已排除 | — | 純轉址，不是畫面 |
| `/admin/` | 已排除 | — | 純轉址，不是畫面 |
| `/manage` | 已排除 | — | 純轉址，不是畫面 |
| `/manage/` | 已排除 | — | 純轉址，不是畫面 |
| `/chat` | 已取證 | [`chat`](2026-11-04-hig-web-screenshots/mobile/light/chat.png) | — |
| `/map` | 已取證 | [`map`](2026-11-04-hig-web-screenshots/mobile/light/map.png) | 場景限制：地圖被擋，畫面是「地圖暫停服務」，不是真實地圖 |
| `/explore` | 已取證 | [`explore`](2026-11-04-hig-web-screenshots/mobile/light/explore.png) | — |
| `/favorites` | 已取證 | [`favorites`](2026-11-04-hig-web-screenshots/mobile/light/favorites.png)、[`favorites-list`](2026-11-04-hig-web-screenshots/mobile/light/favorites-list.png) | — |
| `/favorites/:id/add-to-trip` | 已取證 | [`favorite-add-to-trip`](2026-11-04-hig-web-screenshots/mobile/light/favorite-add-to-trip.png)、[`popup-conflict-modal`](2026-11-04-hig-web-screenshots/mobile/light/popup-conflict-modal.png) | — |
| `/add-to-trip` | 已取證 | [`add-to-trip`](2026-11-04-hig-web-screenshots/mobile/light/add-to-trip.png) | — |
| `/privacy` | 已取證 | [`privacy`](2026-11-04-hig-web-screenshots/mobile/light/privacy.png) | — |
| `/login` | 已取證 | [`login`](2026-11-04-hig-web-screenshots/mobile/light/login.png)、[`login-error`](2026-11-04-hig-web-screenshots/mobile/light/login-error.png)、[`login-rate-limited`](2026-11-04-hig-web-screenshots/mobile/light/login-rate-limited.png) | — |
| `/signup` | 已取證 | [`signup`](2026-11-04-hig-web-screenshots/mobile/light/signup.png) | — |
| `/signup/check-email` | 已取證 | [`signup-check-email`](2026-11-04-hig-web-screenshots/mobile/light/signup-check-email.png) | — |
| `/login/forgot` | 已取證 | [`forgot-password`](2026-11-04-hig-web-screenshots/mobile/light/forgot-password.png) | — |
| `/auth/password/reset` | 已取證 | [`reset-password`](2026-11-04-hig-web-screenshots/mobile/light/reset-password.png) | — |
| `/auth/verify-email` | 已取證 | [`verify-email`](2026-11-04-hig-web-screenshots/mobile/light/verify-email.png) | — |
| `/s/:token` | 已取證 | [`trip-share`](2026-11-04-hig-web-screenshots/mobile/light/trip-share.png) | — |
| `/developer/apps` | 已取證 | [`developer-apps`](2026-11-04-hig-web-screenshots/mobile/light/developer-apps.png) | — |
| `/developer/apps/new` | 已取證 | [`developer-apps-new`](2026-11-04-hig-web-screenshots/mobile/light/developer-apps-new.png) | — |
| `/oauth/consent` | 已取證 | [`oauth-consent`](2026-11-04-hig-web-screenshots/mobile/light/oauth-consent.png)、[`oauth-consent-unknown-scope`](2026-11-04-hig-web-screenshots/mobile/light/oauth-consent-unknown-scope.png)、[`oauth-consent-error`](2026-11-04-hig-web-screenshots/mobile/light/oauth-consent-error.png) | — |
| `/oauth/authorize` | 已取證 | [`oauth-authorize`](2026-11-04-hig-web-screenshots/mobile/light/oauth-authorize.png)、[`oauth-authorize-scopes`](2026-11-04-hig-web-screenshots/mobile/light/oauth-authorize-scopes.png)、[`oauth-authorize-login`](2026-11-04-hig-web-screenshots/mobile/light/oauth-authorize-login.png)、[`oauth-authorize-login-error`](2026-11-04-hig-web-screenshots/mobile/light/oauth-authorize-login-error.png)、[`oauth-authorize-error`](2026-11-04-hig-web-screenshots/mobile/light/oauth-authorize-error.png) | — |
| `/auth/callback` | 已取證 | [`auth-callback`](2026-11-04-hig-web-screenshots/mobile/light/auth-callback.png) | — |
| `/invite` | 已取證 | [`invite`](2026-11-04-hig-web-screenshots/mobile/light/invite.png)、[`invite-invalid`](2026-11-04-hig-web-screenshots/mobile/light/invite-invalid.png) | — |
| `/trips` | 已取證 | [`trips-list`](2026-11-04-hig-web-screenshots/mobile/light/trips-list.png)、[`trips-list-empty`](2026-11-04-hig-web-screenshots/mobile/light/trips-list-empty.png)、[`trips-list-error`](2026-11-04-hig-web-screenshots/mobile/light/trips-list-error.png) | — |
| `/trips/new` | 已取證 | [`trips-new`](2026-11-04-hig-web-screenshots/mobile/light/trips-new.png) | — |
| `/trip/:tripId` | 已取證 | [`trip-detail`](2026-11-04-hig-web-screenshots/mobile/light/trip-detail.png) | — |
| `map` | 已取證 | [`trip-map`](2026-11-04-hig-web-screenshots/mobile/light/trip-map.png) | 場景限制：地圖被擋，畫面是「地圖暫停服務」，不是真實地圖 |
| `stop/:entryId` | 已排除 | — | 轉址到 `/trips?selected=…&focus=…`，不是畫面 |
| `stop/:entryId/map` | 缺口 | — | 無場景：與 `map` 同一元件，Google Maps 的 browser key 限制允許網址，localhost 一律 RefererNotAllowedMapError，場景只能拍到「地圖暫停服務」錯誤態，不是單點地圖的真實畫面；只能以真機或允許的網址取證 |
| `print` | 已取證 | [`trip-print`](2026-11-04-hig-web-screenshots/mobile/light/trip-print.png) | — |
| `edit` | 已取證 | [`trip-edit`](2026-11-04-hig-web-screenshots/mobile/light/trip-edit.png) | — |
| `stop/:entryId/copy` | 已取證 | [`trip-stop-copy`](2026-11-04-hig-web-screenshots/mobile/light/trip-stop-copy.png) | — |
| `stop/:entryId/move` | 已取證 | [`trip-stop-move`](2026-11-04-hig-web-screenshots/mobile/light/trip-stop-move.png) | — |
| `stop/:entryId/change-poi` | 已取證 | [`trip-stop-change-poi`](2026-11-04-hig-web-screenshots/mobile/light/trip-stop-change-poi.png) | 只有初始空搜尋態 |
| `stop/:entryId/edit` | 已取證 | [`trip-stop-edit`](2026-11-04-hig-web-screenshots/mobile/light/trip-stop-edit.png) | — |
| `add-stop` | 已取證 | [`trip-add-stop`](2026-11-04-hig-web-screenshots/mobile/light/trip-add-stop.png) | — |
| `add-entry` | 已取證 | [`trip-add-entry`](2026-11-04-hig-web-screenshots/mobile/light/trip-add-entry.png) | — |
| `collab` | 已取證 | [`trip-collab`](2026-11-04-hig-web-screenshots/mobile/light/trip-collab.png) | — |
| `health` | 已取證 | [`trip-health`](2026-11-04-hig-web-screenshots/mobile/light/trip-health.png) | — |
| `notes` | 已取證 | [`trip-notes`](2026-11-04-hig-web-screenshots/mobile/light/trip-notes.png) | — |
| `add-custom-stop` | 已取證 | [`trip-add-custom-stop`](2026-11-04-hig-web-screenshots/mobile/light/trip-add-custom-stop.png) | 只有手機寬；地圖位置區是錯誤態 |
| `*` | 已排除 | — | 純轉址，不是畫面 |

### 彈出層

| 彈出層元件 | 狀態 | 場景（連到手機寬淺色截圖） | 說明／缺口原因 |
|---|---|---|---|
| `AccountSheet` | 已取證 | [`popup-account-sheet`](2026-11-04-hig-web-screenshots/mobile/light/popup-account-sheet.png) | — |
| `AiConsentSheet` | 已取證 | [`popup-ai-consent-sheet`](2026-11-04-hig-web-screenshots/mobile/light/popup-ai-consent-sheet.png) | — |
| `AiDataConsentSheet` | 已取證 | [`popup-ai-data-consent-sheet`](2026-11-04-hig-web-screenshots/mobile/light/popup-ai-data-consent-sheet.png) | — |
| `TripPickerPopover` | 缺口 | — | 無：元件沒有任何掛載點（`src/` 內只有它自己的檔案與測試引用；`ExplorePage` 只剩註解、`TripsListPage` 剩一組無人使用的 `tripPickerOpen` state），使用者走不到，造不出真實狀態 |
| `ShareLinkModal` | 已取證 | [`popup-share-link-modal`](2026-11-04-hig-web-screenshots/mobile/light/popup-share-link-modal.png) | — |
| `ConfirmModal` | 已取證 | [`popup-confirm-modal`](2026-11-04-hig-web-screenshots/mobile/light/popup-confirm-modal.png) | — |
| `ConflictModal` | 已取證 | [`popup-conflict-modal`](2026-11-04-hig-web-screenshots/mobile/light/popup-conflict-modal.png) | — |
| `InputModal` | 已取證 | [`popup-input-modal`](2026-11-04-hig-web-screenshots/mobile/light/popup-input-modal.png) | — |
| `NoteAiExclusionsDialog` | 已取證 | [`popup-note-ai-exclusions-dialog`](2026-11-04-hig-web-screenshots/mobile/light/popup-note-ai-exclusions-dialog.png) | — |
| `CollabSheet` | 缺口 | — | 無：唯一掛載點是 `TripPage` 內的 `<InfoSheet open={activeSheet === 'collab'}>`，而 `activeSheet` 只會被 `TripPageHandle.openSheet()` 設定，全 `src/` 沒有任何呼叫端；`?sheet=collab` 會直接轉址到 `/trip/:id/collab` 頁。使用者走不到 |
| `InfoSheet` | 缺口 | — | 無：同上，唯一掛載點與 CollabSheet 相同，沒有入口；造不出真實狀態 |
| `TravelPillDialog` | 已取證 | [`popup-travel-pill-dialog`](2026-11-04-hig-web-screenshots/mobile/light/popup-travel-pill-dialog.png) | — |
| `TripSheet / TripSheetTabs` | 已取證 | [`popup-trip-sheet`](2026-11-04-hig-web-screenshots/desktop/light/popup-trip-sheet.png) | 僅桌機寬 |
| `TripCardMenu` | 已取證 | [`popup-trip-card-menu`](2026-11-04-hig-web-screenshots/mobile/light/popup-trip-card-menu.png) | — |
| `TripActionsMenu` | 已取證 | [`popup-trip-actions-menu`](2026-11-04-hig-web-screenshots/mobile/light/popup-trip-actions-menu.png) | — |
| `RailRowMenu` | 已取證 | [`popup-rail-row-menu`](2026-11-04-hig-web-screenshots/mobile/light/popup-rail-row-menu.png) | — |
| `TripSelect` | 已取證 | [`popup-trip-select`](2026-11-04-hig-web-screenshots/mobile/light/popup-trip-select.png) | — |
| `TripDatePicker` | 已取證 | [`popup-trip-date-picker`](2026-11-04-hig-web-screenshots/mobile/light/popup-trip-date-picker.png) | — |
| `TripTimePicker` | 已取證 | [`popup-trip-time-picker`](2026-11-04-hig-web-screenshots/mobile/light/popup-trip-time-picker.png) | — |
| `ErrorBanner` | 已取證 | [`popup-error-banner`](2026-11-04-hig-web-screenshots/mobile/light/popup-error-banner.png)、[`login-error`](2026-11-04-hig-web-screenshots/mobile/light/login-error.png)、[`trips-list-error`](2026-11-04-hig-web-screenshots/mobile/light/trips-list-error.png) | — |
| `ServerStatusBanner` | 已取證 | [`popup-server-status-banner`](2026-11-04-hig-web-screenshots/mobile/light/popup-server-status-banner.png) | — |
| `Toast` | 已取證 | [`popup-toast-error`](2026-11-04-hig-web-screenshots/mobile/light/popup-toast-error.png)、[`popup-toast-online`](2026-11-04-hig-web-screenshots/mobile/light/popup-toast-online.png) | — |

## HIG 結論的一手來源標註

| 條目 | 內容 | 一手來源 | 備註 |
|---|---|---|---|
| A1 | 觸控目標 44 pt（App） | **有**：Apple HIG accessibility 頁 | web 套用 44px 是**專案自訂標準**；WCAG 2.5.8（AA）只要求 24 CSS px，2.5.5（AAA）才是 44 |
| B、B7 | 字級、文字放大與重排 | **有**：HIG typography（App）；WCAG 1.4.4、1.4.10（web） | web 的 HIG 數值（17／11 pt）是類推 |
| C、C5 | 文字對比 | **有**：WCAG 1.4.3（web）；HIG accessibility／dark-mode（App） | |
| D12 | Modal 標題與關閉方式 | **有**：HIG modality（App）；APG dialog-modal（web，D16） | 套到 web 是類推 |
| E1、E4 | 按鈕 press state、標籤 | **有**：HIG buttons（App） | 套到 web 是類推；E5 的 web 依據是 APG button |
| F | 欄位標籤、密碼 | **部分**：HIG text-fields 有；`passwords` 專頁 404，**無一手來源** | 密碼與 Autofill 只有 managing-accounts 一句 |
| G2 | Alert 結構 | **有**：HIG alerts（App） | web 對話框依據是 APG alertdialog（G9） |
| G6、G7 | 錯誤說明、狀態就近呈現 | **有**：HIG feedback（App）；WCAG 3.3.1、4.1.3（web，G8） | |
| G10 | 空狀態 | **無一手來源**：`empty-states`、`error-handling` 兩個 slug 404 | 逐場景表中標 G10 的結論只是看圖，不是 HIG 規定 |
| H、H2 | 深色模式 | **有**：HIG dark-mode（App） | HIG 不談 web，web 深色屬類推 |
| WCAG 2.5.3、4.1.2、3.3.1、3.1.2、1.4.3、1.4.10 | web 無障礙條文 | **有**：W3C WCAG 2.2 原文 | 部分條文不在 flutter 檢查表內，本輪**沒有重新逐條核對條文** |
| 版面、外觀、互動、資料呈現、流程、場景限制、視覺一致、標題層級 | 看圖、程式碼、DESIGN.md 判讀 | **無一手來源** | 不是 HIG 條文，只是觀察；發現 15 的「規範」指專案 DESIGN.md |

說明：條目編號沿用 flutter repo 的 `docs/research/2026-11-04-hig-screen-checklist.md`（2026-11-04 該檔逐頁 curl 過 HIG 與 W3C 網址、皆 200；`navigation-bars`、`passwords`、`empty-states`、`error-handling` 為 404）。**本輪沒有重新查 Apple 一手文件**，標註沿用該檢查表；找不到一手來源的明標「無一手來源」，不以二手整理代替。HIG 只談 Apple 平台，web 的檢查依據是 WCAG 2.2 與 WAI-ARIA APG，HIG 的數值套到 web 都是專案自訂標準。

## 場景索引

場景總數：**80**（60 個頁面與狀態、20 個彈出層），截圖共 **316** 張。

| 場景 | 類型 | 截圖數 | 截圖（手淺／手深／桌淺／桌深） | 對應清單項目 |
|---|---|---|---|---|
| `landing` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/landing.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/landing.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/landing.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/landing.png) | 路由 `/` |
| `login` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/login.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/login.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/login.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/login.png) | 路由 `/login` |
| `signup` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/signup.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/signup.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/signup.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/signup.png) | 路由 `/signup` |
| `forgot-password` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/forgot-password.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/forgot-password.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/forgot-password.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/forgot-password.png) | 路由 `/login/forgot` |
| `privacy` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/privacy.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/privacy.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/privacy.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/privacy.png) | 路由 `/privacy` |
| `trips-list` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trips-list.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trips-list.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trips-list.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trips-list.png) | 路由 `/trips` |
| `trips-new` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trips-new.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trips-new.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trips-new.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trips-new.png) | 路由 `/trips/new` |
| `explore` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/explore.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/explore.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/explore.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/explore.png) | 路由 `/explore` |
| `favorites` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/favorites.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/favorites.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/favorites.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/favorites.png) | 路由 `/favorites` |
| `chat` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/chat.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/chat.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/chat.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/chat.png) | 路由 `/chat` |
| `map` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/map.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/map.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/map.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/map.png) | 路由 `/map` |
| `account` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/account.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/account.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/account.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/account.png) | 路由 `/account` |
| `account-appearance` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/account-appearance.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/account-appearance.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/account-appearance.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/account-appearance.png) | 路由 `/account/appearance` |
| `account-notifications` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/account-notifications.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/account-notifications.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/account-notifications.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/account-notifications.png) | 路由 `/account/notifications` |
| `account-sessions` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/account-sessions.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/account-sessions.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/account-sessions.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/account-sessions.png) | 路由 `/account/sessions` |
| `account-connected-apps` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/account-connected-apps.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/account-connected-apps.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/account-connected-apps.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/account-connected-apps.png) | 路由 `/account/connected-apps` |
| `developer-apps` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/developer-apps.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/developer-apps.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/developer-apps.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/developer-apps.png) | 路由 `/developer/apps` |
| `developer-apps-new` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/developer-apps-new.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/developer-apps-new.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/developer-apps-new.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/developer-apps-new.png) | 路由 `/developer/apps/new` |
| `change-password` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/change-password.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/change-password.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/change-password.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/change-password.png) | 路由 `/account/password` |
| `change-password-current-invalid` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/change-password-current-invalid.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/change-password-current-invalid.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/change-password-current-invalid.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/change-password-current-invalid.png) | 路由 `/account/password` |
| `change-password-too-short` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/change-password-too-short.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/change-password-too-short.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/change-password-too-short.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/change-password-too-short.png) | 路由 `/account/password` |
| `change-password-same` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/change-password-same.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/change-password-same.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/change-password-same.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/change-password-same.png) | 路由 `/account/password` |
| `change-password-rate-limited` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/change-password-rate-limited.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/change-password-rate-limited.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/change-password-rate-limited.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/change-password-rate-limited.png) | 路由 `/account/password` |
| `change-password-success` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/change-password-success.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/change-password-success.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/change-password-success.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/change-password-success.png) | 路由 `/account/password` |
| `oauth-authorize` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/oauth-authorize.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/oauth-authorize.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/oauth-authorize.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/oauth-authorize.png) | 路由 `/oauth/authorize` |
| `oauth-authorize-scopes` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/oauth-authorize-scopes.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/oauth-authorize-scopes.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/oauth-authorize-scopes.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/oauth-authorize-scopes.png) | 路由 `/oauth/authorize` |
| `oauth-authorize-login` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/oauth-authorize-login.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/oauth-authorize-login.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/oauth-authorize-login.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/oauth-authorize-login.png) | 路由 `/oauth/authorize` |
| `oauth-authorize-login-error` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/oauth-authorize-login-error.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/oauth-authorize-login-error.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/oauth-authorize-login-error.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/oauth-authorize-login-error.png) | 路由 `/oauth/authorize` |
| `oauth-authorize-error` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/oauth-authorize-error.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/oauth-authorize-error.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/oauth-authorize-error.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/oauth-authorize-error.png) | 路由 `/oauth/authorize` |
| `oauth-consent` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/oauth-consent.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/oauth-consent.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/oauth-consent.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/oauth-consent.png) | 路由 `/oauth/consent` |
| `oauth-consent-unknown-scope` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/oauth-consent-unknown-scope.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/oauth-consent-unknown-scope.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/oauth-consent-unknown-scope.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/oauth-consent-unknown-scope.png) | 路由 `/oauth/consent` |
| `oauth-consent-error` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/oauth-consent-error.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/oauth-consent-error.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/oauth-consent-error.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/oauth-consent-error.png) | 路由 `/oauth/consent` |
| `auth-callback` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/auth-callback.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/auth-callback.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/auth-callback.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/auth-callback.png) | 路由 `/auth/callback` |
| `trip-detail` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trip-detail.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trip-detail.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trip-detail.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trip-detail.png) | 路由 `/trip/:tripId` |
| `trip-map` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trip-map.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trip-map.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trip-map.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trip-map.png) | 路由 `map` |
| `trip-notes` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trip-notes.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trip-notes.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trip-notes.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trip-notes.png) | 路由 `notes` |
| `trip-print` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trip-print.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trip-print.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trip-print.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trip-print.png) | 路由 `print` |
| `trip-collab` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trip-collab.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trip-collab.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trip-collab.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trip-collab.png) | 路由 `collab` |
| `trip-health` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trip-health.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trip-health.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trip-health.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trip-health.png) | 路由 `health` |
| `trip-edit` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trip-edit.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trip-edit.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trip-edit.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trip-edit.png) | 路由 `edit` |
| `trip-add-stop` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trip-add-stop.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trip-add-stop.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trip-add-stop.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trip-add-stop.png) | 路由 `add-stop` |
| `trip-add-entry` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trip-add-entry.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trip-add-entry.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trip-add-entry.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trip-add-entry.png) | 路由 `add-entry` |
| `login-error` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/login-error.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/login-error.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/login-error.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/login-error.png) | 路由 `/login` |
| `login-rate-limited` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/login-rate-limited.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/login-rate-limited.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/login-rate-limited.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/login-rate-limited.png) | 路由 `/login` |
| `signup-check-email` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/signup-check-email.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/signup-check-email.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/signup-check-email.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/signup-check-email.png) | 路由 `/signup/check-email` |
| `reset-password` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/reset-password.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/reset-password.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/reset-password.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/reset-password.png) | 路由 `/auth/password/reset` |
| `verify-email` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/verify-email.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/verify-email.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/verify-email.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/verify-email.png) | 路由 `/auth/verify-email` |
| `invite` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/invite.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/invite.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/invite.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/invite.png) | 路由 `/invite` |
| `invite-invalid` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/invite-invalid.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/invite-invalid.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/invite-invalid.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/invite-invalid.png) | 路由 `/invite` |
| `trips-list-empty` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trips-list-empty.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trips-list-empty.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trips-list-empty.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trips-list-empty.png) | 路由 `/trips` |
| `trips-list-error` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trips-list-error.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trips-list-error.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trips-list-error.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trips-list-error.png) | 路由 `/trips` |
| `trip-share` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trip-share.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trip-share.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trip-share.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trip-share.png) | 路由 `/s/:token` |
| `trip-stop-copy` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trip-stop-copy.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trip-stop-copy.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trip-stop-copy.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trip-stop-copy.png) | 路由 `stop/:entryId/copy` |
| `trip-stop-move` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trip-stop-move.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trip-stop-move.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trip-stop-move.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trip-stop-move.png) | 路由 `stop/:entryId/move` |
| `trip-stop-change-poi` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trip-stop-change-poi.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trip-stop-change-poi.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trip-stop-change-poi.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trip-stop-change-poi.png) | 路由 `stop/:entryId/change-poi` |
| `trip-stop-edit` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trip-stop-edit.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trip-stop-edit.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/trip-stop-edit.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/trip-stop-edit.png) | 路由 `stop/:entryId/edit` |
| `trip-add-custom-stop` | 頁面／狀態 | 2 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/trip-add-custom-stop.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/trip-add-custom-stop.png) | 路由 `add-custom-stop` |
| `popup-account-sheet` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-account-sheet.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-account-sheet.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-account-sheet.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-account-sheet.png) | 彈出層 AccountSheet |
| `popup-ai-consent-sheet` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-ai-consent-sheet.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-ai-consent-sheet.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-ai-consent-sheet.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-ai-consent-sheet.png) | 彈出層 AiConsentSheet |
| `popup-ai-data-consent-sheet` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-ai-data-consent-sheet.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-ai-data-consent-sheet.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-ai-data-consent-sheet.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-ai-data-consent-sheet.png) | 彈出層 AiDataConsentSheet |
| `popup-share-link-modal` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-share-link-modal.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-share-link-modal.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-share-link-modal.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-share-link-modal.png) | 彈出層 ShareLinkModal |
| `popup-confirm-modal` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-confirm-modal.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-confirm-modal.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-confirm-modal.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-confirm-modal.png) | 彈出層 ConfirmModal |
| `popup-conflict-modal` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-conflict-modal.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-conflict-modal.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-conflict-modal.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-conflict-modal.png) | 路由 `/favorites/:id/add-to-trip` |
| `popup-input-modal` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-input-modal.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-input-modal.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-input-modal.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-input-modal.png) | 彈出層 InputModal |
| `popup-note-ai-exclusions-dialog` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-note-ai-exclusions-dialog.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-note-ai-exclusions-dialog.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-note-ai-exclusions-dialog.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-note-ai-exclusions-dialog.png) | 彈出層 NoteAiExclusionsDialog |
| `popup-travel-pill-dialog` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-travel-pill-dialog.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-travel-pill-dialog.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-travel-pill-dialog.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-travel-pill-dialog.png) | 彈出層 TravelPillDialog |
| `popup-trip-sheet` | 彈出層 | 2 | [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-trip-sheet.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-trip-sheet.png) | 彈出層 TripSheet / TripSheetTabs |
| `popup-error-banner` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-error-banner.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-error-banner.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-error-banner.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-error-banner.png) | 彈出層 ErrorBanner |
| `popup-server-status-banner` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-server-status-banner.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-server-status-banner.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-server-status-banner.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-server-status-banner.png) | 彈出層 ServerStatusBanner |
| `popup-toast-error` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-toast-error.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-toast-error.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-toast-error.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-toast-error.png) | 彈出層 Toast |
| `popup-toast-online` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-toast-online.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-toast-online.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-toast-online.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-toast-online.png) | 彈出層 Toast |
| `add-to-trip` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/add-to-trip.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/add-to-trip.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/add-to-trip.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/add-to-trip.png) | 路由 `/add-to-trip` |
| `favorite-add-to-trip` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/favorite-add-to-trip.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/favorite-add-to-trip.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/favorite-add-to-trip.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/favorite-add-to-trip.png) | 路由 `/favorites/:id/add-to-trip` |
| `favorites-list` | 頁面／狀態 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/favorites-list.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/favorites-list.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/favorites-list.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/favorites-list.png) | 路由 `/favorites` |
| `popup-trip-card-menu` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-trip-card-menu.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-trip-card-menu.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-trip-card-menu.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-trip-card-menu.png) | 彈出層 TripCardMenu |
| `popup-trip-actions-menu` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-trip-actions-menu.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-trip-actions-menu.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-trip-actions-menu.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-trip-actions-menu.png) | 彈出層 TripActionsMenu |
| `popup-rail-row-menu` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-rail-row-menu.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-rail-row-menu.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-rail-row-menu.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-rail-row-menu.png) | 彈出層 RailRowMenu |
| `popup-trip-select` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-trip-select.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-trip-select.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-trip-select.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-trip-select.png) | 彈出層 TripSelect |
| `popup-trip-date-picker` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-trip-date-picker.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-trip-date-picker.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-trip-date-picker.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-trip-date-picker.png) | 彈出層 TripDatePicker |
| `popup-trip-time-picker` | 彈出層 | 4 | [手淺](2026-11-04-hig-web-screenshots/mobile/light/popup-trip-time-picker.png) [手深](2026-11-04-hig-web-screenshots/mobile/dark/popup-trip-time-picker.png) [桌淺](2026-11-04-hig-web-screenshots/desktop/light/popup-trip-time-picker.png) [桌深](2026-11-04-hig-web-screenshots/desktop/dark/popup-trip-time-picker.png) | 彈出層 TripTimePicker |
