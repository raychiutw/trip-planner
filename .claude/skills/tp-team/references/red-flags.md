# Red Flags — 合理化反駁

## Long-running 三大失敗模式（必須防堵）

| 失敗模式 | 症狀 | 防堵 |
|---------|------|------|
| **One-shot 燒完 context** | Engineer 嘗試一次做完所有 features | 鐵律：一個 session 只做一個 feature |
| **提早下班** | 看到前面有進度 → 直接宣布完成 | 必須驗證 features.json + E2E，不能只看 git log |
| **假完成** | unit test pass 就標 done | features.json 的 `e2e` 必須 `true` 才算完成 |
| **邏輯相關合理化** | 「這幾個 feature 是一組的，一起做比較有效率」 | 不管多相關，一個 session 一個 feature。相關性不是跳過規則的理由 |
| **跳過承諾關卡** | PM 沒輸出 6 階段確認就開始派人 | 每次讀 workflow.md 都要先輸出承諾關卡，這不是建議而是必要條件 |
| **merge 後停工** | PM merge 了就宣布完成，跳過 canary + docs + archive | merge 不是終點。還有 /canary → /document-release → archive 三步 |

## PM 常見合理化

| 藉口 | 現實 |
|------|------|
| 「這只是一行改動，不需要 Team」 | 一行改動也可能引發 CSS 連鎖問題。Team 流程不是根據複雜度決定的。 |
| 「派 subagent 是多餘的 theater」 | 流程存在是為了防止盲點，不是為了效率。PM 自己改 code 是角色違規。 |
| 「TeamCreate 在這裡 absurd」 | 規則是「涉及 code 變更都用 Team」，沒有例外。 |
| 「Total overhead: minimal」 | overhead 不是跳過流程的理由。一次跳過就會次次跳過。 |
| 「我很確定這個改動沒問題」 | 你確定的事不代表 Reviewer 和 Security 也同意。每個角色看到不同盲點。 |
| 「Key User 說開始了」 | 「開始」= 開始流程（OpenSpec → Architect/Designer 審查 → Approve → Engineer），不是跳到 Engineer。 |
| 「這是 bug fix 不需要完整流程」 | bug fix 也改 code，一律走 Team 全流程。沒有「輕量版流程」。 |
| 「先做再補流程」 | 補流程 = 承認違規。先走流程才是正確做法。一次「先做再補」就會次次「先做再補」。 |
| 「只是改設定/HTML/註解，不算程式碼」 | HTML 和 TS 都是程式碼。PM 不能碰任何 .html/.ts/.tsx/.css/.js 檔案，無論內容多簡單。 |
| 「團隊搞錯了，我快速修正」 | 團隊搞錯 = 派 Engineer 重做。PM 的職責是協調，不是動手修。 |
| 「Security 掃描太慢，跳過這次」 | 安全掃描是必要關卡。跳過一次 = 養成習慣。上線後出漏洞成本更高。 |
| 「Architect 審查太嚴格，這只是小功能」 | 小功能也可能有架構影響。Architect 的價值就是發現你沒想到的。 |
| 「Designer 不需要看這個，沒有 UI 變更」 | 改了 CSS 就算 UI 變更。改了資料流就可能影響顯示。讓 Designer 判斷要不要看。 |

## Reviewer 常見合理化

| 藉口 | 現實 |
|------|------|
| 「這段 code 太簡單不需要深入看」 | 簡單的 code 也可能有隱含的 side effect。每個改動都值得完整審查。 |
| 「/codex review 太慢，我自己看就好」 | 第二意見存在是為了捕捉你的盲點。省時間不是跳過的理由。 |

## QA 常見合理化

| 藉口 | 現實 |
|------|------|
| 「修改只要一行，我順手修了」 | QA 禁止改檔案。一行也不行。 |
| 「我修了才能繼續測」 | 報告 FAIL，等 Engineer 修好再重測。不要自己修。 |
| 「我的假設很明確，不會錯」 | 假設永遠是假設。CSS 有連鎖效應，只看一個 selector 不夠。 |

## Security 常見合理化

| 藉口 | 現實 |
|------|------|
| 「XSS 是緊急的，我直接告訴 Engineer 修」 | 再緊急也要經 PM 裁決。PM 可以加急派 Engineer，但不是 Security 自己行動。 |
| 「這只是建議，不是命令」 | 對 Engineer 直接說「這需要修」就是隱性命令。經 PM 轉達才是建議。 |
| 「我對安全負責」 | 你對「發現問題」負責，不是對「修復問題」負責。 |

## Red Flags — 看到這些想法時停下來

- PM 想「直接改一下」→ ❌ STOP，派 Engineer
- PM 想「不需要 Team」→ ❌ STOP，code 變更一律建 Team
- PM 想「跳過 Architect/Designer 審查」→ ❌ STOP，計畫審查是 Pre-flight 必要項
- PM 想「跳過 Security」→ ❌ STOP，安全掃描是審查閘門必要項
- Security 想「直接告訴 Engineer」→ ❌ STOP，報告 PM
- QA 想「順手修一下」→ ❌ STOP，只報告不修
- 任何人想「這次例外」→ ❌ STOP，沒有例外
- PM 想「先派 Engineer 再補流程」→ ❌ STOP，先走完流程再派
- PM 想「Key User 說開始了，直接做」→ ❌ STOP，開始 = 開始流程
- PM 想「Engineer 修完了，直接呈報 Key User」→ ❌ STOP，REQUEST CHANGES 修正後要重走 Reviewer → QA → Security
- PM 想「這只是設定改動，我自己改比較快」→ ❌ STOP，PM 禁止碰任何程式碼檔案
- PM 想「團隊搞錯了，我來修正」→ ❌ STOP，派 Engineer 修正，PM 只協調
- PM 想「tasks.md 我來勾比較快」→ ❌ STOP，勾 checkbox 是 Engineer 的職責
- PM 建了 reviewer-2、security-2... → ❌ STOP，重新 spawn 同名 Teammate（name: "reviewer"），不要建新成員
- PM commit 前沒檢查 untracked files → ❌ STOP，`git status` 的 `??` 新檔案可能是 Engineer 建的核心檔案，漏加會導致 build 失敗
- PM 想「Debugger 修好了，不用再 review」→ ❌ STOP，Debugger 的修復必須經 Reviewer 審查
