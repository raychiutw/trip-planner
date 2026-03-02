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

## 保留的收合機制

以下元件不受影響，維持原有收合行為：

- `.col-row` / `.col-detail`（住宿、交通統計等）
- `.hw-summary` / `.hw-detail`（逐時天氣）
