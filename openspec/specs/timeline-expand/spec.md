# Spec: timeline-expand

Timeline 事件預設全展開。

## 行為變更

| 項目 | 修改前 | 修改後 |
|------|--------|--------|
| `.tl-event` | 預設收合 | 預設帶 `expanded` class |
| `.tl-body` | `display: none` | `display: block` |
| `.tl-head` | 帶 `.clickable` + click handler | 不可點擊 |
| `.tl-arrow`（+/−） | 存在 | 移除 |
| `initAria()` | 設定 `aria-expanded` | 不再設定 |

## 到達旗標時間範圍

`renderTimelineEvent()` 的到達旗標（`.tl-flag-arrive`）同時顯示到達與離開時間。若 `parsed.end` 存在，旗標顯示格式為 `<start>-<end>`（如 `16:30-18:30`）。若無離開時間，僅顯示到達時間。

獨立離開旗標（`.tl-flag-depart`）已移除，離開時間併入到達旗標。

Transit 方向箭頭（`.tl-transit-arrow`）已移除，為純裝飾元素無互動功能。

## 保留的收合機制

以下元件不受影響，維持原有收合行為：

- `.col-row` / `.col-detail`（住宿、交通統計等）
- `.hw-summary` / `.hw-detail`（逐時天氣）
