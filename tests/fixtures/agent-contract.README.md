# agent-contract.json

`trip-planner-agent` 產生的契約快照（agent issue #5：單一 repo 的 CI 看不到對方）。與 trip-planner-api 的 `tests/fixtures/agent-contract.json` 是同一份，**不可手改**。

- 來源 repo：`raychiutw/trip-planner-agent`
- 來源 commit：`cc03e66bb5e6faf6163f22c3c41830e0e304f648`（`contract/api-contract.json`；經 trip-planner-api 的同名快照複製）
- 為何用快照：CI 不依賴任何網路（production 或 agent repo）；agent 端的測試在快照過期時會轉紅，所以快照與 agent 同步由 agent 端負責。
- 驗證：`tests/api/agent-contract.test.ts`（守 `apiErrors` 排除字串 ↔ web 實際寫入 `api_logs.error` 的組字、三個幽靈預算 key 不得回來）

## 更新方式

1. 在 agent repo 執行 `npm run export:contract`。
2. 把 `contract/api-contract.json` 複製成本檔 `tests/fixtures/agent-contract.json`（與 trip-planner-api 同步）。
3. 更新上面的「來源 commit」。
4. 執行 `npm run test:api -- tests/api/agent-contract.test.ts`：測試轉紅代表 web 與 agent 的假設已漂移，請修 web 或 agent，不要弱化測試。

快照內不得含個資（email、chat id、tailnet 名、token）；agent repo 是公開的。
