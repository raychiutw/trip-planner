# Design: timeline-and-weather

## 架構決策

### Timeline 展開策略

- `.tl-event` 預設帶 `expanded` class，`.tl-body` 直接 `display: block`
- 移除 `+` / `−` 箭頭（`.tl-arrow`）與 `.tl-head.clickable` click handler
- 交通統計（`.col-row` / `.col-detail`）與逐時天氣（`.hw-summary`）保留可收合不動
- `initAria()` 不再對 `.tl-head` 設定 `aria-expanded`

### 天氣 API 防禦邏輯

Open-Meteo forecast API 只提供未來 7~16 天預報，需處理超出範圍的情況。

```
initWeather(day, dateStr)
  ├─ 計算 dayDiff = dateStr - today
  ├─ dayDiff > 16 或 dayDiff < 0
  │    → 直接用預設 0 值渲染（temp=0, rain=0, code=0）
  │    → 不發 API 請求
  ├─ fetch 成功但 dayOffset < 0
  │    → 用預設 0 值渲染（舊版會 silent return）
  └─ fetch 成功且有資料
       → 正常渲染
```

- 預設 0 值渲染：溫度 0°C、降雨 0%、天氣圖示 weather-clear
- `renderHourly()` 標題從「逐時天氣」改為「7日內預報」
- 清除 loading 狀態，不顯示錯誤提示

## 檔案影響

| 操作 | 檔案 |
|------|------|
| 修改 | `js/app.js`（renderTimelineEvent, initWeather, renderHourly, initAria） |
| 修改 | `css/style.css`（tl-body 預設展開, 移除 tl-arrow/clickable 樣式） |
