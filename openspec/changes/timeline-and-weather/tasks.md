# Tasks: timeline-and-weather

## Timeline 預設展開

- [x] js/app.js：render timeline event 時預設加上 `expanded` class，移除 `＋` / `－` 箭頭
- [x] js/app.js：移除 `.tl-head.clickable` 的 click handler（`toggleEv` 相關）
- [x] css/style.css：`.tl-event` 預設顯示展開狀態，移除收合相關 CSS（`.tl-arrow` 等）

## 天氣 API 修復

- [x] js/app.js `initWeather()`：fetch 前先檢查日期是否在預報範圍（today + 16 天），超出範圍直接用預設 0 值渲染，不發 API 請求
- [x] js/app.js `initWeather()`：fetch 成功但 `dayOffset < 0`（日期不在回傳資料中）時，改用預設 0 值渲染而非 silent return
- [x] js/app.js `renderHourly()`：確保 0 值能正常渲染（temp=0、rain=0、code=0 → weather-clear icon）
- [x] js/app.js：「逐時天氣」文字改為「7日內預報」（renderHourly 中的 `.hourly-weather-title`）
