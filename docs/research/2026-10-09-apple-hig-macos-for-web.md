# Apple HIG（macOS）與 Web/PWA 桌機版的對應研究

- 研究日期 / 全部來源抓取日期：**2026-10-09**
- 範圍：Apple Human Interface Guidelines 的 macOS 面向，以及可對應到 Web/PWA 桌機（≥1024px）的 CSS / ARIA / WCAG 機制。
- 方法：HIG 頁面是 JS 渲染，`developer.apple.com/design/human-interface-guidelines/<slug>` 只回標題；改抓 `developer.apple.com/tutorials/data/design/human-interface-guidelines/<slug>.json`，內容可用。
- **更正（2026-10-09，對照 repo 程式碼與 Chromium 實測後）**：本文件撰寫時**沒有檢視 Tripline 程式碼**，「對 Tripline 的啟示」有兩處與現況不符。HIG／WCAG／MDN 的事實陳述不受影響。
  1. 桌機 ≥1024px **沒有**底部玻璃 tab：`GlobalBottomNav` 在該寬度 `display:none`，桌機導覽是 `DesktopSidebar`。第 87 行與 C-5 的「桌機底部浮動 tab」前提不成立。
  2. Tripline **已有** `prefers-reduced-transparency` 與 `prefers-contrast` 降級區塊（`css/tokens.css`），問題不在「缺」而在「**失效**」：`--tabbar-*` token 定義在 `body`，降級只覆寫 `:root`，被遮蔽；另有多處硬寫的 `backdrop-filter` 不走 token。已實測並開票 #1422。
- 限制：下方「來源索引」中的內容是透過 WebFetch（小模型摘要）取得，非逐字下載；引號內文字為摘要結果中的引文，關鍵數字建議 owner 或實作者在採用前再人工點開來源確認一次。

## 來源索引

引用格式 `[H-xx]` 等，對照下表。所有條目抓取日期皆為 2026-10-09。

HIG（URL 前綴 `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/`，對應的人類可讀頁面為同 slug 去掉 `tutorials/data/` 與 `.json`）

| 代號 | slug | 備註 |
|---|---|---|
| H-mac | `designing-for-macos.json` | 取得 |
| H-win | `windows.json` | 取得 |
| H-tb | `toolbars.json` | 取得（含 2025-12-16 Liquid Glass 更新註記） |
| H-sb | `sidebars.json` | 取得 |
| H-tab | `tab-bars.json` | 取得；macOS 段落僅「無額外考量」 |
| H-menu | `menus.json` | 取得 |
| H-ctx | `context-menus.json` | 取得 |
| H-kbd | `keyboards.json` | 取得 |
| H-ptr | `pointing-devices.json` | 取得 |
| H-mat | `materials.json` | 取得 |
| H-col | `color.json` | **僅讀到前 100,000 / 181,946 字元** |
| H-dm | `dark-mode.json` | 取得 |
| H-typ | `typography.json` | **僅讀到前 100,000 / 281,026 字元**（含 macOS 字級表） |
| H-lay | `layout.json` | 取得 |
| H-acc | `accessibility.json` | 取得（摘要僅針對尺寸、對比、動態、鍵盤四節詢問） |
| H-btn | `buttons.json` | 取得 |
| H-tf | `text-fields.json` | 取得 |
| H-pop | `popovers.json` | 取得 |
| H-sht | `sheets.json` | 取得 |
| H-alt | `alerts.json` | 取得 |
| H-mot | `motion.json` | 取得 |

Web 標準

| 代號 | URL |
|---|---|
| M-rt | https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency |
| M-pc | https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast |
| M-rm | https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion |
| M-bf | https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter |
| M-hov | https://developer.mozilla.org/en-US/docs/Web/CSS/@media/hover |
| M-ptr | https://developer.mozilla.org/en-US/docs/Web/CSS/@media/pointer |
| M-env | https://developer.mozilla.org/en-US/docs/Web/CSS/env |
| M-cs | https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme |
| M-wco | https://developer.mozilla.org/en-US/docs/Web/API/Window_Controls_Overlay_API |
| M-ac | https://developer.mozilla.org/en-US/docs/Web/CSS/accent-color |
| M-sys | https://developer.mozilla.org/en-US/docs/Web/CSS/system-color |
| W-spec | https://www.w3.org/TR/WCAG22/（單頁過長，僅讀前 100,000 / 269,706 字元；2.5.8 與 4.1.2 不在已讀範圍） |
| W-258 | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
| A-dlg | https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ |
| A-mb | https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/ |
| A-ad | https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/ |

### 未能取得 / 未涵蓋

- `https://developer.apple.com/design/human-interface-guidelines/*` 的 HTML 路徑：**未能取得**（只回標題），全部改用 JSON 路徑。
- HIG「The menu bar」（macOS 選單列細節）、「Panels」、「Split views」、「Pop-up buttons」、「Combo boxes」、「Full-screen」等頁：**未抓取**（`menus.json` 指向 menu bar 頁，但該頁內容本次未取得）。
- HIG `accessibility.json` 沒有任何 Reduce Transparency 專屬條文（見下）；`materials.json` 也只一句帶過。「Reduce Transparency 在 macOS 的具體行為」因此**HIG 未取得明文**。
- HIG「Liquid Glass」沒有獨立 HIG 頁面可抓；相關論述分散在 Materials / Color / Toolbars / Tab bars。WWDC25 session 219、356 本次**未取得**。
- MDN 各頁的 browser compatibility 表格**未取得**（皆被截斷），所以下文只引用 MDN 頁首的 Baseline 標籤，不寫各瀏覽器版本號。
- `prefers-reduced-transparency`、`accent-color`、Window Controls Overlay：MDN 標示非 Baseline / experimental / limited availability，見下。
- WCAG 2.2 規範本文的 2.5.8 條目：單頁抓取被截斷，改以 Understanding 頁取得規範句與例外清單（W-258）。2.4.13、1.4.11、1.4.3 的內容沿用 DESIGN.md 已寫的引用，**本次未重抓**。

---

## 1. 總則：Designing for macOS

| Apple 原生建議 | Web 對應做法與可用機制 | Web 無法對應 / 不應照抄 |
|---|---|---|
| Mac 使用情境：大螢幕、固定桌面、典型觀看距離約 1–3 英尺；輸入可能是鍵盤、指標裝置的任意組合；工作階段從幾分鐘到數小時，常多 app 並開。[H-mac] | 桌機斷點（≥1024px）用 `@media (hover: hover) and (pointer: fine)` 之類的輸入能力查詢區分互動，而非只看寬度。[M-hov][M-ptr] | 觀看距離 1–3 英尺是原生 point 排版的前提；CSS px 與實體尺寸無固定關係，不能由此推導字級。 |
| 用大螢幕「在較少的巢狀層級呈現更多內容、減少 modality」，但保持資訊密度舒適。[H-mac] | 桌機版把 sidebar / inspector / detail 並排（專案已有 2-col timeline + sticky map），用 sheet/popover 取代整頁導覽。 | 無（可直接借用原則）。 |
| 讓使用者調整、隱藏、顯示、移動視窗；支援 full-screen。[H-mac] | 瀏覽器視窗由使用者控制，頁面只能做 responsive；PWA 可用 `display: standalone`。 | Web 頁面無法控制視窗的移動 / 多視窗配置；不應自製視窗框。[H-win] 另說「避免自製 window frame 或 controls，沒有完全貼合系統外觀會讓 app 感覺壞掉」。 |
| 用 menu bar 提供「所有」指令；支援高精度輸入、鍵盤快捷鍵；支援個人化（自訂 toolbar、顏色、字型）。[H-mac] | 網頁沒有全域 menu bar；可用應用內的 command palette / 有明確入口的選單 + 快捷鍵（見第 5 節）。 | 無法註冊 macOS menu bar 項目（installed PWA 也不行）；不要宣稱「提供完整 menu bar」。 |

## 2. Windows / Toolbars / Sidebars / Tab bars

### 2.1 Windows

| Apple 原生建議 | Web 對應 | Web 無法對應 / 不應照抄 |
|---|---|---|
| macOS 視窗有 main / key / inactive 狀態；key window 用彩色 title bar 控制鈕，inactive 用灰；「inactive windows 不使用 vibrancy」。[H-win] | 可用 `window` 的 `blur` / `focus` 事件或 `document.hasFocus()` 近似做「非作用中」視覺淡化。 | 瀏覽器視窗的 key/main 狀態與 title bar 控制鈕不由頁面控制；Window Controls Overlay 只在**已安裝的桌機 PWA** 且 manifest 宣告 `display_override: ["window-controls-overlay"]` 時才有，MDN 標為 experimental / Limited availability。[M-wco] |
| 底部列（bottom bar）：避免放關鍵資訊或操作，因為使用者常把視窗移到底邊被遮住。[H-win][H-sb][H-lay] | 桌機版避免把唯一入口放在視窗底部；若底部浮動 tab（rev2）存在，需有其他入口 / 鍵盤入口。 | 這是 macOS 視窗可被拖出螢幕的特性；Web 的 viewport 底邊永遠可見，但「瀏覽器視窗被使用者縮短 / 部分移出」同理可能發生，原則可借、不需強行遵守。 |
| 開新視窗要節制，預設不要大量開新視窗；可在 context menu / File menu 提供「在新視窗開啟」。[H-win] | 以 `<a target="_blank" rel="noopener">` 提供明確的「新分頁開啟」；避免預設開新視窗。 | 頁面無法定義 macOS 的 window 層級（primary / auxiliary）。 |
| 自訂 window 時要使用系統定義的外觀。[H-win] | 以系統色關鍵字（`Canvas`、`CanvasText`、`AccentColor` 等，Baseline Widely available；`AccentColor` 有指紋防護的限制）與 `color-scheme` 取得原生外觀。[M-sys] | 品牌自訂色（terracotta tint）無法「自動」跟隨系統。 |

### 2.2 Toolbars

| Apple 原生建議 | Web 對應 | Web 無法對應 / 不應照抄 |
|---|---|---|
| 工具列分 leading（返回、顯示/隱藏 sidebar、標題）/ center / trailing（essential、inspector、搜尋、More、primary action）；最多約三組；一個 prominent action 放 trailing。[H-tb] | 桌機 header 以 `<header>` + `role="toolbar"`（需 roving tabindex 與 `aria-label`）排版；單一主要動作以實心按鈕放右側。 | `NSToolbar` 的自動 overflow、自訂化 UI 無對應；overflow 要自行實作（容器查詢 + More 選單）。 |
| 「每個 toolbar 項目都要在 menu bar 有對應指令」，因為使用者可自訂 / 隱藏 toolbar。[H-tb] | Web 無 menu bar；等價做法是同一指令在 toolbar、context menu、快捷鍵至少兩處可達。 | 不可宣稱 toolbar 為唯一入口且已「等同 macOS」。 |
| 標題 15 字以內、不要用 app 名稱當標題。[H-tb] | `<h1>` / `document.title` 語意 | 15 字為英文 UI 的原生建議；中文標題寬度計算不同，不宜直接當數值規範（本項為推論，非 Apple 所述）。 |
| Liquid Glass 更新（2025-12-16 變更註記）：減少自訂 toolbar 背景與 tinted controls；讓內容層決定 toolbar 顏色；避免 toolbar label 顏色與彩色內容背景相近。[H-tb] | 避免在玻璃 header 上放大面積自訂染色；浮動 header 與內容保持對比（見第 7 節）。 | `ScrollEdgeEffectStyle` 無 CSS 標準對應；可用 `mask-image` 或漸層近似，但屬自行設計。 |

### 2.3 Sidebars

| Apple 原生建議 | Web 對應 | Web 無法對應 / 不應照抄 |
|---|---|---|
| macOS sidebar 有 small / medium / large 三種尺寸（使用者可在系統設定改）；視窗縮小時自動收合；提供 show/hide 控制或 View 選單命令。[H-sb] | 以容器查詢 / 斷點收合；按鈕用 `aria-expanded` + `aria-controls`；提供鍵盤快捷鍵。 | 系統設定的 sidebar 圖示大小無法被網頁讀到；不應假設使用者設定。 |
| 層級最多兩層；不要把關鍵資訊放在 sidebar 底部；用 SF Symbols。[H-sb] | 導覽樹用 `<nav>` + 巢狀 `<ul>`，`aria-current="page"`。 | SF Symbols 在網頁的授權限制本次**未查**；專案已採「SF-風描邊 icon」（DESIGN.md grill v2 決策⑤）。 |
| 「尊重系統 accent color」：sidebar 圖示應跟隨系統強調色，固定色僅用來傳達意義。[H-sb][H-col] | CSS 有 `AccentColor` / `accent-color: auto`，但只影響原生表單控制項；且部分瀏覽器為防指紋回傳固定值。[M-ac][M-sys] | Web 無法可靠讀取 macOS 的使用者強調色。與專案「terracotta 受控 tint」品牌決策並存即可，不宜宣稱「跟隨系統 accent」。 |

### 2.4 Tab bars

| Apple 原生建議 | Web 對應 | Web 無法對應 / 不應照抄 |
|---|---|---|
| macOS 段落：「無額外考量」；一般準則：tab bar 用於導覽非動作、保持可見、不要 disable/隱藏 tab、要有標籤、盡量少 tab、避免 More/overflow。[H-tab] | `role="tablist"` / `tab` / `tabpanel` 或 `<nav>` 內的連結（導覽到不同路由時，用連結 + `aria-current` 較貼近語意）。 | **HIG 並未針對 macOS 定義 tab bar 外觀**；iOS 為底部浮動 Liquid Glass，iPadOS 為頂部可轉為 sidebar。桌機版若以「底部玻璃 tab」呈現，來源是專案 rev2 mockup 決策，不是 macOS HIG 條文。 |

## 3. Menus 與 Context menus

| Apple 原生建議 | Web 對應 | Web 無法對應 / 不應照抄 |
|---|---|---|
| 選單項目用動詞、title-style 大寫、去冠詞；需要更多輸入時加「…」；可顯示快捷鍵。[H-menu] | 中文 UI 以「動詞＋名詞」，需後續輸入的項目結尾加「…」；快捷鍵以 `aria-keyshortcuts` 標註並以視覺顯示。 | 「title-style capitalization」、去冠詞是英文規則，中文不適用。 |
| 不可用項目（unavailable）呈現淡化且不回應；選單本身與子選單即使全不可用也保持可開。[H-menu] | `aria-disabled="true"` 比 `disabled` 更利於保持可聚焦與可被螢幕閱讀器發現。 | 無。 |
| 子選單慎用、最多一層；提供 toggled 項目要換標籤（顯示地圖 ↔ 隱藏地圖）或用勾選。[H-menu] | `role="menuitemcheckbox"` + `aria-checked`。 | 無。 |
| Context menu：只放當下相關指令、保持簡短、跨 app 一致、指令也要出現在主介面 / menu bar；**不顯示快捷鍵**；**隱藏**不可用項目而非淡化（macOS 例外：Cut/Copy/Paste）；submenu 最多一層；分隔最多約三組。[H-ctx] | 以 `contextmenu` 事件 + 自建選單；需同時提供鍵盤觸發（Menu 鍵 / Shift+F10 / 按鈕 `⋯`）。 | 覆寫瀏覽器原生右鍵選單會失去「拼字檢查 / 複製連結」等能力，且觸控裝置無右鍵；HIG 的「Control-click / secondary click 觸發」在 Web 只是一種輸入來源，不能是唯一入口。該限制屬推論，非 Apple 所述。 |
| 「Mark destructive items」為 iOS/iPadOS/visionOS 規則，macOS 段落未列。[H-ctx] | 破壞性項目用文字 + 圖示 + 色彩三重表示（不單靠紅色）。 | 勿把 iOS 的「刪除放最後、紅色」描述成 macOS 規範。 |
| ARIA：Menu Button 規定 `button` 帶 `aria-haspopup="menu"`、`aria-expanded`；Enter/Space 開啟並聚焦第一項，Down/Up 為選用。[A-mb] | 照 APG 實作；`role="menu"` 僅適用於「應用程式式命令選單」，網站導覽選單不應使用（本點為 APG 的一般立場，**本次抓取的 A-mb 頁沒有出現此警告，屬未驗證**，實作前請自行到 APG Menu pattern 頁確認）。 | — |

## 4. Pointing devices（hover / click / 指標尺寸）

| Apple 原生建議 | Web 對應 | Web 無法對應 / 不應照抄 |
|---|---|---|
| **控制項尺寸表**（Accessibility 頁）：macOS 預設 **28×28 pt**、最小 **20×20 pt**；iOS/iPadOS 預設 44×44、最小 28×28。[H-acc] 周圍留白：有 bezel 約 12 pt、無 bezel 約 24 pt。[H-acc][H-ptr] | WCAG 2.2 SC 2.5.8（AA）：指標目標至少 **24×24 CSS px**，例外：spacing（24px 圓不重疊）、equivalent、inline、user agent control、essential。[W-258] 專案桌機可採 ≥28 CSS px 作為「類 macOS 預設」的設計值（owner 決策）。 | **pt ≠ CSS px**。Apple 的 point 是邏輯單位，換算依螢幕縮放；HIG 本身說 point 大小以 144 ppi @2x 設計稿為基準（見 H-typ）。20 pt 的 macOS 最小值**低於** WCAG 24 CSS px，不可用來替低於 24px 的 Web 目標背書。 |
| Apple 內部口徑並不一致：`buttons.json` 通則寫「hit region 至少 44×44 pt（visionOS 60×60）」，未區分 macOS；`accessibility.json` 表才分平台。[H-btn][H-acc] | 引用時註明出處是哪一頁。 | 不要把 buttons 頁的 44 pt 當成 macOS 規範，也不要把 accessibility 頁的 20 pt 當成「最佳實務」。 |
| hover：可用來顯示 / 隱藏會淡出的控制項；避免無意義的 pointer 效果；「不要有陰影而無縮放」。[H-ptr] | `@media (hover: hover)` 包住 `:hover` 增強；`hover`/`pointer` 只測「主要」輸入，雙輸入裝置用 `any-hover` / `any-pointer`。[M-hov][M-ptr] | 重要資訊或操作不能只靠 hover 出現（MDN 範例亦以增強方式使用）；WCAG 1.4.13 要求 hover/focus 出現的內容可關閉、可停留、持續顯示。[W-spec] |
| macOS 標準游標（箭頭、I-beam、開合手、resize、not allowed、拖曳複製 / 連結）用以傳達狀態。[H-ptr] | CSS `cursor`：`default`、`text`、`grab`/`grabbing`、`col-resize`、`not-allowed`、`copy`、`alias`。 | 無 iPadOS 式的 pointer morph / magnetism；不應模仿。 |
| 主要點擊（primary click）選取 / 啟動，次要點擊叫出 contextual menu；不要重新定義系統手勢。[H-ptr] | 保持 `click` 語意；不攔截捲動 / 雙指手勢。 | 無。 |
| 按鈕 hit region 要連續，避免游標在相鄰按鈕間閃回預設形狀。[H-ptr] | 相鄰工具列按鈕間用 padding 而非 margin 來維持連續的可點區域。 | 無。 |

## 5. Keyboard（快捷鍵、Full Keyboard Access、focus）

| Apple 原生建議 | Web 對應 | Web 無法對應 / 不應照抄 |
|---|---|---|
| 支援 Full Keyboard Access；Tab / Shift-Tab 移動控制項；Control-Tab 在群組間移動；Control-F1 切換 FKA。[H-kbd] | 全部互動元件以原生元素或正確 role 達到 Tab 可達；群組內用 roving tabindex（tablist、toolbar、menu）。WCAG 2.4.7 焦點可見（AA）、2.4.11 焦點不被完全遮住（AA）。[W-spec] | macOS 的 FKA 是系統層級開關，預設關閉時 Safari 的 Tab 不會停在所有控制項（Safari 設定）。該行為差異本次**未於 Apple 一手頁面取得**，故不展開。 |
| 「尊重標準快捷鍵」，不要重新定義系統快捷鍵；自訂快捷鍵以 Command 為主要修飾鍵、Shift 為輔、Option 慎用、**避免 Control**，修飾鍵順序 Control-Option-Shift-Command。[H-kbd] | 網頁可用 `keydown` + `event.metaKey`（Mac 的 Command）；以 `aria-keyshortcuts` 標示。 | 瀏覽器已佔用大量 Command 組合（新分頁、重新整理、尋找等）且**無法被頁面取代 / 攔截**（`Cmd+W`、`Cmd+T`、`Cmd+Q` 等頁面根本收不到）；不能假設能實現 `Cmd+N`、`Cmd+,`（開啟設定）等 macOS 慣例。 |
| 標準快捷鍵清單：如 Command-F 尋找、Command-Z 復原、Command-W 關閉視窗、Command-, 開設定、Command-? 開說明、Esc / Command-. 取消。[H-kbd][H-alt] | 只實作頁面內有意義的：`Esc` 關閉 dialog/popover（APG 亦如此）；`/` 或 `Cmd+K` 聚焦搜尋屬社群慣例，**不是** HIG 條文。 | 不要攔截 `Cmd+F`（瀏覽器尋找）等。 |
| WCAG 2.1.4 字元鍵快捷鍵（Level A）：僅由字母 / 數字 / 標點構成的單鍵快捷鍵，必須可關閉、可重新對應，或僅在元件聚焦時啟用。[W-spec] | 單鍵快捷鍵（如 `j/k`）要提供關閉或限定聚焦範圍；用修飾鍵組合可避開。 | — |
| HIG 提醒：不要替 iPadOS 的 button、segmented control、switch 加自訂鍵盤導覽（交給 FKA），但 text field、text view、sidebar 內可有。[H-kbd] | 原生 `<button>` 不需自行處理 Tab；自訂群組才用方向鍵。 | 此條為 iPadOS 專指，勿套到 Web 的 composite widget。 |

## 6. Buttons / Text fields / Popovers / Sheets / Alerts（macOS 行為）

| 元件 | Apple 原生建議 | Web 對應 | Web 無法對應 / 不應照抄 |
|---|---|---|---|
| Buttons | 角色四種：Normal / Primary / Cancel / Destructive；primary 回應 **Return**，使用 accent color；destructive 用 system red，**不要把破壞性動作設為 primary**；開啟另一視窗 / 面板的按鈕標題加「…」；每視窗最多一個 Help 按鈕；image button 邊距約 10 pt；每個 view 最多一到兩個 prominent 按鈕。[H-btn] | `<form>` 的預設 submit 按鈕即 Return 行為；`<dialog>` 內以 `autofocus` 或 JS 設初始焦點；`aria-label` 補圖示按鈕名稱。 | macOS 沒有給 push button 的點數尺寸。[H-btn] 勿自行引用 28 pt 為按鈕「高度規範」（那是控制項點擊尺寸，見第 4 節）。bezel style（NSButton.BezelStyle）無 CSS 等價。 |
| Text fields | macOS 專屬僅一條：需要「輸入或從清單選」時用 combo box；內容被截斷時可用 tooltip 顯示全文。[H-tf] | 原生 `<input list>` / `<datalist>` 或 APG combobox；截斷文字以 `title`/可聚焦 tooltip，並注意 WCAG 1.4.13。[W-spec] | tooltip 在觸控無法 hover；不可作為唯一取得全文方式。 |
| Popovers | macOS 專屬：可做成「可拖曳分離（detachable）」的 panel。[H-pop] | Popover API（`popover` 屬性）或自建；Esc 關閉、點擊外側關閉。 | 瀏覽器內無法產生脫離視窗的 panel（除非 `window.open` / Document Picture-in-Picture，皆非本次研究範圍）；不應承諾「detachable」。 |
| Sheets | macOS sheet：浮在父視窗上、**一律 modal**、父視窗變暗；大小隨內容、通常不期待可調整；開 sheet 時父視窗移到前景；重複輸入並觀察結果的任務改用 panel。[H-sht] | `<dialog>` + `showModal()`（自帶 inert 背景與 Esc）或 `role="dialog"` + `aria-modal="true"`；APG 規定 Tab 在對話框內循環、Esc 關閉、關閉後焦點回到觸發元素、`aria-labelledby` 指向可見標題。[A-dlg] | HIG「sheet 以父視窗為範圍（window-modal）」在 Web 只有整頁 modal；無法做到「sheet 開啟時仍能操作 app 的其他視窗」。 |
| Alerts | 預設按鈕放 trailing；**不要把 Cancel 設為預設**；有破壞性動作就要有 Cancel，標題固定「Cancel」；Esc 或 Command-. 取消；macOS 顯示 app 圖示、可有「不再顯示」勾選、可附 Help 按鈕；caution 符號少用。若希望使用者讀內容，可不設預設按鈕。[H-alt] | `role="alertdialog"` + `aria-modal="true"` + `aria-describedby` 指向訊息；APG 建議不可逆動作時初始焦點放「最不具破壞性」的按鈕。[A-ad][A-dlg] | `Command-.` 在瀏覽器內可由頁面自訂監聽，但非 Web 慣例；不必強加。 |

## 7. Materials / Liquid Glass / Vibrancy

| Apple 原生建議 | Web 對應 | Web 無法對應 / 不應照抄 |
|---|---|---|
| 兩類材質：**Liquid Glass**（控制與導覽層，浮在內容上）與 **standard materials**（內容層）；**不要在內容層使用 Liquid Glass**；自訂 Liquid Glass 效果應節制。Regular（模糊並調整亮度以保持文字可讀）與 Clear（高度透明，僅用於豐富媒體背景）。Clear 疊在亮內容上可考慮 35% 不透明度的暗色壓層。[H-mat] | `backdrop-filter: blur() saturate()` + 半透明 `background`；Baseline 2024 Newly available（2024-09 起）；元素或背景必須半透明才看得到效果。`opacity`<1、`filter`、`mask`/`clip-path`、`mix-blend-mode`、特定 `will-change` 等會形成 backdrop root，使子元素的模糊失效。[M-bf] | CSS 沒有 Liquid Glass 的折射 / 動態光澤 / 與內容互動的反應；`backdrop-filter` 只是模糊與色調調整，不應宣稱「實作 Liquid Glass」。HIG 的 35% 壓層是針對 media 的數值建議，不是通用 token。 |
| macOS vibrancy：材質上的前景應使用「vibrant colors」；兩種 blending mode（behind window / within window）；避免在半透明材質上用非 vibrant 色（例如 `systemGray3`）。[H-mat] | 用 `backdrop-filter: saturate()` 加強；前景字色用高對比實色而非半透明灰。 | **瀏覽器無法取得「視窗後方桌面」的像素**，所以 behind-window blending 與 desktop tinting 無法在 Web 實現；`backdrop-filter` 只模糊頁面內元素（相當於 within-window）。 |
| 材質選擇依「語意與建議用途」，不依想要的顏色；較厚（更不透明）對比較好，較薄保留脈絡。[H-mat] | 以 CSS 變數定義 2–3 個固定厚度（如 thin / regular / thick），並每層固定最低文字對比。 | — |
| Reduce Transparency：`materials.json` 僅說 Liquid Glass 外觀會因系統設定（含降低透明度、增加對比）而改變；`accessibility.json` **無 Reduce Transparency 專屬條文**；`dark-mode.json` 要求在 Dark Mode 下分別與同時測試 Increase Contrast 與 Reduce Transparency。[H-mat][H-acc][H-dm] | `@media (prefers-reduced-transparency: reduce)` 把玻璃換成不透明實色；**MDN 標為 experimental、非 Baseline、規範仍是 Media Queries Level 5 草案**，因此需搭配 `@supports (backdrop-filter: blur(1px))` 的 fallback 與 `prefers-contrast: more`。[M-rt][M-pc] | 因為 `prefers-reduced-transparency` 不是廣泛可用，不能只靠它保證可讀性：玻璃層的**預設狀態**就需滿足對比（HIG 亦建議「不要只靠半透明傳達階層」，該句為 materials 頁摘要中的推論，非 Apple 原句）。 |

## 8. Color（system colors、Dark Mode、accent）

| Apple 原生建議 | Web 對應 | Web 無法對應 / 不應照抄 |
|---|---|---|
| 勿寫死系統色數值（會隨版本變）；動態系統色依「用途」命名（label、background、separator），不要拿 `separator` 當文字色。[H-col] | 專案已有 `css/tokens.css` 語意 token，可用同樣原則（按用途命名）。 | Apple 系統色 hex 不可抄成 Web 的權威值；專案 DESIGN.md 已有 iOS system gray 抬階的 owner 決策，屬專案決定。 |
| macOS accent color（macOS 11 起）：影響按鈕、選取高亮、sidebar 圖示；僅在使用者設為 multicolor 時才套用 app 的 accent，使用者選了特定色就覆蓋 app 設定。[H-col] | `accent-color: auto` 僅影響 checkbox / radio / range / progress，MDN 標 Limited availability，部分瀏覽器為防指紋回傳固定值。[M-ac] | 品牌 accent 無法被使用者的系統 accent 覆蓋；這是**品牌決策與 HIG 預期的差異**，需 owner 知悉。 |
| 所有顏色要在 light、dark、increased contrast 下都成立；自訂色需提供三種變體；即使 app 只出一種模式也要提供 light 與 dark。[H-col] | `prefers-color-scheme`（Baseline Widely available，2020-01 起）、`color-scheme` 屬性、`prefers-contrast: more`（Baseline Widely available，2022-05 起）。[M-cs][M-pc] | `prefers-contrast: custom` 對應 `forced-colors: active`；forced colors 下 `box-shadow` 會被移除，需以邊框替代（MDN system-color 頁範例）。[M-pc][M-sys] |
| Dark Mode：避免 app 專屬外觀設定，應跟隨系統；對比至少 **4.5:1**，自訂前景 / 背景建議 **7:1**；白底圖片略微壓暗；不是簡單反相。[H-dm] | 預設跟隨 `prefers-color-scheme`；若提供手動切換，語意上屬「偏離 HIG 建議」的產品決策。 | HIG 此處把 4.5:1 設為「所有外觀」下限，7:1 為建議值；Web 驗收門檻仍是 WCAG 1.4.3（4.5:1 / 大字 3:1），7:1 是 AAA（1.4.6，本次未抓取，僅憑常識，未驗證）。 |
| 不要僅靠顏色傳達資訊（色盲）；考慮文化意涵（紅漲 / 綠漲）。[H-col] | 圖示 + 文字 + 色彩並用；符合 WCAG 1.4.1（本次未抓取）。 | — |
| macOS desktop tinting：使用「graphite」強調色時，視窗背景會取用桌面圖片顏色；自訂元件只在中性狀態加透明度。[H-dm] | 無對應。 | 瀏覽器無法讀桌面圖片；不應嘗試模仿。 |
| Liquid Glass 無固有顏色；tint 僅用於主要動作，且「顏色加在背景而非符號 / 文字」；彩色 app 偏好單色 toolbar / tab bar；不要讓多個控制項背景都上色。[H-col] | 玻璃 header 與 tab 保持中性（專案現行方向吻合）；強調色限於單一主要動作。 | — |

## 9. Typography（SF 與 macOS 字級表）

| Apple 原生建議 | Web 對應 | Web 無法對應 / 不應照抄 |
|---|---|---|
| **macOS 預設字級 13 pt、最小 10 pt**（iOS 為 17 / 11）。[H-typ] | 以 `rem` 設定，並確認 200% 縮放不失內容（WCAG 1.4.4 AA），文字間距覆寫不失功能（1.4.12 AA）。[W-spec] | **13 pt ≠ 13 px**；HIG 說明 point 以 144 ppi（@2x）設計稿為基準。Web 預設 body 常見 16px，若直接把 macOS 13 pt 當 13px 會比 iOS 預設更小；不可照搬。 |
| macOS 內建文字樣式表：Large Title 26/32、Title 1 22/26、Title 2 17/22、Title 3 15/20、Headline 13/16（Bold）、Body 13/16、Callout 12/15、Subheadline 11/14、Footnote 10/13、Caption 1 10/13、Caption 2 10/13（pt / 行高 pt）。[H-typ] | 可作為「相對比例」參考，轉成 `clamp()` / `rem` 的階層。 | 僅是點數表，網頁需以實際字體（Inter + Noto Sans TC）與 CJK 行高重新驗證；表中最小 10 pt 在中文會極難閱讀。 |
| 避免 Ultralight / Thin / Light 字重，尤其小字；用 Regular、Medium、Semibold、Bold。[H-typ] | 字重 ≥400。 | — |
| 使用內建 text style 以獲得一致階層與 Dynamic Type；「不要把系統字型嵌入 app」。[H-typ] | `font-family: system-ui, -apple-system, …` 可呼叫 SF；Dynamic Type 在 Web 以瀏覽器字級設定 + `rem` 近似。 | Web 無法保證取得 SF（非 Apple 平台）；專案已決定保留 Inter。Dynamic Type 的使用者字級在 macOS Safari 沒有等價系統設定（本點未於 Apple 頁面驗證）。 |

## 10. Layout

| Apple 原生建議 | Web 對應 | Web 無法對應 / 不應照抄 |
|---|---|---|
| 依 size classes 而非裝置類型 / 方向決定版面；跨 size class 功能保持一致，僅可改變可見量（如 tab bar → sidebar）。[H-lay] | 容器查詢（`@container`）與斷點；專案「桌機 2-col / 行動 4-tab」符合「功能一致、呈現改變」。 | Web 沒有 size class 概念，需自行定義斷點。 |
| 可延伸豐富內容到 sidebar / toolbar 之下（background extension）；以 Liquid Glass 與 scroll edge effect 分離控制與內容，而非實心底色。[H-lay] | 地圖 full-bleed + 浮動玻璃面板（專案現行）。 | `backgroundExtensionEffect` 無 CSS 等價。 |
| macOS：避免把控制項或關鍵資訊放在視窗底部；避免內容顯示在鏡頭凹口（camera housing）後方。[H-lay] | `env(safe-area-inset-*)` 為 iOS 等有凹口 / 動態 UI 的裝置而設；桌機瀏覽器通常為 0。[M-env] | 桌機 Safari/Chrome 不會把 camera housing 暴露為 safe-area-inset；已安裝桌機 PWA 的標題列區域用 `env(titlebar-area-*)`，僅在 `display_override: window-controls-overlay` 下有值，需提供 fallback。[M-env][M-wco] |
| 以對齊、留白、分組、漸進揭露組織內容；頂部與 leading 側為優先。[H-lay] | RTL 時用邏輯屬性（`margin-inline-start`）。 | — |

## 11. Accessibility（對比、Reduce Transparency / Increase Contrast / Reduce Motion）

| Apple 原生建議 | Web 對應 | Web 無法對應 / 不應照抄 |
|---|---|---|
| 對比表（以 WCAG AA 為基礎）：至多 17 pt 文字 4.5:1；18 pt 3:1；任何尺寸 Bold 3:1；若未達標應在 Increase Contrast 開啟時提供更高對比方案；Dark Mode 下兩種外觀都要驗。[H-acc] | WCAG 1.4.3：大字（≥18 pt 或 ≥14 pt 粗體）3:1，其餘 4.5:1。（DESIGN.md 已引用；本次未重抓。）`prefers-contrast: more` 提供更高對比 token。[M-pc] | HIG 表中 **「All sizes + Bold = 3:1」比 WCAG 寬鬆**（WCAG 只有 ≥14 pt 粗體才算大字）；Web 驗收不可引用 HIG 表替 12–13px 粗體字的 3:1 背書。本摘要未顯示該表是否分平台（H-acc 摘要未標），此處**未能確認**。 |
| Reduce Motion：減少自動與重複動畫（縮放、peripheral motion）；收緊彈簧、避免 z 軸深度動畫、以淡入淡出取代 x/y/z 位移、避免進出模糊的動畫。[H-acc] | `@media (prefers-reduced-motion: reduce)`（Baseline Widely available，2020-01 起）；MDN 建議用較柔和的效果（淡入、顏色變化）取代而非單純移除回饋。[M-rm] | WCAG 2.3.3（AAA）要求互動觸發的動畫可停用；2.2.2 暫停 / 停止 / 隱藏（A）本次未抓取。 |
| Motion 頁：動態要有目的、可取消、不要讓使用者等動畫結束才能操作；但「並未明確討論 Reduce Motion」。[H-mot] | transition 時間短（HIG 未給毫秒數，勿捏造數值）、可打斷。 | — |
| 鍵盤：支援 Full Keyboard Access，不覆蓋系統快捷鍵。[H-acc][H-kbd] | 見第 5 節。 | — |
| Reduce Transparency / Increase Contrast：Materials 頁僅說外觀會變；HIG 本次可取得頁面沒有具體演算法。[H-mat] | 見第 7、8 節（`prefers-reduced-transparency`、`prefers-contrast`、`forced-colors`）。 | 不要把「macOS 設定」假設為頁面能偵測：MDN 僅說瀏覽器「可能」依賴 OS 設定（macOS：Accessibility > Display > Reduce transparency）。[M-rt] |

---

## 對 Tripline 的啟示

僅陳述事實與建議，不替 owner 做決策。參照對象：DESIGN.md 第 7–19 行「Web 設計驗收與來源」。

### A. 與 DESIGN.md 現有口徑相符

1. **指標尺寸**：DESIGN.md 所引 HIG 數值（macOS 預設 28 pt / 最小 20 pt；iOS 44 / 28）與 `accessibility.json` 表一致；它對「pt 不是 CSS px」、WCAG 2.5.8 為 24 CSS px、2.5.5 為 AAA 的區分，亦與本次抓到的 Understanding 頁規範句與五項例外相符。[H-acc][W-258]
2. **對比**：DESIGN.md 說「HIG 對比表另列 bold 3:1，不取代 Web 門檻」，與本次 `accessibility.json` 的表一致（Up to 17 pt 4.5:1、18 pt 3:1、Bold 3:1）。[H-acc]
3. **焦點**：2.4.7、2.4.11 為 AA 與 2.4.13 非 AA 的區分，與 WCAG 2.2 條文位置一致（本次確認 2.4.7、2.4.11 為 AA）。[W-spec]
4. **平台翻譯**：DESIGN.md grill v2 決策⑤「`backdrop-filter` glass + fallback」與 HIG「Liquid Glass 用於控制 / 導覽層、不用於內容層」（timeline editorial no-glass 的例外）方向一致。[H-mat]
5. **Web 不能照搬原生 API**：HIG 多處以 `NSToolbar`、`NSVisualEffectView` 等 AppKit 機制為前提，專案「不把 native pt 與平台 API 直接當 Web 要求」的立場成立。

### B. 建議補強

1. **macOS 預設 28 pt 的 Web 對應值尚未寫成明確設計值**：DESIGN.md 只說「桌機也驗 Web AA，依密度與操作情境採用已拍板設計值」，未列桌機的實際目標（例如是否採 28 CSS px）。可在文中補一句「桌機設計值 = ?」，並註明這是 owner 決策而非 HIG 要求（HIG 20 pt 最小值低於 WCAG 24px）。[H-acc][W-258]
2. **Apple 自身口徑的出入**：`buttons.json` 寫「至少 44×44 pt」且未分 macOS，`accessibility.json` 才分平台。建議 DESIGN.md 備註「引用以 Accessibility 頁表為準」。[H-btn][H-acc]
3. **Reduce Transparency / Increase Contrast 尚無來源行**：DESIGN.md 待決段提到 `prefers-contrast: more` 自訂色（#1176），但來源表四項未涵蓋玻璃層降級。可新增一列：HIG 在 Materials 僅概述、Accessibility 無專屬條文；Web 的 `prefers-reduced-transparency` 為 experimental 非 Baseline，`prefers-contrast` 為 Baseline Widely available。[H-mat][H-acc][M-rt][M-pc]
4. **玻璃層預設可讀性**：因 `prefers-reduced-transparency` 不普及，玻璃 header/tab 在「預設」狀態就需通過對比檢查（HIG Materials 亦要求考量對比與視覺分離、厚材質提供更好對比）。可補「玻璃層以最差背景（地圖 / 照片）驗證」。[H-mat][M-rt]
5. **鍵盤快捷鍵策略**：目前 DESIGN.md 未涉及；若桌機要「走 macOS 互動」，需決定是否提供快捷鍵。事實：頁面收不到 `Cmd+W/T/Q`、不應攔截 `Cmd+F`；WCAG 2.1.4（A）要求單鍵快捷鍵可關閉 / 重新對應或限聚焦。[H-kbd][W-spec]
6. **Dialog / Alert 的鍵盤行為**：HIG（Return 觸發 primary、Esc 取消、Cancel 不設預設、破壞性不設 primary）與 APG（Tab 循環、Esc、焦點回到觸發元素、alertdialog 預設焦點在最不具破壞性的動作）可併為一張驗收表。注意兩者對「預設焦點」的重點略有差異：HIG 講預設按鈕，APG 對不可逆動作建議先聚焦較安全的按鈕。[H-btn][H-alt][A-dlg][A-ad]
7. **macOS 字級表只有點數，沒有 CSS 對應**：若桌機要「近似 macOS 字級階層」，應明說只借比例，且中文 10–13 pt 對應值未經 HIG 驗證。[H-typ]
8. **Window Controls Overlay**：若未來要讓安裝後的桌機 PWA 更像 macOS app，這是唯一的 title bar 客製機制，但 MDN 標示 experimental / 限制可用，且需 `titlebar-area-*` fallback。目前 DESIGN.md 未提。[M-wco][M-env]

### C. 可能衝突（需 owner 知悉，不是本文件的結論）

1. **品牌 accent vs. 系統 accent**：HIG 預期 macOS app 跟隨使用者的系統 accent（multicolor 時才用 app 的色），且 sidebar 圖示依此變化；Tripline 採固定 terracotta accent。Web 本來就無法可靠讀取系統 accent（`AccentColor` 有指紋防護限制），因此這是「刻意偏離」而非「違規」，建議 DESIGN.md 明寫為品牌例外。[H-col][H-sb][M-sys][M-ac]
2. **Dark Mode 手動切換**：HIG 建議「避免 app 專屬的外觀設定，應跟隨系統」。若 Tripline 有手動 light/dark 切換（專案記憶提到原型有切換；實際 production 是否提供，本次**未驗證**），則與此建議不同；WCAG 無此要求。[H-dm]
3. **Dark Mode 對比門檻**：HIG 寫「所有外觀 ≥4.5:1、自訂色建議 7:1」；專案 DESIGN.md 另說 `5.0:1` 是內部邊際、不是標準。若有人引 HIG 的 7:1 建議為依據，需註明這是 Apple 的建議值而非 WCAG AA。[H-dm]
4. **「Bold 3:1」**：HIG 表較 WCAG 寬鬆；若設計審查用 HIG 表通過但 WCAG 1.4.3 不通過，應以 WCAG 為準（DESIGN.md 已如此規定，此處只是提醒審查時別混用）。[H-acc]
5. **【已更正，見文件開頭】底部玻璃 tab 與 macOS HIG**：（以下前提不成立——桌機 ≥1024px 的底部 nav 為 `display:none`，實際是 `DesktopSidebar`；僅手機形態用底部玻璃 nav。HIG 的事實陳述本身仍正確。）HIG 對 macOS tab bar 只寫「無額外考量」，iOS 才是底部浮動 Liquid Glass；同時 macOS 的 Windows / Sidebars 頁建議避免把關鍵資訊放在視窗底部。桌機 rev2「底部玻璃 tab」來自專案 mockup 決策，不是 macOS HIG 條文，不宜以「符合 macOS HIG」作為其依據；若要保留，建議確保有非底部的替代入口（例如 sidebar 或鍵盤）。[H-tab][H-win][H-sb]
6. **Context menu 與 hover-only**：HIG 的 context menu 慣例（secondary click）在觸控與無右鍵裝置不可用，也會取代瀏覽器原生選單；若桌機版新增自訂右鍵選單，需同時有可見的 `⋯` 入口。[H-ctx][M-hov]

### 未驗證事項清單（避免被當成事實）

- 專案實際是否有手動 light/dark 切換、實際桌機按鈕尺寸、`prefers-reduced-transparency` 是否已在 CSS 使用：本次**未檢視程式碼**。
- WCAG 1.4.6（7:1）、1.4.1、2.2.2、1.4.11、1.4.3 的條文本身：本次**未重抓**。
- ARIA APG 是否明載「`role=menu` 不適用於網站導覽」：A-mb 頁面摘要**未出現**此句。
- Safari 在 macOS 預設 Tab 鍵行為與 Full Keyboard Access 設定的關係：**未取得一手來源**。
- Apple 材質清單（NSVisualEffectView.Material 各 case）：H-mat 僅連結，**未列出**。
