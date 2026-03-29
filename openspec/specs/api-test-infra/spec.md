## ADDED Requirements

### Requirement: API 測試基礎建設（Miniflare D1）

#### Scenario: 測試 runner 獨立配置
- **GIVEN** vitest.config.api.mts
- **THEN** SHALL 與前端測試（vitest.config.js）完全隔離
- **AND** 前端測試 SHALL 排除 tests/api/**
- **AND** npm run test:api SHALL 只執行 API 測試

#### Scenario: Miniflare D1 singleton
- **GIVEN** tests/api/setup.ts
- **THEN** SHALL 使用 Miniflare programmatic API 建立 D1（非 @cloudflare/vitest-pool-workers）
- **AND** Miniflare 實例 SHALL 為 module-level singleton（整個 test run 共用）
- **AND** migration SHALL 只跑一次（_migrated flag cache）
- **AND** migration SQL 檔案 SHALL cache（_migrationFiles）
- **AND** D1 exec() 不支援多行 SQL，SHALL 用 prepare().run() 逐條執行

#### Scenario: Mock 工具（tests/api/helpers.ts）
- **THEN** SHALL 提供 mockEnv, mockAuth, mockContext, jsonRequest
- **AND** SHALL 提供 callHandler（模擬 middleware catch AppError 行為）
- **AND** SHALL 提供 seedTrip, seedEntry, seedPoi, getDayId
- **AND** seedTrip SHALL 用 INSERT OR IGNORE 避免共用 DB 衝突

#### Scenario: 純函式測試
- **THEN** SHALL 覆蓋 _validate.ts（validateDayBody, validateEntryBody, sanitizeReply, detectGarbledText）
- **AND** SHALL 覆蓋 _middleware.ts（isAllowedOrigin, checkCsrf, checkCompanionScope）
- **AND** SHALL 覆蓋 _audit.ts（computeDiff）
- **AND** SHALL 覆蓋 _utils.ts（json, parseIntParam, buildUpdateClause, getAuth）
- **AND** SHALL 覆蓋 _errors.ts（AppError, errorResponse）

#### Scenario: Integration 測試
- **THEN** SHALL 覆蓋全部 16 個 API handler + reports
- **AND** 每個 handler 至少 happy path + auth 401 + validation 400
- **AND** 測試 SHALL 直接 import handler 函式 + 傳入 mock EventContext

#### Scenario: 已知限制
- **GIVEN** @cloudflare/vitest-pool-workers v0.13.5
- **THEN** SHALL NOT 使用（有 node:os bug — cloudflare/workers-sdk#9719）
- **AND** SHALL NOT 使用 unstable_dev（不適用 Pages Functions）
