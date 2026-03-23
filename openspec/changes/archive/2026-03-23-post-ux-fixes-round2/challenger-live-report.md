# Challenger Live UX Report — Round 2

> Site: https://trip-planner-dby.pages.dev/
> Date: 2026-03-20
> Viewports tested: 390x844 (mobile), 1280x800 (desktop)
> Trip: okinawa-trip-2026-Ray (Deep Ocean theme)

---

## UX (1-5)

### 1. 首頁第一印象

**嚴重度: 🟢 PASS**

首頁資訊層級清楚：
- DayNav pill 在最上方，清楚顯示日期（7/29, 7/30 ...）
- Day header 區塊含插圖、日期、區域名稱
- 注意事項黃卡醒目
- 天氣/飯店/交通 info card 分區明確
- 時間軸卡片有序號、時間標籤

桌面版有右側面板（倒數天數、今日行程摘要、行程統計），資訊更豐富。

截圖: `screenshots/01-mobile-homepage.png`, `screenshots/17-desktop-homepage.png`

### 2. SpeedDial

**嚴重度: 🟢 PASS**

- 展開後顯示 2x4 grid，8 個項目（航班、出發、緊急、備案、建議、路線、交通、設定）
- Label 易讀（中文）、icon 有辨識度
- 開啟有 backdrop 遮罩，點擊 backdrop 可關閉
- `aria-label="快速選單"` 可及性良好

截圖: `screenshots/02-mobile-speeddial-open.png`, `screenshots/08-speeddial-open-day2.png`

### 3. DayNav

**嚴重度: 🟢 PASS**

- 切天順暢，URL hash 會更新（#day1 -> #day2）
- Active pill 有明顯的填色區分
- Active pill 下方顯示區域名稱 label（如「浮潛・瀨底」）
- 點擊後頁面平滑捲動到對應 Day section

截圖: `screenshots/06-daynav-day2.png`

### 4. Bottom Sheet / InfoSheet

**嚴重度: 🟢 PASS**

- SpeedDial → 「交通」成功開啟 InfoSheet dialog
- Sheet 有 drag handle 區域（頂部）
- X 按鈕（關閉）位於右上角，足夠大
- 內容可捲動，顯示 5 天交通統計
- 關閉後回到原位置

截圖: `screenshots/09-infosheet-transport.png`

### 5. 設定頁

**嚴重度: 🟢 PASS**

- 主題切換直覺：淺色/自動/深色 三個卡片式按鈕
- 6 個色彩主題有明確的色彩 swatch 區分
- 選中狀態有邊框高亮指示
- 行程清單顯示行程名稱、日期範圍、擁有者

截圖: `screenshots/11-settings-page.png`, `screenshots/12-settings-fullpage.png`

---

## 視覺 (6-9)

### 6. 無框線設計

**嚴重度: 🟢 PASS**

- Timeline 卡片（tl-card）無可見 border — 已程式化驗證 36 張卡片全部通過
- 飯店展開後的 info card 使用 left-border 作為區段指示（停車場、推薦購物），這是有意設計
- 未發現任何不應出現的 border

### 7. 字體層級

**嚴重度: 🟢 PASS**

字體層級合理：
| 元素 | 大小 | 粗細 |
|------|------|------|
| nav-brand（Trip title） | 20px | 700 |
| H2（Day header） | 22px | 700 |
| day-label | 17px | 400 |
| tl-card-header | 17px | 400 |
| stats-card-title | 20px | 700 |
| sheet-title | 20px | 700 |

標題/內文/caption 有清楚的層級區分。

### 8. 間距

**嚴重度: 🟢 PASS**

- 卡片間距一致，無過擠或過鬆
- Day header 與內容區之間有適當留白
- 飯店 info card 展開後的內部間距合理

### 9. 暗色模式

**嚴重度: 🟢 PASS**

- 暗色模式對比度充足，文字清晰可讀
- Day header 插圖自動切換為夜空+月亮版本
- 卡片背景、時間軸標籤、DayNav pill 都有對應的深色配色
- 設定頁在暗色模式下同樣清晰
- 色彩主題 swatch 在深色背景上可辨識

截圖: `screenshots/13-dark-mode-settings.png`, `screenshots/14-dark-mode-trip.png`, `screenshots/15-dark-mode-bottom.png`

---

## 操作 (10-12)

### 10. 按鈕可用性

**嚴重度: 🟢 PASS**

所有測試的按鈕都能正常點擊：
- DayNav pills（5 天全部可切換）
- SpeedDial trigger（開/關切換）
- SpeedDial 項目（交通→開啟 InfoSheet、航班→導航至 edit 頁）
- InfoSheet 關閉按鈕
- 設定頁的關閉按鈕
- 主題切換按鈕（淺/自動/深 + 6 個色彩主題）
- 飯店 info card 展開/收合
- Scroll-to-top 按鈕

### 11. Sheet 開關

**嚴重度: 🟢 PASS**

- SpeedDial → 交通 → InfoSheet 正常開啟
- InfoSheet X 按鈕正常關閉
- 飯店 info card 展開/收合切換正常（「＋」↔「－」 icon 切換）

### 12. 捲動流暢度

**嚴重度: 🟢 PASS**

- 頁面捲動無卡頓（通過 Playwright 自動化測試）
- DayNav 切天時的捲動平滑
- InfoSheet 內容可獨立捲動

---

## 相容性 (13)

### 13. 手機版 390x844 + 桌面版 1280x800

**嚴重度: 🟢 PASS**

**手機版 (390x844)**:
- 全寬單欄佈局
- SpeedDial FAB 固定在右下角
- DayNav 水平滑動
- 卡片全寬顯示

**桌面版 (1280x800)**:
- 雙欄佈局：左側行程時間軸 + 右側資訊面板
- 右側面板含倒數天數（131 天）、今日行程摘要、行程統計
- DayNav pills 橫排顯示，空間充裕
- SpeedDial FAB 位置合理

截圖: `screenshots/17-desktop-homepage.png`, `screenshots/18-desktop-fullpage.png`

---

## 發現的潛在問題

### P1. 設定頁行程列表缺少 2 個行程
**嚴重度: 🟡 MEDIUM**

設定頁只顯示 5 個行程（AeronAn, HuiYun, Onion, Ray, CeliaDemyKathy），但 MEMORY.md 記錄有 7 個行程。缺少：
- `okinawa-trip-2026-RayHus`
- `kyoto-trip-2026-MimiChu`

可能原因：這兩個行程尚未 build 到 dist，或 trips.json registry 未包含。

### P2. SpeedDial「航班」項目導航行為不一致
**嚴重度: 🟡 MEDIUM**

點擊 SpeedDial「航班」會導航到 `/edit` 頁面，而其他項目（如「交通」）是開啟 InfoSheet。使用者可能預期所有 SpeedDial 項目都在同一頁面操作。應考慮在 label 上加上視覺區分（如外部連結 icon）或統一行為。

### P3. DayNav active pill 的區域 label 需捲動才可見
**嚴重度: 🟢 LOW**

Active pill 下方的區域名稱 label（如「北谷」、「浮潛・瀨底」）在初始載入時需要展開的 pill 才看得到子 label。非 active pills 只顯示日期數字。這是設計意圖但初次使用者可能不知道 pill 代表什麼區域。

---

## 總結

整體 UX 品質**優良**。經過多輪修復，主要功能（DayNav、SpeedDial、InfoSheet、主題切換、暗色模式）都運作正常。無框線設計一致、字體層級清楚、間距合理。手機版與桌面版的響應式佈局都表現良好。

唯一值得關注的是設定頁缺少 2 個行程（P1）和 SpeedDial 導航行為不一致（P2）。
