## Context

API 端點存在大量重複程式碼（json helper 15 次、Env/AuthData 重複宣告），CSS 主題 token 在 light mode 不完整，建置配置有分類錯誤和 type checking 缺口。

## Goals / Non-Goals

**Goals:**
- 抽取 API 共用模組減少重複
- 補齊 CSS 主題 token
- 修正 package.json 依賴分類
- 擴展 type checking 到 functions/

**Non-Goals:**
- 不重構 API handler 架構
- 不改 CSS 架構（仍用原生 CSS）
- 不加 manualChunks（影響小，移至後續）

## Decisions

### D1. API 共用模組

新增 `functions/api/_utils.ts`：
```typescript
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
```

新增 `functions/api/_types.ts`：
```typescript
export interface Env { DB: D1Database; ADMIN_EMAIL: string; ... }
export interface AuthData { email: string; isAdmin: boolean; isServiceToken: boolean; }
```

所有 API handler 改為 import 使用。

### D2. CSS 主題 token 補齊

需要在 5 個 light theme（zen, forest, sakura, night, sky）中補上：
- `--color-badge-open`
- `--color-badge-closed`
- `--color-plan-bg`
- `--color-plan-text`
- `--color-plan-hover`

值根據各主題的色調調整，確保對比度。

### D3. tsconfig.functions.json

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["functions/**/*"],
  "exclude": []
}
```

在 package.json 中加入 `"typecheck:functions": "tsc --noEmit -p tsconfig.functions.json"`。

## Risks / Trade-offs

- **[Risk] 大量檔案 import 修改** → Mitigation：用 replace_all 批次修改，tsc 會捕捉遺漏
- **[Risk] functions tsconfig 可能有 type 衝突** → Mitigation：先用 `--noEmit` 測試，逐步修正
