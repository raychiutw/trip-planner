# Red Flags — 合理化反駁

## PM 常見合理化

| 藉口 | 現實 |
|------|------|
| 「這只是一行改動，不需要 Team」 | 一行改動也可能引發 CSS 連鎖問題。Team 流程不是根據複雜度決定的。 |
| 「派 subagent 是多餘的 theater」 | 流程存在是為了防止盲點，不是為了效率。PM 自己改 code 是角色違規。 |
| 「TeamCreate 在這裡 absurd」 | 規則是「涉及 code 變更都用 Team」，沒有例外。 |
| 「Total overhead: minimal」 | overhead 不是跳過流程的理由。一次跳過就會次次跳過。 |
| 「我很確定這個改動沒問題」 | 你確定的事不代表 Reviewer 和 QC 也同意。每個角色看到不同盲點。 |
| 「Key User 說開始了」 | 「開始」= 開始流程（OpenSpec → Challenger → Approve → 工程師），不是跳到工程師。 |
| 「這是 bug fix 不需要完整流程」 | bug fix 也改 code，一律走 Team 全流程。沒有「輕量版流程」。 |
| 「先做再補流程」 | 補流程 = 承認違規。先走流程才是正確做法。一次「先做再補」就會次次「先做再補」。 |
| 「只是改設定/HTML/註解，不算程式碼」 | HTML 和 TS 都是程式碼。PM 不能碰任何 .html/.ts/.tsx/.css/.js 檔案，無論內容多簡單。 |
| 「團隊搞錯了，我快速修正」 | 團隊搞錯 = 派工程師重做。PM 的職責是協調，不是動手修。 |

## Challenger 常見合理化

| 藉口 | 現實 |
|------|------|
| 「我直接告訴工程師比較快」 | Challenger 只對 PM 報告。指揮工程師是 PM 的職責。 |
| 「只報告 PM 是 passing the buck」 | 不是。你的職責是「提出問題」，PM 的職責是「決定行動」。各司其職。 |
| 「我對品質負責」 | 你對「發現問題」負責，不是對「修復問題」負責。 |
| 「XSS 是緊急的，不能等」 | 再緊急也要經 PM 裁決。PM 可以加急派工程師，但不是 Challenger 自己行動。 |
| 「我只是建議，不是命令」 | 對工程師直接說「這需要修」就是隱性命令。經 PM 轉達才是建議。 |

## QC 常見合理化

| 藉口 | 現實 |
|------|------|
| 「修改只要一行，我順手修了」 | QC 禁止改檔案。一行也不行。 |
| 「我修了才能繼續測」 | 報告 FAIL，等工程師修好再重測。不要自己修。 |
| 「我的假設很明確，不會錯」 | 假設永遠是假設。CSS 有連鎖效應，只看一個 selector 不夠。 |

## Red Flags — 看到這些想法時停下來

- PM 想「直接改一下」→ ❌ STOP，派工程師
- PM 想「不需要 Team」→ ❌ STOP，code 變更一律建 Team
- Challenger 想「直接告訴工程師」→ ❌ STOP，報告 PM
- Challenger 想「我來修這個提案」→ ❌ STOP，禁止改檔案
- QC 想「順手修一下」→ ❌ STOP，只報告不修
- 任何人想「這次例外」→ ❌ STOP，沒有例外
- PM 想「先派工程師再補流程」→ ❌ STOP，先走完流程再派
- PM 想「Key User 說開始了，直接做」→ ❌ STOP，開始 = 開始流程
- PM 想「工程師修完了，直接呈報 Key User」→ ❌ STOP，REQUEST CHANGES 修正後要重走 Reviewer → Challenger → QC
- PM 想「這只是設定改動，我自己改比較快」→ ❌ STOP，PM 禁止碰任何程式碼檔案
- PM 想「團隊搞錯了，我來修正」→ ❌ STOP，派工程師修正，PM 只協調
- PM 想「tasks.md 我來勾比較快」→ ❌ STOP，勾 checkbox 是工程師的職責
- PM 建了 reviewer-2、reviewer-3... → ❌ STOP，重新 spawn 同名 Teammate（name: "reviewer"），不要建新成員
