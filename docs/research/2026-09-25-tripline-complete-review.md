# Tripline：待合併變更、架構與逐頁 UI／UX 完整改善報告

日期：2026-09-25（Asia/Taipei）。審查基線：master `a26590a4cf4a00f6ac991cf783e7b263244aae60`，v2.57.93。日期窗口為 **9/23 00:00 至 9/25 00:00，UTC+08:00，以 committer date 計**。本報告提出修正建議，未變更產品功能、合併 master 或部署。

## 1. 決策摘要

1. **有一批應進入合併審查的 9/24 commits**：`origin/codex/1296-architecture-lifecycles`，HEAD `d72123c1`。它已集合 #1297–#1303 與兩個 review 分支；不要分別 cherry-pick 再重複合併。暫無該分支 PR。
2. **優先修自動儲存競態**：OCC retry 等待期間的新輸入可能消失，已用真實 hook 的最小測試重現。master 與 #1296 分支共用相同 hook；合併 #1296 不會自動解決它。
3. **其次修可見的錯誤語意**：分享讀取失敗被誤報失效、日期讀取失敗被誤報沒有天數、POI 搜尋失敗被誤報空結果、新行程的空結果訊息無法顯示。
4. **小幅 accessibility 修正可先做**：變更出發日期 dialog 的可及名稱、登入密碼 label 包含忘記密碼連結。大規模視覺改版不是當前最高價值。
5. **架構延續既有 deep module**：先完成 #1296，再深化既有 autosave 與 POI search module；不要再造 store、通用 CRUD 框架或第二套 overlay。

配套研究：[Apple HIG 對網頁的適用規範](2026-09-25-apple-hig-web-review.md)。HIG 用於互動設計，網頁尺度與可及性驗收使用 WCAG 2.2；原生 pt 不直接等同 CSS px。

## 2. 已完成的 Git 檢查

已執行 `git fetch --all --prune`、`git pull --ff-only`，結果 **Already up to date**。原工作樹 master 乾淨。fetch 只清除遠端追蹤 refs，不刪除實際遠端分支。

兩日窗口在全部現有本地／遠端追蹤 refs 共找到 **46 個 commits（含 merge）**：9/23 無符合日期的可達 commits；9/24 有 46 個，其中 **12 個已在 master、34 個尚未在 master**。34 個全部可由 #1296 整合分支到達，其中 29 個是非 merge commits。這不是對已刪除且不可達歷史的保證。

| 分支／變更 | 現況與證據 | 建議 |
| --- | --- | --- |
| `codex/1296-architecture-lifecycles` / `d72123c1` | 53 檔，+2848/-2208；`git cherry master` 的 29 個非 merge patches 都是 `+`；issue #1296 OPEN，未找到分支 PR | 第一合併候選。先建立整合 PR，依 #1296 spec 完成全套 gate；本報告沒有宣稱可立即部署 |
| `codex/1297-trip-import-lifecycle` / `304f9908` | 匯入建立／補償；已含於 #1296 | 隨整合分支審查，不獨立再合併 |
| `codex/1298-share-clone-lifecycle` / `1e106eac` | 分享複製共用建立政策；已含於 #1296 | 同上 |
| `codex/1299-segment-lifecycle` / `48edadde` | segment 讀取／補算、reader lifetime terminal state；已含於 #1296 | 同上；驗證失敗不抹掉已存 entry |
| `codex/1300-manual-segment-lifecycle` / `e549139b` | 兩個交通編輯入口共用寫入、partial save；已含於 #1296 | 同上 |
| `codex/1301-active-trip-selection` / `8b126c07` | 可存取清單、偏好／explicit link／fallback；已含於 #1296 | 同上；讀取失败不等於空清單 |
| `codex/1302-trip-list-detail-selection` / `430c8034` | 清單／詳情選擇與 scroll；已含於 #1296 | 同上；保留非零 scroll 的案例 |
| `codex/1303-map-selection` / `dc6216b5` | 地圖接共用選擇政策；已含於 #1296 | 同上；失敗不清偏好 |
| `codex/1296-review-chat` / `507b505e`、`codex/1296-review-css` / `b01f829b` | 草稿回復與 map empty state 視覺修正已合入 #1296 | 不重複 cherry-pick |
| #1304 landing illustration／CSS tokens | `8eb15f0b` 已合入，含變數守門、print z-index、深色對比測項 | 無需再合併；保留守門測试 |
| `feat/architecture-seven-goals-20260921` / `936dc170` | 雖不在 master ancestry，但其 tree 與 squash commit `680c281d` **完全相同**；PR #1294 9/22 已合併 | **不合併**；不能只看 `branch --no-merged` 或單個 patch-id 就判漏合併 |

較舊的 open PR 另外有 #1224、#1254 及 Dependabot #1197/#1207/#1233/#1277/#1278/#1280/#1281，不屬 9/23–24 commits。它們沒有在本次獲得完整 diff／CI 審核；不因歷史綠燈自動建議合併。特別是 #1224 的筆記 AI timeout，需對照當前 request termination 與 90/100 分鐘政策重新驗證。#1254 涉及 Agent 規則，不能提前當作已生效。

GitHub 證據：[spec #1296](https://github.com/raychiutw/trip-planner/issues/1296)、[整合分支](https://github.com/raychiutw/trip-planner/tree/codex/1296-architecture-lifecycles)、[已合併 #1294](https://github.com/raychiutw/trip-planner/pull/1294)、[已合併 #1304](https://github.com/raychiutw/trip-planner/pull/1304)。

### 合併候選驗證實績與限制

在隔離 worktree `/tmp/tripline-1296-validation`，HEAD `d72123c1`：

- `git merge-tree --write-tree master origin/codex/1296-architecture-lifecycles` 成功，tree `050d4b6c933ef1f4f25d25230ad95edd6da1b069`，無文字衝突。
- `npm run typecheck`、`npm run typecheck:functions` 通過。
- 6 個相關單元測試檔 **76/76 通過**：chat active trip、global map selection、map trip selection、trip list/detail selection、manual segment lifecycle、entry visible synchronization。
- 2 個真實 D1 adapter 整合測試檔 **62/62 通過**：trip import lifecycle、share clone lifecycle。
- Vite 對現有 CommonJS config 的未來 native loader 提出 warning，非本次測試失敗。

**不是完整 release gate**：以上測在候選 HEAD，非實際 merge 後的 checkout；node_modules 沿用既有工作樹，Vitest 實際為 4.1.11，未做候選 lockfile 的乾淨 `npm ci`。尚未跑全 unit/API suite、lint、build、browser E2E、實機 Safari／Google Maps。合併前應在納入最新 master 的 feature branch 做乾淨安裝，跑 repository checks 並重驗跨 tab、草稿、partial save、手機 empty map、CSS token production build。無衝突不等於無回歸。

## 3. 審查覆蓋與信心標記

- **R：已重現**，有最小 runnable test 或瀏覽器直接證據。
- **S：原始碼確認**，明確的條件／錯誤分支；尚未聲稱在正式環境實際發生。
- **V：正式站可見**，只涵蓋已打開的狀態。
- **建議／待驗**：產品改善或風險測項，不是假裝找到 bug。

頁面 inventory 依 `src/entries/main.tsx` 現行 route table，以及 38 個 `src/pages/*Page.tsx`。包含 account/settings aliases、共用 copy/move 頁、TripPage 的 embedded detail、操作面板與分享／列印。fallback／legacy redirect 額外列入共用驗收。

正式站以 `/browse` 讀取首頁、登入、註冊、隱私；首頁 390×844、登入 390×844 與 1440×1000 截圖已檢視。`/trips` 導到 `/login?redirect_after=%2Ftrips`，本次沒有使用者登入狀態，因此 **其餘登入後頁面為 source review，不是全站 visual QA**。未操作 production 寫入，也未提交登入／寄信／刪除表單。

知識圖先用 `get_architecture`、`search_graph`、`trace_path`、`get_code_snippet` 發現 module 與 callers；以目前 master 檔案確認實作。圖內混有 tests/tooling，centrality 或行數只用作導覽，不當缺陷或重構理由。

## 4. 優先問題與可驗收修正

### F1 — P1：OCC retry 期間的新 patch 被清除【R】

`src/hooks/useAutosave.ts:149–154` 先把 pending patch 傳給 retry，await 後直接清空 ref。retry 等待期間若 `patch({note:'B'})` 取代 pending ref，成功收尾仍把 B 清掉。隔離測試依序「A → 第一次 STALE_ENTRY → retry A 等待 → 使用者輸入 B → retry 成功」，預期下一次送 B，實際最後一筆為 A/version 2，測試失敗。

master 與候選分支的此檔 blob 均為 `a61083a4f509cce7aee7db006469279c88108c07`。這證明共享 hook 有競態；不是宣稱每個 caller 的正常操作一定會進入 OCC retry。圖發現 callers：PerPoiNoteRow、TravelPillDialog、RailRow；當前 TimelineRail 的引用應再由實際接線確認，不能只依舊圖判定受害面。

**最小修正方向**：retry 使用獨立批次快照，只清除已送批次；期間的新 pending 由同一 module 接續處理。不要把保護散落每頁。保留現行 OCC 範圍（ADR-0006）。驗收 retry 成功／失敗、新編輯在 retry 前後到達、相同欄位最後值與不同欄位 merge。

### F2 — P1 調查／P2 架構：離開編輯頁的 flush 並不保證資料安全【S，風險待 E2E】

`EditEntryPage.tsx:1365–1380` 等每個 flush 最多 1.2 秒且吞掉 rejection，之後導航；`useAutosave.ts:259–267` unmount 清 timer、移除網路 callback，pending 未持久化。已在傳輸中的成功 PATCH 可能仍完成，因此不能把所有慢網路都說成丟資料。但離線／失敗時 pending 只有 hook 記憶體，離開後不能假設會重連補送。

**最小修正方向**：先定義「已保存／仍未保存／明確放棄」的離開決策，復用現有 SaveStatus 與 guard；先不要加離線同步引擎。驗收離線編輯後返回、重連、切 trip、等待超過 1.2 秒；畫面不把未保存說成已保存。這與 F1 分開驗證。

### F3 — P2：空集合、失敗與失效被混為一談【S】

- `TripSharePage.tsx:41–42`：所有 load exceptions → `notfound`，網路或 500 會顯示「連結已失效」。應只依明確失效回應顯示該文案，其他保留重試。
- `AddPoiFavoriteToTripPage.tsx:323–327`：days 讀取失敗 → `[]`；`500` placeholder 再顯示「該行程沒有天數」。應保留獨立讀取錯誤與重試，不推導空資料。
- `AddEntryPage.tsx:201–202`：必要 days/meta 失敗 silent。應有可恢复的錯誤，不讓 disabled/缺標籤成为唯一回饋。
- `ChangePoiPage.tsx:648–657`：收藏請求 failure 被吞掉。應終結 loading，提供 retry，成功空列表另說明。

驗收使用現有 page tests，分別注入 200-empty、404、403、500、network rejection；保留使用者選擇與輸入。各 domain module 持有自己的狀態，不引入全站泛用 CRUD controller。

### F4 — P2：POI 搜尋 interface 漏掉完整的結果狀態【S】

`usePoiSearch` 回傳 `results/searching`，失敗只用 optional callback；AddStop 與 ChangePoi 不提供 `onError`，失敗後 `results=[]` 顯示找不到結果。NewTrip/EditTrip 額外自行持有 error，caller 必須了解非同步生命週期。NewTrip `719–724` 外層需要 searching、非空 results 或 error；成功零結果時整個 dropdown 不渲染，內層「沒找到結果」不可達。

**最小方向**：深化既有 search module，集中目前 query 的 idle/loading/empty/error/success 與 stale completion 判斷；caller 保留自己的 selection 和 domain 操作。保留 Google-only（ADR-0005）、现有 debounce/AbortController、輸入驗證，不新增搜尋供應商 adapter。驗收 4 個 callers 的 failure→成功、成功空結果、短 query、切 tab、過期回覆與鍵盤選取。

### F5 — P2：變更出發日期 dialog 缺 accessible name【S】

`EditTripPage.tsx:1474–1475` 有 `role=dialog`、`aria-modal`、focus handler 與 h2，但沒有 `aria-labelledby` 或 `aria-label`。最小修正是現有 h2 加 id 並關聯，不需要改版或新 dialog module。驗收 accessible name 為「變更出發日期」，Tab／Escape／回焦保留。

### F6 — P2：登入密碼名稱混入另一項操作【V+S】

正式站 accessibility snapshot 將輸入框讀為「密碼 忘記密碼？」；`LoginPage.tsx:502–505` 將連結放在 input label 裡。保留同一視覺行，將 link 移出 label，密碼欄名稱維持「密碼」。驗收可及名稱、兩個獨立 Tab stops、原有 autocomplete 及 password manager。

### F7 — P2：分享 PDF 缺少可見錯誤／忙碌狀態【S】

`TripSharePage.tsx:49–52` 以 `void renderTripPrintPdf` 呼叫，沒有 catch 或 UI busy；renderer 有防重入與 30 秒 timeout，但會向 caller throw。用既有錯誤／狀態呈現接住結果，處理 repeated click 與 timeout；不要移除 renderer 的 cleanup。列印頁已有 loading/error，但失敗只有文案，建議加就地 retry。驗收 loader failure、PDF failure、timeout、成功後重試，不測實際下載之外的虛構成功。

### F8 — P2：筆記 AI 初次狀態讀取失敗後沒有自動 poll【S】

`TripNotesPage.tsx:441–482` loadAiState catch 靜默，interval 只在 `hasActiveAiJob` 為真時啟動；初次失敗會留下 empty jobs，不能指望「下一次 polling」自行恢復。使用者之後手動操作可能重觸發，因此不是永久不可恢復。建議初次失敗可見提示／重試，既有 active polling 保留；先做最小行為修正，不與一般聊天生命週期硬合併。驗收第一次讀取失败後恢復，不能把未知 job 說成 idle 或鼓勵重複生成。

## 5. 架構深化候選

遵循 CONTEXT.md 領域語言與 ADR-0004（不引進 state store）、0005（Google only）、0006（OCC 範圍）、0007（停止等待不等於中止 AI）。不把已完成 #1294 的 request termination、conversation、worker、OAuth token lifecycle、operations run 再當新工作。

| 候選 | 推薦強度／files | Problem → Solution | Depth、locality、leverage 與 test seam |
| --- | --- | --- | --- |
| A. 完成行程建立／segment／active trip 深化 | **Strong：整合既有成果**；#1296 的 `_tripCreation`、`useMyTrips`、`useAccessibleTripSelection`、`manualSegment` 等 | master caller 仍持有分批建立、補償或選擇政策 → 審查既有整合分支，刪掉 caller 的重複協調 | interface 藏住現有順序義務，既有 138 tests 提供部分證據。不是重做七張票 |
| B. 自動儲存與安全離開 | **Strong**；`useAutosave.ts`、`EditEntryPage.tsx`、`TravelPillDialog.tsx`，核對其他 callers | batch/retry、pending 與離開政策接縫漏資料 → 先修 F1，再將真正的完成語意留在同一 module | deletion test：移除現有 hook 會把 debounce/retry/offline 複製回 callers，應深化而非刪掉。測試由相同 interface 驅動，使用既有 save function seam；真實 HTTP 與 test fake 是 adapters |
| C. POI 搜尋結果生命週期 | **Strong**；`usePoiSearch.ts` 及 NewTrip/EditTrip/AddStop/ChangePoi | caller 自補 error、把 error 當 empty → 共用 module 持有一次搜尋的完整結果與 query 歸屬 | locality：一處修過期結果／error。leverage：4 callers。deletion test 不刪 debounce/abort，把散落狀態收進現有 implementation；沿用 fetch seam，不新增 provider abstraction |
| D. 分享／列印 export 的操作結果 | **Worth exploring**；`TripSharePage.tsx`、`TripPrintPage.tsx`、`renderTripPrintPdf.tsx`、`tripPrintData.ts` | renderer 有 cleanup，caller 缺 error/busy；load 失敗分類不同 → 先補缺少的結果處理，只有多個 caller 真正重複才集中操作協調 | 保留已有 data-driven document 的 depth。HTML print 與 PDF 是兩個真實輸出途徑，但不因此強制建立新 interface；先以現有 function seam 測結果。若刪一層只是移動程式，不做 |

**Top recommendation：先修 B 的 F1，並把 A 完成整合審查列為第一個合併工作；下一個架構題選 C。** B 已有資料正確性失敗證據，A 已有大量可复用成果，C 的 4 callers 都得到收益。D 先做最小錯誤處理，還沒有必要建立 export framework。

## 6. 每頁 UI／UX 建議

表內「待驗」是具體驗收與改善方向，不表示已發現缺陷。P1 優先資料／工作流，P2 可及性與錯誤回饋，P3 視覺／文案 polish。全部頁面另套用第 7 節跨頁準則。

| 頁面／route／source | 優先與證據 | UI 建議 | UX 建議 | 驗收 |
| --- | --- | --- | --- | --- |
| [LandingPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/LandingPage.tsx)<br>`/` | P3 · V/S | 保留已修好的插畫、單一主要 CTA 與現有品牌；不重提核准過的示意色。 | 主標與操作階層清楚；考慮將 JSON 匯入說明放次要層，避免新手誤以為只能匯入。 | 390px 實見無橫向溢出；待測 320px、200% 文字與深色。 |
| [LoginPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/LoginPage.tsx)<br>`/login` | P2 · V/S F6 | 忘記密碼連結移出密碼 label，視覺維持原行。 | 保留 redirect_after、autocomplete、submit busy；驗證／鎖定訊息要可被讀出。 | 輸入框 accessible name 只為密碼；鍵盤可分別到連結與輸入框。 |
| [SignupPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/SignupPage.tsx)<br>`/signup` | P2 · V/S，待驗 | 保持持續 label 與隱私同意連結；錯誤緊鄰相應欄位。 | 保留 email、display name 與邀請上下文；說明 disabled CTA 還缺哪項。 | 實見表單語意；待驗錯誤焦點、弱密碼、重複 email、提交失敗不清內容。 |
| [EmailVerifyPendingPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/EmailVerifyPendingPage.tsx)<br>`/signup/check-email` | P2 · S，待驗 | 冷卻倒數與重寄按鈕分開，避免每秒打斷讀屏。 | 顯示寄送目的地與如何修正 email；倒數歸零重新允許操作。 | 切背景後倒數正確；重寄失敗有可保留的訊息，沒有重複請求。 |
| [VerifyEmailPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/VerifyEmailPage.tsx)<br>`/auth/verify-email` | P2 · S，待驗 | 成功訊息與前往登入 action 並存。 | 現有 1.5 秒自動導向可考慮改為明確按鈕；先確認產品偏好，不直接定違規。 | missing/expired/used/network 各有出口；离頁後 timer 不把人帶回登入。 |
| [ForgotPasswordPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/ForgotPasswordPage.tsx)<br>`/login/forgot` | P2 · S，待驗 | 維持單欄簡潔、錯誤靠近 email。 | 保留不洩露帳號是否存在的回覆；清楚說明下一步及返回登入。 | 鍵盤 submit、慢速回覆、429、network failure，不重寄多次。 |
| [ResetPasswordPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/ResetPasswordPage.tsx)<br>`/auth/password/reset` | P2 · S，待驗 | 密碼規則與 confirmation error 應持續可見並關聯欄位。 | 過期頁提供重新申請，成功頁提供登入；勿清空仍需修正的其他輸入。 | token 無效／已用、兩次密碼不符、成功與失敗焦點可理解。 |
| [PrivacyPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/PrivacyPage.tsx)<br>`/privacy` | P3 · V/S，待驗 | 長文保留標題階層與舒適行寬；有需要才加章節導航。 | 從註冊／登入往返應可回原處；可複製與可點的聯絡方式保留。 | 實見返回與聯絡連結；待驗 200% 文字及 deep link 返回。 |
| [ConsentPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/ConsentPage.tsx)<br>`/oauth/consent` | P2 · S，待驗 | 應用名稱、請求權限、授權／拒絕明確分組。 | scope 用人話說明；拒絕與失敗應依安全 redirect 契約返回，不能暗示授權成功。 | 未知 client／過期請求／拒絕／雙擊授權；screen reader 識別兩個動作。 |
| [InvitePage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/InvitePage.tsx)<br>`/invite` | P2 · S，待驗 | 先顯示行程、邀請人與角色，再放接受 CTA。 | 目前 mismatch error 應連到正確帳號切換且保留 invitation；不把 expired 說 network。 | 未登入／帳號不符／已接受／過期／重試；不誤用其他行程。 |
| [ChatPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/ChatPage.tsx)<br>`/chat；TripSheet embedded` | P1/P2 · S，既有分支 | 維持 composer 上方跳到最新按鈕與鍵盤安全區；狀態少而清楚。 | 優先整合 #1296 草稿與 trip selection 修正；停止等待必須說明 AI 可能繼續執行。 | A/B trip 草稿、explicit link、清單 failure/empty、回補歷史、IME Enter、晚到回覆。 |
| [TripsListPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/TripsListPage.tsx)<br>`/trips；?selected=` | P2 · S，既有分支 | 分類／搜尋／新增維持清晰階層；空行程與篩選無結果不同文案。 | 整合 #1302；更新摘要不能重置非零 scroll 或改掉選中 trip。 | mobile 列表與 desktop detail、封存通知、back/forward、reload。 |
| [TripPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/TripPage.tsx)<br>`/trips?selected=；TripPageHost 詳情` | P1/P2 · S，既有分支 | 時間／景點／交通分層；pending travel 不要偽裝已算好。 | 整合 segment lifecycle；保留已存 entry、明確只重算交通的重試。 | 換日／換 trip／拖曳暫態／partial save／readonly；單一 pointer 不拖曳的排序替代待驗。 |
| [GlobalMapPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/GlobalMapPage.tsx)<br>`/map` | P2 · S，既有分支 | 保留 empty map gradient 與 CTA 尺寸（review-css 已修）；無 trip 說明如何開始。 | 整合 #1303，清單讀取失败不能清偏好或導錯 trip。 | initial failure/retry、真正 empty、切 tab 與 explicit link；地圖不可用時仍有列表入口。 |
| [MapPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/MapPage.tsx)<br>`/trip/:tripId/map；stop/:entryId/map` | P2 · S，待驗 | 選中 pin、卡片與 Day tab 有文字／形狀提示；卡片不遮 pin。 | trip switcher 延續 active trip；平移縮放保留標準操作；載入失败不要只空白。 | 地圖失敗、無座標、長地名、單點縮放、keyboard、手機安全區與 Attribution 可見。 |
| [ExplorePage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/ExplorePage.tsx)<br>`/explore` | P2 · S，待驗 | 搜尋、類型、地區與更多結果的角色清楚；不要再把收藏篩選叫 Day tab。 | 加入收藏／加入行程後提供確認、可重試；保留搜尋上下文。 | 零結果、重複收藏、load more 失敗不清已載入內容；listbox/menu keyboard 待驗。 |
| [PoiFavoritesPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/PoiFavoritesPage.tsx)<br>`/favorites` | P2 · S，待驗 | 保留 role=group/aria-pressed 篩選；選取數與批次動作固定可辨。 | 批次刪除依 server 結果逐項呈現，不先消失後才報錯。 | 部分成功、重複操作、篩選後選取範圍、200% 文字與 mobile bottom bar。 |
| [AddPoiFavoriteToTripPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/AddPoiFavoriteToTripPage.tsx)<br>`/favorites/:id/add-to-trip；/add-to-trip` | P2 · S F3 | 日期讀取失敗有就地 retry，不顯示沒有天數。 | 切 trip 時清楚載入對應 dates，保留景點與時間；重試不建立重複 entry。 | 200-empty 與 network failure 分開；慢回覆不覆寫新 trip；409 有恢复路徑。 |
| [NewTripPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/NewTripPage.tsx)<br>`/trips/new` | P2 · S F4 | 修正成功零結果看不到提示；目的地 dropdown 加完整鍵盤語意。 | 搜尋失敗可重試，不清已選目的地；彈性日期／確定日期說明清楚。 | query >=2 且 200 [] 必有空訊息；箭頭/Enter/Escape、長名稱、日期區間。 |
| [EditTripPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/EditTripPage.tsx)<br>`/trip/:tripId/edit` | P2 · S F5 | 出發日期 dialog 關聯標題；大表單保持日期、目的地、發布狀態階層。 | 平移／刪天前顯示具體影響，成功後保留正確日期；error 不丟已填內容。 | dialog name／focus return、刪除失敗、日期平移、搜尋 failure→success。 |
| [AddEntryPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/AddEntryPage.tsx)<br>`/trip/:tripId/add-entry` | P2 · S F3 | 必要資料讀取失败顯示錯誤與重試。 | 標明將加入哪趟／哪天；未確認 days 之前不假設可加入。 | deep link 帶/不帶 day、days/meta 單項失败、重試後能繼續。 |
| [AddStopPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/AddStopPage.tsx)<br>`/trip/:tripId/add-stop` | P2 · S F4 | 多層來源／類型／日期選擇保留清楚語意；submit error 用可及訊息。 | 搜尋失敗與無結果分開；批次加入時告知已選數与目標日期。 | 4 種 source 狀態、切 tab、keyboard、部分寫入後交通失败不重送新增。 |
| [AddCustomStopPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/AddCustomStopPage.tsx)<br>`/trip/:tripId/add-custom-stop` | P2 · S，待驗 | 自訂名稱與位置標籤清楚；不要只靠地圖圖釘指出必填位置。 | 地圖不能使用時說明取得座標方式；保留 pending 表單與離開 guard。 | 地址候選 keyboard、定位拒絕、缺座標、返回未存、手機鍵盤遮擋。 |
| [ChangePoiPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/ChangePoiPage.tsx)<br>`/trip/:tripId/stop/:entryId/change-poi` | P2 · S F3/F4 | search/favorites/custom 的載入、錯誤與空結果分開。 | 明確是換正選、加備選或新 entry；現有 OCC conflict 應能返回重新確認。 | favorites failure 停止 loading；mode 切換不沿用舊 selection；409 retry。 |
| [EditEntryPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/EditEntryPage.tsx)<br>`/trip/:tripId/stop/:entryId/edit` | P1 · R/S F1/F2 | 每筆正選／備選保存狀態清楚，未存不只短暫 toast。 | 先修 autosave pending 批次；離開不能無聲丟失；交通 partial save 與景點儲存分開。 | OCC retry 新編輯、離線返回、1.2 秒以上慢網路、切 trip、儲存後回到原景點。 |
| [EntryActionPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/EntryActionPage.tsx)<br>`/trip/:tripId/stop/:entryId/copy 或 move` | P2 · S，待驗 | 標題、CTA 與確認內容區分複製／移動；目標日期 radio 清楚。 | 複製保留來源；移動不意外落到目前日期；重試只處理未完成階段。 | 跨日與同日、409、讀取失敗、重複按送出；來源/目的交通皆更新。 |
| [CollabPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/CollabPage.tsx)<br>`/trip/:tripId/collab` | P2 · S，待驗 | 將 owner、companion 權限用可讀文字顯示，避免只以 disabled 表達。 | trip meta 載入失敗 fallback 不應誤導正在編輯哪趟；邀請錯誤保留 email。 | owner/companion/readonly、邀請撤回、移除失敗，操作面板返回與焦點。 |
| [TripHealthCheckPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/TripHealthCheckPage.tsx)<br>`/trip/:tripId/health` | P2 · S，待驗 | 保留 pending/failed/report 的分辨；紅綠結果加文字及位置。 | 輪詢失敗目前重試但沒有新的使用者狀態；建議顯示暫時無法更新與最後資料時間。 | poll failure→recovery、空 entry、未授权、舊報告重跑、進入 issue 對應日期。 |
| [TripNotesPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/TripNotesPage.tsx)<br>`/trip/:tripId/notes` | P2 · S F8 | 顯示 AI 狀態未知／失敗；既有筆記仍可讀，不整頁封鎖。 | 初次 ai-state 失敗可重試；人工項目与 AI 項目區別，刪除排除再生成政策保持。 | initial failure→recovery、人工內容不覆蓋、切 trip 舊回覆、AI 已完成但 poll 剛恢復。 |
| [TripPrintPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/TripPrintPage.tsx)<br>`/trip/:tripId/print` | P2 · S F7 | 載入失敗加 retry；螢幕工具列與 print-only document 繼續分離。 | disabled 列印有清楚載入原因；長筆記、跨頁表格仍完整。 | 多日長行程、完整筆記讀取 failure、page breaks、關閉回到對應 trip。 |
| [TripSharePage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/TripSharePage.tsx)<br>`/s/:token` | P2 · S F3/F7 | 分享標題使用實際 heading；PDF busy/error 可見。 | 404/過期與 network/500 分開；登入複製返回同一分享連結。 | 公開無登入、失效、500 retry、PDF timeout、clone 重複按鈕與錯誤。 |
| [AccountPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/AccountPage.tsx)<br>`/account；帳號 sheet` | P2 · S，待驗 | 編輯名稱、帳號數據、危險操作分區；重複的刪除 error 呈現先檢查分支再簡化。 | 刪除預覽必須來自成功讀取；保持高影響 reauth，不用 optimistic delete。 | sheet/full-page、stats failure、delete preview failure、wrong password、focus restore。 |
| [AppearanceSettingsPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/AppearanceSettingsPage.tsx)<br>`/account/appearance；/settings/appearance` | P3 · S，待驗 | 文案可改為跟隨系統／淺色／深色；不需要額外色票 grid。 | 即時預覽但保留同一焦點；自動模式隨系統變更。 | system change、persist/reload、dark contrast、sheet 與 deep link 一致。 |
| [NotificationsSettingsPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/NotificationsSettingsPage.tsx)<br>`/account/notifications；/settings/notifications` | P3 · S | 目前確為即將推出 stub；可簡化成說明，不呈現像可操作卻不可用的設定。 | 帳號入口清楚標註未開放，或產品同意後隱藏入口；不為假想需求建通知後端。 | 輔助科技不誤認為可切換控制；手機長文字仍讀得完。 |
| [SessionsPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/SessionsPage.tsx)<br>`/account/sessions；/settings/sessions` | P2 · S，待驗 | 當前裝置、最近活動及撤銷位置易辨識；日期提供本地可讀格式。 | 區分撤銷單一／其他／當前 session；先確認 server 結果，再反映列表。 | 空資料、error retry、撤銷失敗、當前 session 登出、確認對話框焦點。 |
| [ConnectedAppsPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/ConnectedAppsPage.tsx)<br>`/account/connected-apps；/settings/connected-apps` | P2 · S，待驗 | 顯示應用、權限與授權時間；撤銷為明確動詞。 | 撤銷後說明哪些存取失效，失敗保留該列而非假裝完成。 | 0 app、讀取失敗、撤銷失败與成功、keyboard dialog。 |
| [DeveloperAppsPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/DeveloperAppsPage.tsx)<br>`/developer/apps` | P2 · S，待驗 | 列表與新增 CTA 保持簡單，不把 client metadata 當一般旅遊功能。 | empty 有建立入口、load failure 可重試；敏感資料不在列表無差別顯示。 | 權限拒絕、0 app、失敗恢复、長名稱與 redirect URI。 |
| [DeveloperAppNewPage](https://github.com/raychiutw/trip-planner/blob/a26590a4cf4a00f6ac991cf783e7b263244aae60/src/pages/DeveloperAppNewPage.tsx)<br>`/developer/apps/new` | P2 · S，待驗 | types/scopes 用 fieldset/legend 整組命名；URI 錯誤對應實際行。 | 一次性 secret 明確提示保存、複製成功／失败；關閉前確認流程保留。 | invalid URI、public/confidential、clipboard denied、secret dialog name/Tab/Escape。 |

## 7. 跨頁 UI／UX 修正準則

依 [HIG/WCAG 研究](2026-09-25-apple-hig-web-review.md) 的逐項官方來源：

| 範圍 | 建議與驗收方式 | 不應誤判 |
| --- | --- | --- |
| 導覽 | root tab 保持聊天／行程／地圖／收藏；日期 tab 與收藏 filter 各用相應語意；back/forward/reload 保持 URL 與選擇一致 | 新增不是 tab；路由連結不必硬套 ARIA tab pattern |
| Sheet／操作面板／dialog | 依 CONTEXT.md 的角色命名；modal 驗證 name、focus entry/trap/restore、Escape、背景不可互動；桌機操作面板与手機整頁分別驗證 | 非 modal 面板不應鎖住所有背景；不能只看 aria-modal 屬性就宣稱通過 |
| 表單 | persistent labels、欄位錯誤關聯、送出 busy、資料保留；autocomplete 使用既有 HTML 能力 | placeholder 不是 label；disabled CTA 不是完整錯誤說明 |
| 文字與色彩 | 一般文字 4.5:1、大字 3:1，非文字必要控制按 1.4.11；深淺色及互動狀態逐一量測 | 不能把任意 bold 當 web 大字；5.0 是 repo margin，非規範門檻；裝飾例外不延伸成控制例外 |
| 點擊區 | 主要觸控目標建議 44 CSS px；AA 2.5.8 是 24 CSS px 並有例外；量 hit area 與 spacing | Apple 現行 iOS 表列 default 44 pt/minimum 28 pt，不等於所有網頁都必須 44px |
| 窄螢幕／放大 | 320/375/768/1024/1440，200% 文字、400% zoom；鍵盤與 safe area 不遮輸入／行動 | 地圖二維例外不代表旁邊表單也可水平溢出 |
| AI／背景作業 | 顯示真實 pending/error/unknown/terminal；保留草稿；只對重要狀態適度播報 | 不虛構百分比，不每 token assertive；停止等待不是中止 AI |
| 拖曳／地圖 | 不需拖曳的單 pointer 替代，鍵盤可操作；失敗时有列表途徑 | 僅 keyboard sortable 不足以證明 WCAG 2.5.7 |
| Redirect／legacy | `/admin`→trips、`/manage`→chat、trip index/stop redirect、fallback 逐一驗證 query/hash 與安全 redirect | 不能把 redirect 當獨立新頁重做 |

**規範文件有衝突**：本次提供的 AGENTS.md 指定 DESIGN.md＋terracotta-preview-v2 為 SoT；CLAUDE.md／DESIGN.md 又稱 Apple HIG 為 SoT 且舊 HIG effort 免 mockup。依此次指令，報告只揭露差異，不改品牌、不套用舊 effort 例外。新的 layout／頁面變更仍先 prototype、user sign-off；bug／token／純 prop／無 UX refactor 依現行例外處理。

## 8. 建議交付順序

這是排序建議，**不是已核准的實作 spec 或 tickets**；尚未新建 issues，亦未承諾全部改版。

1. **資料正確性**：F1 最小修復與回歸測試；F2 重現離線／離開風險。保留 autosave 與既有 OCC，不重建編輯器。
2. **把已有成果送審**：#1296 整合 PR，最新 master、乾淨依賴、完整 checks、關鍵 UI 回歸，再走正常合併／部署 gate。
3. **可獨立快速修正**：F3/F5/F6/F7/F8，每次只改已確認行為，使用既有 page/hook seam。F5/F6 無需新 layout。
4. **搜尋 module 深化**：F4 四個 callers 一起收斂；沿用同一高階行為測項，刪除被涵蓋的重複 source-location assertions，不砍未覆蓋契約。
5. **設計 polish**：先拿逐頁表選 scope；layout 變更用可比較 prototype，再寫 React。桌機與手機、深色、keyboard、200% text 都包含。

### 建議的最少測試 seam

- autosave：直接透過現有 hook 的 `patch/flush` 與 save adapter，控制 deferred promise，驗 pending 不遺失。
- 搜尋：現有 hook + 四頁的使用者輸入／結果；fetch failure、empty 與晚到回覆。
- 視覺／a11y：既有頁面與共用 shell；accessible name／keyboard 測到實際 DOM，production build 的 CSS 守門保留。
- 建立／交通／selection：沿用 #1296 的 D1 integrations 與高階 page tests，不引入新的框架。

全站無需為「可能有用」新增 state manager、通用 repository、跨 provider 搜尋、多套 token 或 design system。先讓既有 module 藏住真正重複的流程知識。

## 9. 可重跑的證據

```bash
# 日期與漏合併範圍
git log --all --since='2026-09-23T00:00:00+08:00' --until='2026-09-25T00:00:00+08:00' --format='%h %cI %s'
git log --all --since='2026-09-23T00:00:00+08:00' --until='2026-09-25T00:00:00+08:00' --not master --oneline
git cherry master origin/codex/1296-architecture-lifecycles
# squash 對應：預期無差異
git diff 680c281d origin/feat/architecture-seven-goals-20260921 --stat
# 只試算 merge，不改分支
git merge-tree --write-tree master origin/codex/1296-architecture-lifecycles
```

```bash
# 在候選 worktree；本次結果 76 + 62 passed
npm run typecheck
npm run typecheck:functions
npx vitest run tests/unit/chat-active-trip-selection.test.tsx tests/unit/global-map-selection.test.tsx tests/unit/map-trip-selection.test.tsx tests/unit/trip-list-detail-selection.test.tsx tests/unit/manual-segment-lifecycle.test.tsx tests/unit/entry-visible-synchronization.test.tsx --maxWorkers=2
npx vitest run --config vitest.config.api.mts tests/api/trip-import-lifecycle.integration.test.ts tests/api/share-clone-lifecycle.integration.test.ts
```

F1 最小重現保存在隔離 worktree 的 `tests/unit/review-autosave-repro.test.ts`；它是**預期失敗的診斷證據**，沒有加入正式 tests、沒有修改應用程式。下列內容可在同一 repo 的臨時 worktree 重建，執行 `npx vitest run tests/unit/review-autosave-repro.test.ts --maxWorkers=1`：


```typescript
// @vitest-environment jsdom
import { it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosave } from '../../src/hooks/useAutosave';
import { ApiError } from '../../src/lib/errors';
vi.mock('../../src/lib/networkBus', () => ({ registerNetworkCallbacks: () => () => {} }));
it('retains a new edit made while OCC retry is pending', async () => {
  vi.useFakeTimers();
  let finish!: (v: Record<string, unknown>) => void;
  const retry = new Promise<Record<string, unknown>>(r => { finish = r; });
  const save = vi.fn().mockRejectedValueOnce(new ApiError('STALE_ENTRY',409)).mockReturnValueOnce(retry).mockResolvedValue({version: 4});
  const { result, unmount } = renderHook(() => useAutosave<{note:string}>({save, onStale: async () => 2}));
  try {
    act(() => result.current.patch({note:'A'}));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(save).toHaveBeenCalledTimes(2);
    act(() => result.current.patch({note:'B'}));
    await act(async () => { finish({version:3}); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(save).toHaveBeenLastCalledWith({note:'B'},3);
  } finally { unmount(); vi.useRealTimers(); }
});

```

觀察：預期最後呼叫 `{note: B}, version 3`，實際為 `{note: A}, version 2`。本報告未修正它，避免把審查報告擅自擴成未核准實作。

### 正式站唯讀視覺證據

- [首頁手機截圖，390×844 viewport](assets/2026-09-25/tripline-landing-mobile-20260925.png)
- [登入手機截圖，390×844 viewport](assets/2026-09-25/tripline-login-mobile-20260925.png)
- [登入桌機截圖，1440×1000 viewport](assets/2026-09-25/tripline-login-desktop-20260925.png)

截圖為瀏覽器產出的頁面影像；它們證明當下可見狀態，不取代 VoiceOver、實機 Safari、表單提交與完整 axe 檢查。architecture-review HTML 是本次 skill 要求的臨時可視化；持久交付以本 Markdown、研究文件及以上圖片為準。
