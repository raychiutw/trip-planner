# Tripline 網頁設計準則與來源

最後核對：2026-09-25。適用於 React SPA／PWA；原生平台指引、網頁驗收與專案視覺決策分開記錄。本文件不宣告整個產品已符合 WCAG。

## 執行優先序與變更門檻

1. 本次使用者明示決策及根目錄 [AGENTS.md](../AGENTS.md) 控制工作流程。`CLAUDE.md` 僅補充不衝突的專案事實。
2. 網頁 UI/UX 依 [DESIGN.md](../DESIGN.md) 與 [核准預覽](design-sessions/terracotta-preview-v2.html)，並承接文件中有日期、範圍的後續 owner 決策。HIG 是平台設計參考，不自動推翻上述設計或取代 WCAG 網頁驗收。
3. 新頁／新元件涉及 layout 變化，先用 `/prototype` 產生可比較版本、取得 user sign-off，才寫 React。Bug fix、token drift、純 prop tweak、無 UX 變化的內部 refactor 沿用 AGENTS 例外。2026-07 的 W0–W15 effort 豁免僅屬該次歷史交付。
4. 發現尚未定案的品牌／平台衝突時，記錄具體差異與影響，討論後才改政策；不得把可量測的不合格改名為「品牌豁免」。本次 #1345 整理既有決策與標準翻譯，不授權新 layout 或新品牌方向。

## 原生 HIG 與 CSS 尺寸

[Apple HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) 的控制尺寸表使用各平台的 **pt**，並區分 default 和 minimum：

| 平台 | Default control size | Minimum control size |
|---|---|---|
| iOS／iPadOS | 44×44 pt | 28×28 pt |
| macOS | 28×28 pt | 20×20 pt |

這不是「iOS 最小 44 CSS px／macOS 最小 28 CSS px」。原生邏輯 point、CSS px、實體裝置 pixel 是不同量；瀏覽器縮放與 devicePixelRatio 也不能用來把原生表直接套到網頁。

Tripline 的數值是專案選擇：

| 專案目標／既有例外 | 來源與驗收 |
|---|---|
| 一般觸控操作 44×44 CSS px | DESIGN 的 `tap-min`、TitleBar／AccountCircle／表單規則；實測可點 hit area，不能只量圖示。此目標不表示全站取得 AAA。 |
| Day strip 最小高度 34 CSS px | DESIGN「Day Nav」既有 owner 規格；仍驗寬度、間距、鍵盤、放大後可達性。這是 44px 專案目標的明示例外，不是 WCAG 豁免。 |
| 拖曳把手 24×24 CSS px | DESIGN「Accessibility」既有例外；另保留不必拖曳的鍵盤／選單操作。焦點圈不能拿來抵銷不足的點擊區。 |
| Focus outline 2px、正 offset 2px、既有雙帶配色 | DESIGN「Focus Indicator」的網頁 CSS 選擇；不是 HIG 指定幾何，也不等於自動繼承 macOS 系統焦點色。 |
| 文字 token 5.0:1 安全邊際 | DESIGN「Palette」的內部緩衝；不是 WCAG／HIG 門檻。是否達標仍按下表及實際底色判斷。 |

其他 spacing、字型、圓角與元件尺寸依 DESIGN／核准 mockup 的專案規格；不得因值恰好與 HIG 相同，就將它改標為原生標準要求。

## 網頁驗收門檻

以下是本專案使用的 WCAG 2.2 條目，不是完整 conformance checklist。AA 與 AAA 不混稱。

| 條目 | 等級與門檻 | 官方來源 |
|---|---|---|
| 文字對比 1.4.3 | AA：一般文字 ≥4.5:1；大字 ≥3:1。大字為至少 18pt，或至少 14pt 粗體（CSS 換算 24px／18⅔px；其他文字系統依等效字級定義）。11px 粗體仍是一般文字，不能套 3:1。 | [Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) |
| 非文字對比 1.4.11 | AA：識別控制／狀態所必需的視覺資訊及理解內容所需圖形，對相鄰色 ≥3:1。純裝飾不自動落入此要求；`aria-hidden` 本身也不證明它是裝飾。 | [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) |
| Pointer target 2.5.8 | AA：至少 24×24 CSS px；較小目標須符合標準的 spacing、equivalent、inline、user-agent 或 essential 例外。不能只因桌機／有 focus ring 就豁免。 | [Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) |
| Pointer target 2.5.5 | AAA：44×44 CSS px，並有該條列明的例外。不要把這條標成 AA，或與原生 44pt 混用。 | [Target Size Enhanced](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) |
| 文字放大 1.4.4 | AA：文字可放大至 200%，不失去內容／功能；該條另列字幕與文字影像例外。 | [Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) |
| Reflow 1.4.10 | AA：垂直閱讀內容在 320 CSS px 寬下不需雙向捲動；1280px 視窗放大 400% 是典型等效情境。地圖等必須二維布局的內容有例外，其周邊表單／控制仍需可達。Pinch magnification 與 reflow 分別記錄。 | [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) |
| Focus Visible 2.4.7 | AA：鍵盤操作有可見焦點；selection 和 focus 必須能區分。 | [Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) |
| Focus Not Obscured 2.4.11 | AA：取得鍵盤焦點的控制不能完全被作者建立的內容遮住；仍以完整可見作專案操作目標。 | [Focus Not Obscured Minimum](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) |
| Focus Appearance 2.4.13 | AAA：包含指示器面積與同像素前後對比等條件；不能只憑 2px outline 宣稱符合此條。 | [Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) |

Apple HIG 的原生對比表與上述 WCAG 大字定義不同；**不能把 HIG 的任何尺寸 Bold 3:1 翻成網頁規則**。對比需驗實際 computed foreground/background、透明度及相鄰面，不把 token 名稱或 axe 零 violations 當成充分證據；axe incomplete 必須另行驗證。`prefers-reduced-motion`、深淺色及提高對比偏好是專案驗收情境；JavaScript 明示 smooth 捲動也要尊重減少動態效果。

## 保留的設計決策與適用範圍

- **Terracotta tint、Inter、timeline editorial no-glass**：保留 DESIGN 記錄的 2026-07 owner 決策。這些是視覺選擇，不能豁免網頁內容的對比、焦點或操作要求。[HIG Color](https://developer.apple.com/design/human-interface-guidelines/color) 提供原生平台自訂色／外觀參考。
- **Day palette**：DESIGN 僅允許地圖 polyline／entry card 的路線辨識使用多色；Day strip chrome 保持單一 accent。文字仍使用文字專用 token，不能把填色例外擴大成低對比文字許可。
- **純裝飾 3:1**：DESIGN 的視覺品質目標，不是 WCAG 對所有裝飾的要求。是否必要資訊，須按實際用途判定。
- **落地頁插畫白色數字**：保留 DESIGN 記錄的 2026-09-24 owner 例外與 [核准插畫](design-sessions/2026-07-20-landing-page-FINAL-variantB.html)。它不是全面 AA 通過證據；替代文字也不會自動豁免所有可見文字。後續改動若需調整此決策，先討論。
- **焦點 CSS**：保留既有 outline／雙帶及已記錄的 input、menu highlight 等呈現方式，但逐案驗可見性及相鄰色。原生 HIG 的 system focus 建議不代表自訂 CSS outline 自動取得系統偏好；不可因此移除 Day button 的鍵盤焦點。
- **Root／day／filter 語意**：root 是 navigation 中的 links（`aria-current="page"`）；日期是 navigation 中的 buttons（`aria-current`）；篩選為 group 中的 pressed buttons。只有互斥顯示的 tab panels 才使用完整 tablist/tab/tabpanel 契約，參考 [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)。

## 地圖 attribution 與驗證證據

[Google Maps JavaScript API policies](https://developers.google.com/maps/documentation/javascript/policies) 要求適當 attribution 保持可見、可讀，不能移除、遮住或改造。保留 SDK 的 Google／資料提供者標示；safe area、浮動導航、card rail、縮放控制與放大文字不能蓋住它。供應商政策是獨立要求，不由 HIG 品牌例外豁免。若另行呈現 Google 資料，依該 API 與呈現方式的 attribution 規則，不擅自重製 SDK logo 或猜測通用 CSS 尺寸。

[T23／T37 驗收紀錄](implementation/1307-uat.md) 記錄實際 route、HTTP／renderer adapter、production build、computed 對比、鍵盤、320–1440px、200% 文字、安全區及 reduced motion 證據。CDP／viewport 模擬要明示其範圍；SDK attribution adapter 測布局不代表完成真實 SDK attribution 驗證；native pinch clamp 也不能記成已跑到 400%。文件核對、局部自動檢查與全產品符合標準是不同結論。
