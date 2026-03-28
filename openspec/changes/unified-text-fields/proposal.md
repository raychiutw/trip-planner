# Proposal: 統一文字欄位名稱 + Markdown 渲染

## 問題

1. **欄位名稱不一致**：同樣是「描述」，entries 叫 `body`、hotels 叫 `details`、restaurants 叫 `description`
2. **同名不同義**：`note` 在 shopping 是描述，在 hotels/entries 是注意事項
3. **`\n` 被忽略**：Hotel details、parking note 等含換行的文字被 HTML 吃掉，無法分段
4. **渲染不統一**：只有 entry.note、entry.description、restaurant.description 用 MarkdownText，其他都是裸文字

## 目標

- DB 欄位名稱語意統一
- 所有「給人看的文字」欄位支援 markdown 渲染
- 前端統一用 `MarkdownText` 元件
- 不破壞現有資料，向下相容
