## ADDED Requirements

### Requirement: 三環境架構（Production / Staging / Dev）

#### Scenario: Production 環境
- **GIVEN** master branch push
- **THEN** Cloudflare Pages SHALL 自動部署至 https://trip-planner-dby.pages.dev
- **AND** D1 database SHALL 為 trip-planner-db
- **AND** 認證 SHALL 使用 Cloudflare Access（Zero Trust）
- **AND** 監控 SHALL 包含 Sentry + daily-report + Telegram 異常通知

#### Scenario: Staging 環境
- **GIVEN** PR push
- **THEN** Cloudflare Pages SHALL 產生 Preview Deploy
- **AND** D1 database SHALL 為 trip-planner-db-staging（wrangler.toml [env.preview]）
- **AND** 認證 SHALL 使用 Cloudflare Access preview 環境

#### Scenario: Dev 環境
- **GIVEN** npm run dev
- **THEN** Vite SHALL 在 localhost:5173 提供前端
- **AND** wrangler pages dev SHALL 在 localhost:8788 提供 API
- **AND** D1 SHALL 使用本機 SQLite（.wrangler/state/）
- **AND** 認證 SHALL 使用 DEV_MOCK_EMAIL 免 Cloudflare Access

#### Scenario: D1 Migration 流程
- **WHEN** 新增 migration 檔案
- **THEN** SHALL 依序執行：dev（--local）→ staging（--remote）→ production（--remote）
- **AND** production 執行前 SHALL 先 node scripts/dump-d1.js 備份

#### Scenario: CI Pipeline
- **WHEN** PR 建立
- **THEN** GitHub Actions SHALL 執行：
  - npx tsc --noEmit
  - npx tsc --noEmit -p tsconfig.functions.json
  - npm test（frontend 374 tests）
  - npm run test:api（API 153 tests — Miniflare D1）
  - npm run build
  - node scripts/verify-sw.js
