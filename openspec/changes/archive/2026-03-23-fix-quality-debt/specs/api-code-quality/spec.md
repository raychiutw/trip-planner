## ADDED Requirements

### Requirement: API 共用 json helper
所有 API handler SHALL import `json()` from `_utils.ts`，移除各自的本地定義。

#### Scenario: json helper 回傳正確格式
- **WHEN** 呼叫 `json({ ok: true }, 200)`
- **THEN** Response SHALL 有 `Content-Type: application/json` header
- **THEN** body SHALL 為 `{"ok":true}`

### Requirement: API 共用 Env 和 AuthData interface
所有 API handler SHALL import `Env` 和 `AuthData` from `_types.ts`，移除各自的本地定義。

#### Scenario: 型別一致性
- **WHEN** `npx tsc --noEmit` 執行
- **THEN** 所有 API handler SHALL 通過型別檢查，無重複宣告警告

### Requirement: functions/ type checking
`functions/` 目錄 SHALL 有獨立的 `tsconfig.functions.json`，可透過 `npm run typecheck:functions` 執行 type checking。

#### Scenario: type check functions
- **WHEN** 執行 `npx tsc --noEmit -p tsconfig.functions.json`
- **THEN** SHALL 成功完成，無型別錯誤

### Requirement: package.json 依賴分類正確
`@types/react`、`@types/react-dom`、`typescript` SHALL 在 `devDependencies` 而非 `dependencies`。

#### Scenario: production install 不含 type-only packages
- **WHEN** 檢查 `package.json` 的 `dependencies`
- **THEN** SHALL 不包含 `@types/*` 或 `typescript`
