# API 契約（contracts/openapi.json）

## 單一事實來源

**以 api repo（trip-planner-api）的匯出為準**；`contracts/openapi.json` 是它的逐字複本，web 端不手改。
契約要變，先改 api（schema 與契約測試），合併後再同步到這裡。

## 同步步驟

1. 在 api repo 取得匯出：`createApp().request('/openapi.json')` 的 JSON（或部署環境的 `GET /openapi.json`），
   以 `JSON.stringify(doc, null, 2) + '\n'` 寫成檔案。
2. 覆蓋 `contracts/openapi.json`，執行 `npm run gen:api` 重新產生 `src/api/schema.d.ts`（勿手改）。
3. `npm run typecheck`、`npm run lint`、`npm test`；型別更新若讓前端呼叫端報錯，先處理再提交。
4. 與 api 比對：`node scripts/gen-api.mjs --against <匯出檔或 URL>`。

## 檢查分工

- `npm run check:api-contract`（CI）：只保證 `schema.d.ts` 與 `contracts/openapi.json` 一致；CI 沒有 api repo，擋不到「契約檔本身落後 api」。
- `--against`（手動，發版前或 api 契約變動後跑）：保證契約檔與 api 匯出一致。

## 為何不是「各自維護」

兩邊各改會再次漂移（本檔曾落後 api 上千行）；api 的契約測試會驗證實際回應符合匯出的 schema，所以它才是會被執行驗證的那一份。
