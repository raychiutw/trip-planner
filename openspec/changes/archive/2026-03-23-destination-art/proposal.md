# 目的地視覺藝術 — 提案

## 背景

行程頁缺乏目的地氛圍感。目前 ThemeArt 是依「主題色」（sun/sky/zen 等）產生裝飾圖案，與目的地無關。Key User 要求加入目的地相關的視覺元素。

## 兩項功能

### F-1：DayNav 半透明背景 — SVG 目的地封面

- 每個行程一張 SVG 插畫，當 DayNav sticky nav 的半透明背景
- 內容：代表目的地的地標/風景（沖繩海灘、釜山塔、京都鳥居、板橋老街）
- 風格：簡約線條插畫，低 opacity，不干擾 DayNav pill 的可讀性
- 7 個行程 = 7 張 SVG

### F-2：Day Header 文化圖案 — 取代 ThemeArt

- 每天一張 SVG 插畫，根據當天行程內容動態生成
- 取代現有 ThemeArt 的 DayHeaderArt
- 內容：從當天景點提取文化關鍵字 → 生成對應 SVG（水族館→鯨鯊、首里城→城門）
- 動態生成：/tp-create 或 /tp-edit 時自動產生，不需手動維護

## 實作策略

1. 先做 F-1（7 張靜態 SVG，工程量可控）
2. F-2 較複雜（需要景點→SVG 映射邏輯），F-1 完成後再做
