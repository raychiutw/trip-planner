# Apple HIG 對 Tripline 網頁的適用規範研究

研究日期：2026-09-25（Asia/Taipei）。研究基線：`a26590a4cf4a00f6ac991cf783e7b263244aae60`。本文件是第一手規範研究與驗收準則，不把建議當成已驗證的產品缺陷，也不代表全站 WCAG 合規認證。

## 結論與適用邊界

Tripline 應採用 HIG 的清楚階層、穩定導覽、回饋、可讀性與可操作性；網頁的量測與語意則用 WCAG 2.2、HTML、WAI-ARIA。Apple 將 HIG 定位為 Apple 平台的設計指引，不能把 UIKit 元件、原生 point、SF 字體或 Liquid Glass 外观全部當成 React 網站的強制規格。[Apple HIG](https://developer.apple.com/design/human-interface-guidelines/)；[WCAG 2.2](https://www.w3.org/TR/WCAG22/)

專案規範另有待釐清的衝突：本次提供的 AGENTS.md 以 `DESIGN.md` 與 terracotta prototype 為 SoT；目前 `CLAUDE.md` 寫 HIG 為 SoT、DESIGN.md 為衍生。依此次指令優先序，報告應揭露衝突，不能以研究為由自行替換品牌或跳過 mockup sign-off。本文只提出改善標準。

## 1. 不要再把 44 寫成所有平台的最低規格

2026-09-25 透過 `/browse` 實際讀取 Apple Accessibility 的 Mobility 表格，iOS/iPadOS 現列 **Default control size 44×44 pt、Minimum control size 28×28 pt**；macOS 為 default 28×28 pt、minimum 20×20 pt。該頁變更紀錄最新列 2025-06-09，但未標示尺寸表單獨更新日期，因此不可推論表格何日修改。舊「HIG 一律最少 44×44」說法不符合本次看到的現行頁面。[Apple Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

| 性質 | 尺寸與單位 | Tripline 的使用方式 |
| --- | --- | --- |
| HIG 原生平台建議 | iOS/iPadOS default 44×44 **pt**；minimum 28×28 **pt** | 理解觸控舒適度，不做 point 與網頁 CSS px 的機械換算 |
| WCAG 2.2 AA 2.5.8 | 24×24 **CSS px**，有 spacing、equivalent、inline、user agent、essential 例外 | 評估實際 hit area、形狀及鄰近目標；不能只量圖示 |
| WCAG AAA 2.5.5 | 44×44 **CSS px**，另有規定例外 | 更高標準；不可宣稱這是 AA 的普遍門檻 |
| 本報告設計建議 | 主要觸控操作採至少 44×44 **CSS px** | 屬產品建議：關閉、更多、加入、日期、地圖控制優先；小於此值先分清舒適度問題與 AA 失敗 |

來源：[SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)、[SC 2.5.5](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced)。網頁 zoom 或高 DPI 不會把不足的 CSS hit area 自動變成合規。

## 2. 導覽與資訊架構

HIG tab bar 用於切換頂層區域，不應混入新增、送出等動作，並強調切換時維持區域的導覽狀態與穩定性。[Apple Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)

**對 Tripline 的建議與驗收：**

- 聊天／行程／地圖／收藏使用一致、可辨識的標籤和目前位置指示；帳號入口與頁面導覽分工清楚。
- 路由跳轉優先使用連結；同頁 panel 切換才考慮真正的 ARIA tabs，不能只因外觀像 tab bar 就套 `role=tab`。ARIA 元件仍需要實作相應鍵盤行為，原生 HTML 應優先使用。[WAI Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- 實測瀏覽器上一頁／下一頁、重整、deep link、切回原頁的選中日期與捲動位置；這是本報告提出的網頁驗收方式，不是 HIG 指定 React router 實作。
- 空集合不任意移除頂層入口；頁內說明如何開始。主要 CTA 用具體動詞，例如「建立行程」，避免不明的「繼續」。[Apple Writing](https://developer.apple.com/design/human-interface-guidelines/writing)

## 3. Sheet、Dialog 與關閉行為

HIG sheet 適合當前情境中的有限任務；Cancel/Close、Done、Back 具有不同意義，未儲存修改的關閉需要避免意外丟失。HIG 同時存在 modal 與 nonmodal sheet，不能看到底部抽屜就假定它必須鎖住背景。[Apple Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)

**網頁驗收：** modal 開啟後焦點進入、Tab 留在內部、Escape 可關閉、背景不可互動、關閉回到觸發點或合適的後續位置，並有 accessible name。長內容初始焦點宜讓標題和內容起點可見；不是一律強制第一個輸入框。[WAI Modal Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

優先檢查既有共用 overlay 是否已處理以上行為；若需改造，可評估原生 `<dialog>.showModal()`，不要為每個 sheet 重寫 focus trap。原生 dialog 提供部分互動行為，但標題、關閉策略和未儲存資料保護仍需產品設計。[W3C H102](https://www.w3.org/WAI/WCAG22/Techniques/html/H102)

**Tripline 特別測項：**帳號、POI 詳情、收藏挑選、旅伴邀請、刪除確認；行動鍵盤開啟後送出與關閉仍可達；不把詳情卡與另一個 dialog 疊成無法預測的返回鏈。

## 4. 表單與輸入錯誤

HIG 提醒 placeholder 會在輸入後消失，獨立 label 可保留欄位意義；也建議減少重複輸入。[Apple Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields)、[Apple Entering data](https://developer.apple.com/design/human-interface-guidelines/entering-data)

**Tripline 建議：**搜尋、行程名稱、日期、邀請 email、AI 指令與備註都有持續可辨識的標籤；用適切的 HTML input type、autocomplete 與 inputmode；placeholder 只補範例。錯誤用文字指出欄位及原因，保留使用者已填的內容，必要時透過 `aria-describedby` 關联。只有紅框或按鈕不反應不夠。[WCAG 3.3.1](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)

驗收至少包含空白值、格式錯誤、日期區間錯誤、伺服器拒絕、慢速提交及重複按送出；這些是產品風險案例，並非聲稱 WCAG 規定特定測試框架。

## 5. 載入、成功、錯誤與復原

HIG 要求操作過程有可信的進度，已知進度用 determinate，未知才用 indeterminate；不能用虛構百分比掩蓋等待。[Apple Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators)

**Tripline 建議：**分開呈現「載入中／沒有資料／沒有搜尋結果／權限不足／載入失敗」。AI 串流中顯示正在進行的狀態，提供合理停止或重試；異步更新失敗保留草稿與已有內容。儲存、匯入及收藏成功可用非搶焦點狀態訊息；錯誤不要只存在短暫 toast。適用的 status message 應以角色或屬性讓輔助科技在不取得焦點下辨識，不要對每個串流字元 assertive 宣告。[WCAG 4.1.3](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)

## 6. 色彩、材質與字體

HIG 重視可讀性與非單一色彩傳意，品牌色不等於不可用；native semantic color 的自動適應不會自動套在任意 CSS 色碼上。[Apple Color](https://developer.apple.com/design/human-interface-guidelines/color)、[Apple Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

**量測基準：**WCAG 一般文字至少 4.5:1；large text 至少 3:1，large 是 18pt 或 14pt bold（CSS 通常相當於 24px／約 18.67px），不是把 Apple 字體表的門檻直接移植。必要的控制外觀與狀態、圖形對比另外依 1.4.11 判定；裝飾與 disabled 的例外需個別區分。[WCAG 2.2 1.4.3、1.4.11](https://www.w3.org/TR/WCAG22/#contrast-minimum)

**Tripline 建議：**量測 terracotta 按鈕文字、次要資訊、badge、選中日期、地圖浮層；同時檢查深色與淺色、hover/focus/error 狀態。刪除／成功／警告加文字或圖示，不只紅綠。玻璃材質必須在實際背景上仍清楚；沒有必要為了「像 Apple」替 timeline 全面加 blur。[Apple Materials](https://developer.apple.com/design/human-interface-guidelines/materials)

HIG 提倡可調字體與層級。[Apple Typography](https://developer.apple.com/design/human-interface-guidelines/typography) 網頁以 200% text resize 無內容或功能損失驗收，避免用固定高度裁掉中文、長地名或費用；Inter 可保留，另驗繁中 fallback。選擇 rem 只是實作手段，不是合規證明。[WCAG 1.4.4](https://www.w3.org/WAI/WCAG21/Understanding/resize-text)

## 7. 響應式、安全區與固定工具列

HIG 要求佈局適應環境變化並保有一致性。[Apple Layout](https://developer.apple.com/design/human-interface-guidelines/layout) 網頁應測 320 CSS px 等效窄寬的 reflow；真正需要二維佈局的地圖等有例外，但不能讓整頁或其旁邊表單一起免測。[WCAG 1.4.10](https://www.w3.org/WAI/WCAG21/Understanding/reflow)

**Tripline 驗收：**320、375、768、1024、1440 CSS px；200% 文字放大與 400% browser zoom 分開測；橫向、窄視窗、軟鍵盤、長內容、fixed bottom nav 與 sticky map 同時存在的情境。AA 2.4.11 要求焦點元件不被作者內容完全遮住；完全不遮擋是更高標準，不能混報。[WCAG 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum)

採用 edge-to-edge viewport 時，底部與側邊控制必須考慮 `env(safe-area-inset-*)`，而安全區不能取代正常內距。[WebKit 官方 safe area 說明](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) 此文是 2017 年機制來源，不是現行 Safari 全版本相容性驗證；仍需實機 Safari 與 PWA 分別驗收。

## 8. 地圖、手勢與行程排序

HIG maps 建議保有熟悉的縮放和平移，清楚呈現選中地點，適量聚合重疊 POI；資訊卡不應蓋住選中地點，地圖浮層需有足夠對比。[Apple Maps](https://developer.apple.com/design/human-interface-guidelines/maps)

Tripline 使用 Google Maps：上述互動原則可參考，Apple logo／MapKit attribution 細則不能套到 Google 地圖；本文不提議更換供應商。Google 品牌與 attribution 需另依該供應商規範檢查，不能拿 HIG 當授權證據。

**Tripline 建議：**地圖與行程列表共用可辨識的選中狀態；卡片保留地名、地址、時間與明確操作；滑動／拖曳之外可按上移、下移、移到日期，縮放可按按鈕，地圖失敗仍可讀列表。僅支援鍵盤排序不足以證明 2.5.7，還要有單一 pointer 不需拖曳的替代操作；例外須具體論證。[WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements)、[WCAG 2.5.1](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures)

## 9. 建議的跨頁驗收清單

以下是依上述來源形成的專案測試建議，不宣稱每一條均是 HIG 或 WCAG 原文要求。

| 頁面／場景 | 必驗行為 | 證據 |
| --- | --- | --- |
| 登入與 OAuth 返回 | 錯誤可理解、按鈕可鍵盤操作、重新嘗試保留目的頁 | 成功／拒絕／過期 session 的錄製與路由 |
| 行程列表／建立行程 | 空狀態清楚、卡片與 CTA 語意、日期錯誤不丟資料 | 320px、長標題、鍵盤建立流程 |
| 行程時間軸／詳情 | 日期選中非只色彩、可不用拖曳排序、失敗復原 | 鍵盤＋單擊排序、慢網路儲存 |
| 聊天／AI 行程 | 串流不搶焦點、停止／失敗／重試、草稿保留 | 串流狀態與 screen reader 人工驗證 |
| 地圖 | 卡片不遮 pin、控制命名、縮放替代、列表仍可使用 | 各 breakpoint 與地圖載入失敗 |
| 收藏／搜尋／POI | 搜尋狀態分明、空結果非錯誤、選中與加入回饋 | 無結果／已收藏／新增失敗 |
| 帳號／旅伴／權限 | 角色與允許操作清楚、邀請錯誤可修正、離開／刪除不誤按 | 不同權限與 modal focus trace |
| 全部 overlay | 名称、焦點、Escape、還原焦點、未儲存保護 | Tab 序列與長內容、軟鍵盤測試 |

優先修復不能操作、丟資料、焦點失控、看不到內容；再處理重複 UI 元件及 token drift；最後才調整材質和視覺細節。若涉及新頁或 layout 變更，遵守 repository mockup-first gate。

## 證據限制

- 本研究讀了 Apple 官方頁與 W3C／WebKit 第一手資料；Accessibility 尺寸表有 `/browse` live rendered text，其餘亦使用官方頁搜尋索引，索引可能較現行頁落後。引用的是 canonical URL；未假定搜尋引擎的 published 日期等同政策生效日。
- 本文件未對 Tripline 全部頁面進行操作、screen reader、實體 iPhone 或完整對比量測；上表是驗收清單，不是缺陷清單。實測結果應在主報告分開標注。
- WCAG Understanding、APG、Techniques 是解釋與實作指南；規範性成功準則以 [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/) 為準。局部 axe 通過或截圖無異常不能代表全站合規。
- 本次沒有修改 React、CSS、API、資料庫，也沒有擅自建立 issue 或對外送訊息。
