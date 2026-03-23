## ADDED Requirements

### Requirement: Vite 多入口建置
專案 SHALL 使用 Vite 作為建置工具，配置 4 個 HTML 入口（index.html、setting.html、manage/index.html、admin/index.html），各自 mount 獨立的 React app。

#### Scenario: vite build 產出
- **WHEN** 執行 `vite build`
- **THEN** 產出 4 個 HTML + 對應的 JS/CSS bundle 到 `dist/`

#### Scenario: vite dev 開發
- **WHEN** 執行 `vite dev`
- **THEN** 4 個頁面都可在 localhost 正常瀏覽

### Requirement: TypeScript 設定
專案 SHALL 配置 `tsconfig.json`，啟用 strict mode，JSX 設為 react-jsx。

#### Scenario: 型別檢查通過
- **WHEN** 執行 `npx tsc --noEmit`
- **THEN** 零錯誤

### Requirement: Cloudflare Pages 整合
`vite build` 產出的 `dist/` 目錄 SHALL 可直接部署到 Cloudflare Pages，Pages Functions（`functions/`）不受影響。

#### Scenario: 部署後頁面正常
- **WHEN** push 到 GitHub 觸發 Cloudflare Pages build
- **THEN** 4 個頁面都正常載入，API 正常運作

#### Scenario: Access 路徑保護維持
- **WHEN** 未認證使用者存取 `/manage/` 或 `/admin/`
- **THEN** Cloudflare Access 攔截並顯示登入頁面
