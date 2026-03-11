## 1. Issue 列表卡片化

- [x] 1.1 `.issue-list` 加 `gap: 8px`
- [x] 1.2 `.issue-item` 加 `background: var(--bg-secondary)` + `border-radius: var(--radius-md)` + `padding: 12px 16px` + hover transition
- [x] 1.3 `.issue-item-header` 加 `flex-wrap: wrap`

## 2. Badge 與文字精緻化

- [x] 2.1 `.issue-badge` font-size 改為 `var(--fs-caption)`
- [x] 2.2 `.issue-badge.open` 色值改為 `#1A7F37`，`.closed` 改為 `#6E40C9`
- [x] 2.3 新增 `body.dark .issue-badge.open` (`#2EA043`) 和 `.closed` (`#8B5CF6`)
- [x] 2.4 `.issue-item-body` margin-top 改為 `8px`
- [x] 2.5 `.issue-item-meta` margin-top 改為 `8px`，font-size 改為 `var(--fs-caption)`

## 3. Reply 分隔與空白狀態

- [x] 3.1 `.issue-reply` 加 `border-top: 1px solid var(--border)` + `padding-top: 12px`，margin-top 改為 `12px`
- [x] 3.2 `.edit-issues-loading, .edit-issues-empty` 加 `background: var(--bg-secondary)` + `border-radius: var(--radius-md)`，font-size 改為 `var(--fs-callout)`，padding 改為 `32px 16px`

## 4. Input 區與 Mode Pill

- [x] 4.1 `.edit-input-card` background 改為 `var(--bg-secondary)`
- [x] 4.2 刪除 `body.dark .edit-input-card` 規則
- [x] 4.3 `.edit-mode-pill.selected` 背景改為 `var(--accent-bg)`，文字色改為 `var(--accent)`

## 5. Send Button 與 Nav

- [x] 5.1 `.edit-send-btn` transition 加 `transform var(--duration-fast)`
- [x] 5.2 `.edit-send-btn:disabled` 加 `transform: scale(0.92)`，`:not(:disabled)` 加 `transform: scale(1)`
- [x] 5.3 `.chat-container .sticky-nav::before` width 改為 `var(--tap-min)`

## 6. 間距調整

- [x] 6.1 `@media (min-width: 768px) .chat-messages-inner` padding-top 改為 `24px`
- [x] 6.2 `.edit-input-bar` 加 `padding-bottom: max(16px, env(safe-area-inset-bottom, 16px))`

## 7. 驗證

- [x] 7.1 `npm test` 確認 css-hig.test.js 12 條規則全過
- [x] 7.2 本機開啟 edit.html 視覺檢查 light/dark 模式
