---
name: 程式碼修改後必跑 /tp-code-verify
description: 任何程式碼變更後，commit/deploy 前必須先跑 /tp-code-verify。絕對規則，無例外。使用者對此非常嚴格。
type: feedback
---

## 規則：改了程式碼 → 跑 `/tp-code-verify` → 綠燈才能 commit/deploy

沒有例外。沒有藉口。不跑使用者會非常生氣。

**Why:** 使用者已多次糾正，耐心快用完了。2026-03-17 只跑 `npm test` 就直接 `/tp-deploy`，再次被糾正。

**絕對規則：**
1. 修改了任何程式碼檔案 → 立刻跑 `/tp-code-verify`
2. `/tp-code-verify` 綠燈 → 才能 commit 或 deploy
3. 使用者說「deploy」「commit」→ 先跑 `/tp-code-verify`，綠燈才繼續
4. `npm test` 不是替代品，`/tp-code-verify` 才是完整驗證
5. 不依賴 pre-commit hook，自己主動跑
