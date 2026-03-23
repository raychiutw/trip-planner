## ADDED Requirements

### Requirement: GitHub Actions CI Pipeline
PR 到 master 時 SHALL 自動觸發 CI pipeline。

#### Scenario: PR 觸發 CI
- **WHEN** 開發者建立 PR 到 master
- **THEN** CI SHALL 執行 tsc + unit test + build + SW 驗證
- **THEN** 全部通過才顯示綠勾

#### Scenario: CI 失敗
- **WHEN** CI 任一步驟失敗
- **THEN** PR SHALL 顯示紅叉，阻止 merge

### Requirement: SW Build 驗證
CI 的 build 步驟後 SHALL 驗證 dist/sw.js 的正確性。

#### Scenario: SW 不應有 navigation fallback
- **WHEN** build 完成
- **THEN** dist/sw.js SHALL 不包含 NavigationRoute 或 createHandlerBoundToURL

#### Scenario: SW 不應 precache Access 保護頁面
- **WHEN** build 完成
- **THEN** dist/sw.js 的 precache manifest SHALL 不包含 manage/ 或 admin/ 的 HTML

### Requirement: 開發流程使用 feature branch
團隊規則 SHALL 要求開發在 feature branch 進行，透過 PR merge 到 master。

#### Scenario: 直接 push master 被阻止
- **WHEN** 團隊成員嘗試直接 push master
- **THEN** 團隊規則 SHALL 明確禁止此行為（可選配 branch protection）
