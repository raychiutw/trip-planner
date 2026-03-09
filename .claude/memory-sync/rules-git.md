# Git 規則

- **不自動 commit 也不自動 push**，由使用者明確要求或 `/tp-deploy` 觸發
- Commit 訊息繁體中文，格式：
  ```
  簡述改了什麼

  - 細節說明

  Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
  ```
- pre-commit hook（`.git/hooks/pre-commit`）自動根據 staged 檔案跑對應測試
- push 後檢查本次變更是否影響專案規則或架構，若有則同步更新 `CLAUDE.md` 與 `openspec/config.yaml`
