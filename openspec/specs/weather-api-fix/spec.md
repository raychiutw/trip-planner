# Spec: weather-api-fix

Open-Meteo 天氣 API 超出預報範圍的處理。

## 問題

Open-Meteo forecast API 只提供未來 7~16 天預報。超出範圍時：
- 舊版：silent return，留下 loading 狀態不清除
- 新版：用預設 0 值正常渲染

## 預報範圍檢查

`initWeather(day, dateStr)` 在 fetch 前計算 `dayDiff = dateStr - today`：

| 條件 | 行為 |
|------|------|
| `dayDiff > 16` | 用預設 0 值渲染，不發 API 請求 |
| `dayDiff < 0` | 用預設 0 值渲染，不發 API 請求 |
| fetch 成功但 `dayOffset < 0` | 用預設 0 值渲染（取代舊版 silent return） |
| fetch 成功且有資料 | 正常渲染 |

## 預設 0 值渲染

- 溫度：0°C
- 降雨機率：0%
- 天氣圖示：`weather-clear`（code=0）
- 清除 loading 狀態

## 標題變更

`renderHourly()` 中 `.hourly-weather-title` 文字從「逐時天氣」改為「7日內預報」。
