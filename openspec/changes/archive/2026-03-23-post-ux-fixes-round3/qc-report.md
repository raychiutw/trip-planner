# QC Report — post-ux-fixes Round 3

**日期**：2026-03-20
**測試環境**：http://localhost:3000/
**視窗規格**：手機 390×844、桌面 1280×800、小手機 320×568

---

## 1. SpeedDial 4×2 佈局

**截圖**：`qc-02-speeddial-open-mobile.png`（390×844）、`qc-03-speeddial-320px.png`（320×568）

| 檢查項目 | 結果 |
|---|---|
| 展開後左欄 4 個 icon 可見 | PASS — index 0-3 均在 x=208（390px）/ x=138（320px），可見 |
| 右欄 label 不遮擋左欄 icon | PASS — 左欄 labelRight=200, iconLeft=218（間距 18px）；右欄 labelRight=316, iconLeft=334（間距 18px） |
| label 為 pill 樣式 | PASS — borderRadius:99px、有 background、boxShadow:rgba(46,36,24,0.12) 0px 4px 16px |
| 320×568 無溢出 | PASS — 所有 label left >= 80，無負值溢出 |

**整體判定：PASS**

---

## 2. InfoPanel 桌面版

**截圖**：`qc-04-desktop-1280.png`、`qc-05-infopanel-desktop.png`（1280×800）

| 檢查項目 | 結果 |
|---|---|
| 面板寬度加大 | PASS — width=350px，left=920px |
| 倒數天數已移除 | PASS — panel 文字無「倒數」、「天後」 |
| 車程統計已移除 | PASS — panel 無「總計」、「統計」、「合計」欄位 |
| 飯店資訊顯示 | PASS — 「Vessel Hotel Campana Okinawa / 退房：11:00」可見 |
| 當日交通顯示 | PASS — 開車、電車 15m、步行 6m 可見 |
| 地圖連結 G 可見 | PASS — 7 個 G 連結對應各行程項目 |
| 地圖連結 N 可見 | **FAIL** — 面板內 N（Apple/Naver）連結 count=0，僅有 G 連結 |

**整體判定：FAIL（N 連結缺失）**

> 備註：右側面板行程列表每行只有 `G`，無 `N` 或 Apple Map 連結。需確認設計規格是否要求 N 連結，或 G 已足夠。

---

## 3. DayNav

**截圖**：`qc-06-daynav-mobile.png`（390×844）

| 檢查項目 | 結果 |
|---|---|
| active label 已移除 | PASS — `.dn.active` 只有 `7/29` 文字，無子元素 label |
| pill 下方乾淨 | PASS — 視覺確認無額外文字或空白殘留 |

**整體判定：PASS**

---

## 4. 設定頁

**截圖**：`qc-07-setting-mobile.png`（390×844）

| 檢查項目 | 結果 |
|---|---|
| ← 返回箭頭已移除 | PASS — 頁首左側無返回箭頭 |
| 只剩 X 關閉按鈕 | PASS — 右上角只有 × 按鈕（`button "關閉"`） |

**整體判定：PASS**

---

## 5. hover padding

**截圖**：`qc-08-hover-padding.png`（1280×800）

| 檢查項目 | 結果 |
|---|---|
| 滑鼠 hover 行程列表項色塊空間 | PASS — padding:8px 12px、height:40px、borderRadius:8px，色塊不擠 |
| CSS hover 規則存在 | PASS — `.today-summary-item:hover { background: var(--color-hover); }` |

**整體判定：PASS**

---

## 6. Bottom Sheet X 按鈕大小

**截圖**：`qc-09-bottomsheet-xbtn.png`（390×844）

| 檢查項目 | 結果 |
|---|---|
| X 按鈕大小 44px | PASS — `.sheet-close-btn` width=44px, height=44px |

**整體判定：PASS**

---

## 總結

| 項目 | 判定 |
|---|---|
| 1. SpeedDial 4×2 佈局 | PASS |
| 2. InfoPanel 桌面版 | **FAIL** — N 連結缺失（待確認規格） |
| 3. DayNav | PASS |
| 4. 設定頁 | PASS |
| 5. hover padding | PASS |
| 6. Bottom Sheet X 按鈕 | PASS |

**5 PASS / 1 FAIL**

**FAIL 詳情**：InfoPanel 右側面板今日行程列表中，每個行程項只顯示 `G`（Google Maps）連結，無 `N`（Naver/Apple Maps）連結。若設計規格要求同時顯示 (G)(N)，需工程師補實作。若規格只要求 G，則此項可改判 PASS。
