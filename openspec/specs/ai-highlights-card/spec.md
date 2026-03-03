## ADDED Requirements

### Requirement: highlights JSON 資料結構

Trip JSON SHALL 包含 `highlights` 頂層欄位，結構如下：

```json
{
  "highlights": {
    "title": "AI行程亮點",
    "content": {
      "summary": "100-200 字的行程摘要分析",
      "tags": ["標籤1", "標籤2", ...]
    }
  }
}
```

`highlights` 為必填欄位，`validateTripData()` SHALL 在缺少時產生 error。

#### Scenario: highlights 欄位存在且完整

- **WHEN** trip JSON 包含完整的 highlights 欄位（title、content.summary、content.tags）
- **THEN** 驗證 SHALL 通過，不產生錯誤

#### Scenario: highlights 欄位缺失

- **WHEN** trip JSON 缺少 highlights 欄位
- **THEN** `validateTripData()` SHALL 回傳 error「缺少 highlights」

### Requirement: highlights 卡牌渲染

`renderHighlights(data)` SHALL 渲染 AI行程亮點卡牌，包含：
1. 摘要段落：顯示 `content.summary` 文字
2. 標籤列：水平排列的 pill 標籤，顯示 `content.tags` 陣列

#### Scenario: 渲染完整 highlights

- **WHEN** highlights 資料包含 summary 和 3 個 tags
- **THEN** 卡牌 SHALL 顯示摘要段落，下方顯示 3 個 pill 標籤

#### Scenario: 無 tags

- **WHEN** highlights 資料包含 summary 但 tags 為空陣列
- **THEN** 卡牌 SHALL 僅顯示摘要段落，不顯示標籤列

### Requirement: highlights 標籤樣式

每個標籤 SHALL 使用 pill 樣式：
- 圓角背景（border-radius: 99px）
- 背景色：`color-mix(in srgb, var(--accent) 12%, transparent)`
- 文字色：`var(--accent)`
- 字體大小：`var(--fs-sm)`
- 水平排列，flex-wrap

#### Scenario: 標籤 pill 外觀

- **WHEN** 渲染 highlights 標籤
- **THEN** 每個標籤 SHALL 顯示為圓角 pill，使用 accent 色系
