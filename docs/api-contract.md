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

## web 呼叫守衛（`tests/unit/web-api-contract.test.ts`）

掃 `src` 內所有 `apiFetch`／`apiFetchRaw` 呼叫，驗證路徑＋method 都在 `contracts/openapi.json`，且行內 `JSON.stringify({...})` 的 body 涵蓋契約 requestBody 的必填欄位。api 改名／移除端點或新增必填欄位，同步契約檔後這支測試會指出 web 哪個檔案還在用舊的。

- 涵蓋不到：變數組成的路徑、非行內的 body、回應欄位、query 參數。
- `KNOWN_GAPS` 是有理由的已知落差（目前只有旗標關閉時的舊入口帳密登入）；每筆都有「仍是落差」的反向檢查，過期會轉紅。
- 更新快照：照上面「同步步驟」覆蓋 `contracts/openapi.json`；測試失敗代表 web 與新契約漂移，修 web 呼叫端，不要弱化測試。

## 目前快照

`contracts/openapi.json` 取自 production `GET https://trip-planner-api-production.lean-lean.workers.dev/openapi.json`（2026-11-08，117 條路徑）。更新指令：`curl -sS <上述網址> -o /tmp/o.json && node -e "const fs=require('fs');fs.writeFileSync('contracts/openapi.json',JSON.stringify(JSON.parse(fs.readFileSync('/tmp/o.json','utf8')),null,2)+'\\n')" && npm run gen:api`，再跑 `npm run check:api-contract` 與測試。
