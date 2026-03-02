# timeline-and-weather

時間軸事件預設全展開 + 天氣 API 修復。

## 範圍（全裝置）

### Timeline 展開
- tl-event 預設展開，移除 +/- 按鈕和點擊收合功能
- 交通統計（col-row）和逐時天氣（hw）保留收合不動

### 天氣 API 修復
- Open-Meteo forecast API 只提供未來 7~16 天預報
- 超出預報範圍時：用 0 作為預設值正常渲染（0°C、0%、晴天圖示），清除 loading 狀態
- fetch 成功但找不到日期：同上用預設 0 值渲染
- 「逐時天氣」標題改為「7日內預報」
