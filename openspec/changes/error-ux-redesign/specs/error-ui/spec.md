## error-ui

### Requirements
1. `src/lib/errors.ts` export ApiError class + 錯誤分類引擎（code → 嚴重度）
2. `src/hooks/useApi.ts` 改造：解析結構化錯誤 body，NET_* 前端產生
3. `src/components/shared/Toast.tsx` 重寫：頂部滑入、可堆疊、3 秒消失、tokens.css color、`role="alert"`
4. `src/components/shared/ErrorPlaceholder.tsx` 新增：原位錯誤提示 + 重新整理文字 + 內嵌 ReportButton
5. `src/hooks/useTrip.ts` 改寫：day/doc 載入失敗 → ErrorPlaceholder + Toast（不再靜默）
6. 嚴重度分層：輕微=只 ErrorPlaceholder / 中等=ErrorPlaceholder+Toast / 嚴重=全頁降級 / 背景=只 Toast
7. HTTP 對應：401 公開頁=Toast 不中斷 / 404 行程=全頁 / 500=每個獨立 Toast

### Acceptance Criteria
- Day 載入失敗時使用者看到 ErrorPlaceholder（非空白）
- 多個 500 產生多個獨立 Toast
- Toast 3 秒後自動消失
- 所有錯誤訊息為繁體中文
