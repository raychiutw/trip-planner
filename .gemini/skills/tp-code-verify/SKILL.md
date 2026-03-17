---
name: tp-code-verify
description: 在 commit 前驗證命名規範與測試狀態。掃描 JS/CSS/HTML/API 命名，若有違規則修正直到全部通過。
---

# tp-code-verify

Commit 前程式碼品質驗證。驗證命名規範 + 測試全過，紅燈則持續修改直到綠燈。

## 核心原則

- 自動修正命名違規，不問問題。
- 紅燈持續循環修正，直到 `npm test` 全過。

## 驗證規則來源

- 命名規範：`references/naming-rules.md`
- CSS HIG：`references/css-hig-rules.md`
- 程式碼標準：`references/coding-standards.md`

## 步驟

1. **執行測試**：`npm test`（包含 naming-convention.test.js 和全套 unit/integration 測試）
2. **全過** → 綠燈，可以 commit
3. **有失敗** → 紅燈：
   - 列出所有失敗的測試名稱和錯誤訊息
   - 根據錯誤類型自動修正（命名違規 → 參照 `references/naming-rules.md`；CSS HIG → 參照 `references/css-hig-rules.md`；測試失敗 → 分析原因修正程式碼）
   - 重新跑 `npm test`
   - 重複直到全過

## 驗證項目

| # | 項目 | 參照 |
|---|------|------|
| 1-10 | JS/CSS/HTML/API 命名規範 | `references/naming-rules.md` |
| 11 | CSS HIG 12 條（H1-H12） | `references/css-hig-rules.md` |
| 12 | Unit tests 全過 | — |
| 13-16 | 觸控目標、圖示、無框線、border-radius | `references/coding-standards.md` |
