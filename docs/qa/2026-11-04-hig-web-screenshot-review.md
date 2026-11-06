# web 截圖逐張檢查報告（flutter#531／trip-planner#1568 素材）

檢查日期：2026-11-04。對象：[`2026-11-04-hig-web-screenshots/`](2026-11-04-hig-web-screenshots/) 的 50 個場景（原 27 個、第三輪補的 9 個認證流程／邀請／清單空與錯誤態，加第四輪補的 14 個彈出層場景），手機寬（390×844）與桌機寬（1280×800）、淺色與深色，共 198 張（`popup-trip-sheet` 只有桌機寬，其餘各 4 張）。依據：flutter repo 的 `docs/research/2026-11-04-hig-screen-checklist.md`。web 條目的依據是 WCAG 2.2 與 WAI-ARIA APG；HIG 只談 Apple 平台，套到 web 的數值（如 44）是專案自訂標準。

## 怎麼檢查的

把每個場景同一寬度下的淺色與深色拼成一張並排圖，由我逐張目視（第四輪的彈出層場景改為逐張個別開啟檢視，沒有拼圖）。**沒有自動量測對比或字級**；觸控目標另由 `tests/e2e/hig-scenes.spec.js` 的棘輪守門，本報告不重複。

## 範圍與沒看到的

- 桌機寬：27 個場景的淺深並排圖都看過。
- 手機寬：27 個場景的淺深並排圖都看過（第一輪 15 個，第二輪補看 12 個）。
- **第三輪補的 9 個場景**（`login-error`、`login-rate-limited`、`signup-check-email`、`reset-password`、`verify-email`、`invite`、`invite-invalid`、`trips-list-empty`、`trips-list-error`）：**手機寬淺深都看過；桌機寬的 18 張新圖我沒有逐張看**，只有 proof（畫面上一定出現的文字或 testid）與 axe 掃描。
- **第四輪補的 14 個彈出層場景**（`popup-*`）：手機寬淺深 13 個都個別看過（`popup-trip-sheet` 沒有手機寬）；桌機寬淺色看過 14 個、深色只看了 `popup-trip-sheet`，**其餘 13 個場景的桌機寬深色圖沒有逐張看**，只有 proof 與棘輪。圖是在 Linux 容器（Playwright v1.64.1 noble）截的，前 36 個場景不是本輪重截，截圖環境未重新確認，字型可能不同；Linux 的無頭 Chromium 會畫出傳統捲軸，圖右緣常有約 10px 的窄條，那是環境產物，不是產品問題。
- 只跑 chromium；webkit、firefox 沒截。

## 需要處理的發現

| # | 場景 | 條目 | 發現 | 證據強度 |
|---|---|---|---|---|
| 1 | `account-sessions`、`account-connected-apps`、`developer-apps` | 版面 | 頁面上方小標（帳號／設定／開發者後台）被固定頁首壓住而被裁切或重疊，桌機與手機都有 | 看圖 |
| 2 | `trip-detail` | E1 | 桌機右側地圖面板的錯誤態「重試」是未套樣式的原生灰色按鈕 | 看圖 |
| 3 | `trip-detail` | 版面 | 手機寬的移動方式膠囊（`13 min · 6.6 km · 從飯店開車 15 分鐘`）超出右緣被截斷 | 看圖 |
| 4 | `trip-map`、`map` | — | 場景擋掉 Google Maps，畫面是「地圖暫停服務」錯誤態，**不是真實地圖**；這兩個場景不能當地圖畫面的證據 | 看圖加 spec 原始碼（`maps.googleapis.com` 被 abort） |
| 5 | `explore` | — | 手機寬的篩選膠囊「Sight 1」與卡片類別「SIGHT」是未在地化的英文原值 | 看圖 |
| 6 | `trips-new` | B | 手機寬日期欄位「選擇日期」字級明顯大於同頁其他 placeholder | 看圖 |
| 7 | `trip-detail` | WCAG 2.5.3 | 9 個起訖時間 chip（`EntryTimeChip.tsx:140`）的 `aria-label="編輯起訖時間"` 蓋掉可見的時間文字（如 09:00–12:00），語音操控說出看得到的字會失敗 | axe 加程式碼 |
| 8 | `trips-new` | WCAG 2.5.3、ARIA | 出發／回程日期欄（`TripDatePicker`，`NewTripPage.tsx:817-`）：`aria-label` 與可見文字不一致；`aria-required` 加在不允許該屬性的角色上（axe：critical） | axe（TripDatePicker 內部未讀） |
| 9 | `trip-print` | C5 | 列印預覽分區的數量標籤 `#8a7a68`、11px，對比 4.14:1（`tripPrintStyles.ts:66`），低於 4.5:1 | axe 加程式碼 |

| 10 | `trips-list-error` | G6、G7 | 行程清單載入失敗只有一行「無法載入你的行程清單。」，**沒有重試**（程式碼確認：`TripsListPage` 的錯誤態沒有任何重試或重新載入動作）；使用者只能手動重新整理整頁 | 看圖加程式碼 |
| 11 | `signup-check-email`、`invite` | B7 | 以「320px 寬、html 字級 200%」近似量測，scrollWidth 為 354、366（對 320）；逐元素掃描找不到右緣超出的元素，**原因未定位**。這只是近似（不是瀏覽器縮放），是否構成 WCAG 1.4.10 違規仍待驗證 | 量測（未定位） |
| 12 | `popup-server-status-banner` | C（WCAG 1.4.3） | **深色**：橫幅文字色寫成 `var(--color-priority-high-text, #8b2828)`，但 `css/` 全無這個 token，永遠落到寫死的 `#8b2828`（`ServerStatusBanner.tsx:26`）；深色底（`rgba(232,160,160,.18)` 疊深色頁底，約 `#413435`）上對比 **1.37:1**，幾乎讀不到 | axe（serious）加看圖加程式碼 |
| 13 | `popup-server-status-banner` | 版面 | 橫幅是 `position: sticky; top: 0`，卻放在 100dvh 的 app-shell 之外，多佔 59px：手機寬離線前後量測 `scrollHeight` 844→903（視窗 844）、shell 上緣 0→59，整頁多出捲軸；桌機寬左側欄底部的使用者卡被擠出視窗下緣 | 量測（離線事件前後）加看圖 |
| 14 | `popup-toast-offline` | G7 | 離線時同時有三個提示：全域橫幅（z-index 9999）、離線 Toast（z-index 250，被橫幅蓋住一半，文字疊在一起）、行程頁自己的「目前是離線模式」卡片。橫幅在場時，Toast 等於看不到 | 看圖（手機寬、桌機寬） |
| 15 | `popup-toast-error` | 版面、規範 | Toast 固定在視窗頂端（`top: max(16px, safe-area)`，`tokens.css:238`），手機寬蓋住 TitleBar 的標題與返回鈕；DESIGN.md「Error & Status Messaging」寫的是桌機右上 titlebar 下方、compact 底部且高於 bottom nav，實作與規範不一致 | 看圖加 DESIGN.md |
| 16 | `popup-toast-error` | G6、WCAG 3.3.1 | 探索頁搜尋少於 2 字，只出現 2 秒的 error Toast「至少輸入 2 個字」；欄位本身沒有錯誤文字，Toast 消失後沒有任何殘留提示（DESIGN.md：欄位格式錯用 FieldError）。另外 Toast 同時設 `role="alert"` 與 `aria-live="polite"`（`Toast.tsx:100-101`），兩者語意互相矛盾（alert 隱含 assertive） | 看圖加程式碼 |
| 17 | `popup-conflict-modal` | G2、G7 | 對話框問「要怎麼處理？」，元件也支援「改插入到後面」「取代既有」，但呼叫端 `AddPoiFavoriteToTripPage.tsx:561` 只傳 `onCancel`，畫面上只有一顆「取消」：文案承諾的選項不存在，使用者無法在對話框內處理衝突，只能關掉後自己改時間 | 看圖加程式碼 |
| 18 | `popup-share-link-modal` | WCAG 2.5.3、4.1.2 | 同一個對話框內有兩個可存取名稱都是「關閉」的按鈕，動作卻不同：標題列 ✕（關閉對話框，`ShareLinkModal.tsx:313`）與連結卡的「關閉」（停用該連結，`:458`）。螢幕閱讀器與語音控制說「關閉」無法區分，且後者影響較大 | 程式碼加看圖 |
| 19 | `popup-share-link-modal` | 版面 | 手機寬的「有效期限」分段控制（永久／24 小時／7 天／30 天／自訂）折成兩列，第二列只有「自訂」，右側留空白格，像是漏了選項 | 看圖 |
| 20 | `popup-share-link-modal`、`popup-account-sheet`、`popup-trip-sheet` | A1 | 彈出層內觸控目標 < 44（只量彈出層本身，Linux）：分享對話框 18 項（✕ 27×27、區塊 pill 與期限分段高 34、匿名勾選 17×17、連結名稱輸入高 34、建立分享連結高 42、編輯／重新產生／關閉／刪除高 34）；帳號 sheet「編輯名稱」32×32；TripSheet 聊天建議 chip 高 39、送出 40×40。有可點擊元素的 10 個彈出層中，其餘 7 個（AI 授權、AI 資料同意、確認、衝突、輸入、排除項目、交通方式）全部 ≥ 44 | 量測 |
| 21 | `popup-note-ai-exclusions-dialog`（背景頁 `trip-notes`） | WCAG 4.1.2 | axe `nested-interactive`（serious）：筆記區塊標題列是 `div[role=button]`，展開後內含 AI 的 `<button>`。先前 `trip-notes` 場景手機寬只展開第一區（航班，沒有 AI 鈕）所以沒掃到；桌機寬各區預設全展開就會出現。違規在彈出層背後的頁面，不是對話框本身 | axe 加程式碼 |
| 22 | `popup-ai-consent-sheet` 等 | 標題層級 | 彈出層標題層級不一致：AI 授權 sheet 用 `h4`、AI 資料同意與確認類用 `h2`、交通方式用 `h3`（觀察，不影響功能） | 程式碼 |
| 23 | `popup-travel-pill-dialog` | E4 | 交通方式八個模式中，單軌、地鐵、火車、高鐵的圖示看起來相同，只能靠文字分辨（圖示小，判讀有限） | 看圖 |
| 24 | `popup-error-banner` | G6、DESIGN.md 文案規則 | 「登出此裝置失敗，請稍後再試。」說了發生什麼，但沒有重試動作，也沒說明該裝置是否仍登入（文案規則三問缺一）；橫幅與上方清單卡的間距只有幾 px，下方卻是 16px | 看圖 |
| 25 | `TripPickerPopover`、`CollabSheet`、`InfoSheet` | — | 三個元件沒有任何使用者走得到的入口（死碼，見下「彈出層缺口」），所以無法取證；已另開 PR #1584 移除 | 程式碼（grep 全 `src/`） |
| 70 | `trip-add-custom-stop` | 版面、表單一致性 | 「地址或地標」輸入框（`#cs-address`）套的 `.tp-custom-stop-input` 在 CSS 裡已沒有規則（`AddCustomStopPage.tsx:147` 註解寫明 v2.33.22 移除），畫面上是原生樣式：253×26、沒有內距與圓角，和上方「標題」輸入框（高約 50）明顯不同。淺深色都看得到 | 看圖加程式碼（grep 無規則） |
| 71 | `trip-add-custom-stop` | 版面 | 手機寬的全頁表單底部被浮動的主導覽列（聊天／行程／地圖／收藏）蓋住，「備註」欄標題被遮；表單捲到底之前這段是不可用的（捲到底後是否讓出空間沒有驗證） | 看圖（只看第一屏） |
| 72 | `trip-add-custom-stop` | 場景限制 | 「位置」區是紅色錯誤文字「無法載入地圖，位置尚未選定」：Google Maps 被擋（見發現 4），拍不到真實的選位地圖，也就無法檢查地圖選位的觸控與手勢。列為缺口 | 看圖加 spec 原始碼 |
| 73 | `trip-share` | A1 | 動作列「列印」「存成 PDF」44×38、「複製到我的行程」248×38，高度都 < 44（Linux 量測） | 量測 |
| 74 | `trip-share` | 外觀（觀察） | 公開分享頁固定淺色，深色模式不翻轉（`tripPrintStyles.ts:19、107` 註解寫明刻意）：深色下整頁仍是米色底與白紙，只有視窗最上緣約 18px 露出 body 的深色底，看起來像漏出的色帶。手機寬文件內文左側縮排約 52px，吃掉約七分之一的閱讀寬度 | 看圖加程式碼 |
| 75 | `trip-share`、`trip-print` | 資料呈現 | 副標顯示成 `2026-07-01 · ["JP"] · 1 天`：沒有 destinations 時 `mapRawToPrintData` 直接用 `meta.countries` 原字串（`tripPrintData.ts:225`），而它是 JSON 字串。**是否在真實資料出現沒有驗證**（mock 的 destinations 是空陣列）；另 mock 的停留點沒有起訖時間，所以時間欄全是「—」，那是 fixture 限制，不是產品問題 | 看圖加程式碼（真實資料未驗） |
| 76 | `trip-stop-edit` | A1 | 景點與備選的「分類：景點／餐廳，點擊更改」chip 78×28，高度 < 44 | 量測 |
| 77 | `trip-stop-change-poi` | A1 | 「全部地區」地區膠囊 92×27，高度 < 44（與 `trip-add-stop` 同一元件、同一數值） | 量測 |
| 78 | `trip-stop-copy`、`trip-stop-move`、`trip-stop-change-poi`、`trip-stop-edit`、`trip-add-entry`、`trip-add-stop`、`trip-edit`、`trip-notes`、`trip-collab`、`trip-health`（桌機寬深色） | 外觀 | 桌機右側堆疊面板（`TripStackLayout`）在深色下底色約 #3a3a3a，比左側中欄（約 #222）還亮，面板內的卡片又比面板暗，層次與一般「越靠前越亮」的 elevation 相反；面板左右緣各有一條約 1px 的亮線（x≈743、1269）。淺色沒有這個問題。屬觀察，需設計判斷 | 看圖（10 個場景一致） |
| 79 | `trip-print`（桌機寬深色） | 外觀（觀察） | 列印預覽整頁（米色工具列、底色、白紙）在深色下不翻轉；紙張固定白合理，但工具列與背景也不翻轉，在深色環境下刺眼 | 看圖 |
| 80 | `trip-edit`（桌機寬） | 流程（疑慮，待確認） | 底部列只有草稿／上線切換與「返回」，沒有「儲存」或「完成」；是否即時儲存、離開時是否提示，截圖看不出，沒有驗證 | 看圖（行為未驗） |

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
| `invite` | 手機已看、桌機未看 | 未見明顯問題 | — | 「註冊並加入」為主要、「登入並加入」為次要，說明與有效期齊全；axe 無違規。**200% 文字有橫向捲動（發現 11）** |
| `invite-invalid` | 手機已看、桌機未看 | 未見明顯問題 | G6 | 410＋`INVITATION_INVALID`（真實契約）：錯誤橫幅加「請聯絡邀請者重寄一份新的邀請連結」，沒有無意義的重試。觀察：橫幅文字折行剩孤字「寄」，且同一句話在橫幅與下方各出現一次。**注意**：這個場景一開始用了不存在的錯誤碼，拍到不真實的畫面，曾因此誤報一項發現，已撤回並重拍 |
| `login-error` | 手機已看、桌機未看 | 符合 | G6 | 就地橫幅（圖示加文字）「電子郵件或密碼錯誤」，輸入保留；axe 無違規；「忘記密碼？」64×19 為既有違規 |
| `login-rate-limited` | 手機已看、桌機未看 | 符合 | G6 | 鎖頭圖示、說明、15:00 倒數與「重設密碼」出口；axe 無違規 |
| `reset-password` | 手機已看、桌機未看 | 符合 | F | 兩個密碼欄、強度條與規則清單（長度、字母與數字）；axe 無違規 |
| `signup-check-email` | 手機已看、桌機未看 | 疑慮 | B7 | 內容齊全（信箱、有效期、打開信箱、重寄倒數停用、改用其他信箱）；**200% 文字有橫向捲動（發現 11）** |
| `trips-list-empty` | 手機已看、桌機未看 | 符合 | G10 | 圖示、標題、說明與「新增行程」主要動作 |
| `trips-list-error` | 手機已看、桌機未看 | 疑慮 | G6、G7 | 見發現 10 |
| `verify-email` | 手機已看、桌機未看 | 未見明顯問題 | — | 說明與單一主要按鈕；axe 無違規；200% 文字檢查沒有生效（該頁字級不隨 root 變） |
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

`tests/e2e/hig-a11y-collect.spec.js`（收集用，`HIG_COLLECT=1` 才執行，否則 skip；場景清單與 mock 與截圖 spec 共用 `hig-scene-fixtures.js`）。27 個場景、chromium、共 135 筆輸出。

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
