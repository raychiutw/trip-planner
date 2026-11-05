# 「變更密碼」頁（變體 B）對照 Apple HIG 與 Web 標準

日期：2026-11-03　　範圍：只讀研究，未修改任何程式碼

## 問題

web 專案要新增已登入使用者用的「變更密碼」頁。owner 已選變體 B，並要求「符合 Apple HIG」。本研究用一手來源回答三件事：

1. HIG 對這類表單怎麼說。
2. Web 端對應的標準是什麼（WCAG 2.2、HTML autocomplete、`passwordrules`）。
3. 變體 B 逐項對照後，哪裡符合、哪裡要調整、哪些取捨來源沒規定、要 owner 拍板。

**分類標籤**（依 `DESIGN.md`「Web 設計驗收與來源」，來源衝突時要分開）：
- **【網頁要求】**：WCAG 2.2、HTML 規格等可測的 Web 標準。
- **【原生建議】**：Apple HIG。這是設計參考，不是 CSS 要求，pt 值不等於 CSS px。
- **【owner 決策】**：來源沒規定或來源互相拉扯，需要 owner 拍板。
- **【推論】**：我自己的判斷，不是來源明文。

## 結論摘要

### 一、變體 B 的版面大方向有 HIG 依據，不需要推翻

- 左上返回、右上單一主要動作、設定風格分組列表、新舊密碼各一列。
- 返回鈕的選擇也站得住腳。這頁是從帳號設定「推進」的頁面，不是 sheet，所以用 Back 而不是 Cancel，不違反 HIG。
- App 版 modal 才適用 Cancel＋Done 成對。

### 二、需要調整的地方（依重要性）

1. **【網頁要求】password 欄位缺 `autocomplete`**（目前原型沒有）。
   - 「目前密碼」要加 `autocomplete="current-password"`，「新密碼」要加 `autocomplete="new-password"`。
   - WCAG 1.3.5（AA）與 3.3.8（AA）都靠它讓密碼管理員能填；WHATWG 規格明列這兩個值。
   - 密碼管理員要能填、能存新密碼，也要確認沒有擋貼上。
   - 建議再放一個隱藏的 username 欄位（`autocomplete="username"`，唯讀）。這是【推論】：規格定義 current-password 是「對應 username 欄位那組帳號」的密碼，沒有它，管理員可能存錯帳號。
2. **【網頁要求】焦點可見性有疑慮。**
   - 變體 B 的 `<input>` 寫了 `outline: none`，原型 CSS 內沒有補替代焦點樣式。
   - WCAG 2.4.7（AA）要求鍵盤焦點可見。要確認全域樣式有補，例如整列 `:focus-within` 的外框，否則就是缺陷。
3. **【網頁要求＋原生建議】密碼規則只放在 placeholder。**
   - 「至少 8 字元」目前只出現在 placeholder，輸入後就消失。
   - HIG 明說 placeholder 輸入後會消失，要另有標籤或說明。
   - WCAG 3.3.2（A）要求提供標籤或說明。
   - 建議把規則寫進列表下方那行常駐小字，例如「至少 8 字元。變更後，其他裝置會被登出，這台維持登入。」錯誤出現時，說明文字改紅字但仍帶規則。
4. **【網頁要求】錯誤要和欄位程式化關聯。**
   - 目前錯誤是一段 `role="alert"` 的 `<p>`，沒有指向欄位。
   - WCAG 3.3.1（A）要求指出出錯項目並用文字描述。
   - 建議出錯欄位加 `aria-invalid="true"` 與 `aria-describedby` 指到錯誤文字，並把焦點移到出錯欄位。這屬於實作手法，是【推論】，標準只規定結果。
5. **【網頁要求】顯示／隱藏鈕的 ARIA 用法重複。**
   - 目前同時換文字（顯示↔隱藏）並設 `aria-pressed`。
   - W3C APG 指出：用 `aria-pressed` 時標籤不能隨狀態變；若要換標籤就不要用 `aria-pressed`。
   - 二選一：標籤固定「顯示密碼」＋`aria-pressed`，或只換文字、不設 `aria-pressed`。
   - 「顯示／隱藏」兩字太短，建議無障礙名稱帶「密碼」。
6. **【網頁要求】手機只剩 ✓ 圖示的主要動作鈕，要保證名稱含可見文字。**
   - WCAG 2.5.3（A）要求名稱包含畫面上看得到的文字。桌機顯示「變更」時，名稱要以「變更」開頭（例如「變更密碼」）。
   - 手機只有圖示時，仍要有 `aria-label`（WCAG 4.1.2）。
   - HIG 偏好用符號、但像 Done／Submit 這類動作可用文字。✓ 圖示加文字沒有衝突。
7. **【原生建議】主要動作鈕「只有送出中才停用」與 HIG 的建議有落差。** 這是最大的取捨，見下方 owner 拍板第 1、2 項。

### 三、需要 owner 拍板的取捨

HIG 的文字在這些點上互相拉扯，或沒有明確規定。

| # | 取捨 | 我的推薦 |
|---|---|---|
| 1 | 輸入不合法時要不要停用「變更」 | 只在「兩欄任一為空」或「送出中」停用；不合法內容（過短、相同）不停用，讓使用者按了能看到原因 |
| 2 | 驗證時機：即時 vs 送出後 | 新密碼長度與「和目前相同」在離開欄位（blur）後顯示，並在按「變更」時再檢查；伺服器錯誤（目前密碼錯、限流）送出後顯示 |
| 3 | 動作鈕文字：變更／完成／儲存 | 沿用「變更」。見下方理由 |
| 4 | 顯示／隱藏切換的位置與標籤 | 位置（新密碼列最右）維持；標籤改「顯示密碼」固定＋`aria-pressed`；「目前密碼」列是否也加切換要拍板，我推薦不加 |
| 5 | 要不要 Cancel | Web 頁面不加；App modal 保留 Cancel |
| 6 | 要不要「再輸入一次新密碼」確認欄 | 不加，靠顯示切換與密碼管理員 |

各項理由見第四節「建議與理由」。

## 詳細對照

### A. 來源明文整理

#### A1. Apple HIG（原生建議）

| 主題 | 來源明文（改寫） | 來源 |
|---|---|---|
| Text fields：secure | 要求密碼這類敏感資料時，一律用 secure text field | [text-fields](https://developer.apple.com/design/human-interface-guidelines/text-fields) |
| Text fields：hint | placeholder 在使用者開始輸入後會消失，因此要另放標籤說明用途 | 同上 |
| Text fields：驗證時機 | 驗證要看情境。email 在切換到別的欄位時驗證；建立使用者名稱或密碼時，驗證要在離開該欄位**之前**進行 | 同上 |
| Text fields：欄位排列 | 多欄位要均勻間距、垂直堆疊、寬度一致、Tab 順序合乎邏輯 | 同上 |
| Entering data：不預填密碼 | 絕不預先填入密碼欄位，要請使用者輸入或使用生物辨識／鑰匙圈 | [entering-data](https://developer.apple.com/design/human-interface-guidelines/entering-data) |
| Entering data：即時驗證 | 一輸入就驗證、發現問題就回饋，讓人當場修正，不必填完整份表單再回頭 | 同上 |
| Entering data：可繼續才啟用 | 欄位後面若有 Next／Continue 鈕，僅在必要資料輸入後才讓它可用 | 同上 |
| Entering data：secure entry | 敏感資料用遮蔽輸入，通常每個字元顯示一個實心圓點 | 同上 |
| Lists and tables | grouped 樣式用標頭、頁尾和額外間距分組；iOS 設定用層層列表。HIG 本頁沒有談「列內放輸入框」 | [lists-and-tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) |
| Toolbars：返回 | 用標準的 Back／Close 符號，不用「Back」「Close」文字標籤 | [toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) |
| Toolbars：主要動作 | 主要動作（Done、Submit 這類）放在 trailing 側，且只指定一個 | 同上 |
| Toolbars：符號 vs 文字 | 偏好簡單易辨的符號；像 edit 這類符號難表達的動作例外 | 同上 |
| Toolbars：標題 | 標題要簡潔，建議不超過 15 個字元 | 同上 |
| Sheets | sheet 單一畫面時，Cancel 在頂部工具列 leading、Done 在 trailing；有 Done 就要搭配 Cancel 或 Back，不要三個一起出現 | [sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) |
| Sheets：Cancel 與 Done 語意 | Cancel 不儲存直接關閉；Done 在完成任務或明確儲存後關閉 | 同上 |
| Modality | modal 任務要簡短；一定要給明顯的關閉方式；有未存內容時，關閉前要確認 | [modality](https://developer.apple.com/design/human-interface-guidelines/modality) |
| Buttons：主要角色 | 主要角色給使用者最可能選的按鈕；按鈕做長時間動作時可顯示進度指示並改標籤（「Checkout」→「Checking out…」） | [buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) |
| Buttons：文字 vs 圖示 | 文字比圖示更清楚時用文字，標籤建議以動詞開頭 | 同上 |
| Alerts | 標題要具體；按鈕標題用能描述結果的動詞，避免單用 OK。注意：Alerts 頁沒有談表單欄位的 inline 錯誤 | [alerts](https://developer.apple.com/design/human-interface-guidelines/alerts) |
| Writing：錯誤訊息 | 錯誤要貼近問題處、不責備、說明怎麼修正；舉例「Choose a password with at least 8 characters」優於「too short」 | [writing](https://developer.apple.com/design/human-interface-guidelines/writing) |
| Writing：欄位錯誤 | 錯誤顯示在欄位旁，指導如何正確輸入，不要斥責；避免「Invalid name」這類無資訊文字 | 同上 |
| Writing：按鈕標籤 | 按鈕與連結幾乎都該用動詞，清楚比俏皮重要 | 同上 |
| Writing：設定標籤 | 設定標籤要清楚簡單；標籤不夠時加說明 | 同上 |
| Accessibility：大字 | 理想上讓使用者能把文字放大至少 200% | [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) |
| Accessibility：對比 | 以 WCAG AA 為參考值；表中 17pt 以下一律 4.5:1 | 同上 |
| Accessibility：不只靠顏色 | 資訊不要只靠顏色傳遞，要加形狀或圖示 | 同上 |
| Accessibility：控制項尺寸 | iOS／iPadOS 預設 44×44 pt、最小 28×28 pt | 同上 |
| Managing accounts | 若不用 Sign in with Apple，優先用 passkey；若仍用密碼，建議加雙重驗證。避免用「passcode」稱呼帳號驗證。HIG 沒有「變更密碼」專頁 | [managing-accounts](https://developer.apple.com/design/human-interface-guidelines/managing-accounts) |

**沒取得的 HIG 頁面**：我試過 `passwords-and-passkeys`、`passkeys`、`autofill`、`authentication`，資料端點都回 404；HIG 目錄 JSON 裡也沒有對應條目。結論是 HIG 沒有獨立的「密碼／AutoFill」頁，相關內容只在 Managing accounts 與 Entering data。
HIG 的 `navigation-bars` 同樣 404，導覽列內容併在 Toolbars。

#### A2. Web 標準（網頁要求）

| 主題 | 來源明文（改寫） | 來源 |
|---|---|---|
| 3.3.1 Error Identification（A） | 自動偵測到輸入錯誤時，要指出哪一項錯，並用文字描述 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/#error-identification) |
| 3.3.2 Labels or Instructions（A） | 需要輸入時要提供標籤或說明 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/#labels-or-instructions) |
| 3.3.3 Error Suggestion（AA） | 已知修正建議時要提供，除非會危害安全或目的 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/#error-suggestion) |
| 3.3.4 Error Prevention（AA） | 會修改使用者可控資料的頁面，要可還原、或檢查並讓人修正、或可確認後才送出，三者至少一項 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/#error-prevention-legal-financial-data) |
| 3.3.7 Redundant Entry（A） | 同一流程內重複要求的資訊要自動帶入或可選，但為了安全而需重新輸入者例外 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/#redundant-entry) |
| 3.3.8 Accessible Authentication（AA） | 驗證流程不得要求認知功能測試（如記住密碼），除非提供替代方式或輔助機制 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/#accessible-authentication-minimum) |
| 3.3.8 Understanding | 輔助機制包含支援密碼管理員填入、允許貼上；若程式碼擋住管理員填入或貼上，頁面會失敗。也提到「可選擇顯示密碼」能幫助部分有認知或打字困難的人 | [Understanding 3.3.8](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html) |
| 1.3.5 Identify Input Purpose（AA） | 蒐集使用者資訊的欄位，其用途要能被程式判讀；規格列出 `new-password`（建立帳號或變更密碼時）與 `current-password` | [WCAG 2.2](https://www.w3.org/TR/WCAG22/#identify-input-purpose) |
| 2.5.8 Target Size（AA） | 指標目標至少 24×24 CSS px，附間距、等效、行內等例外 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/#target-size-minimum) |
| 2.5.3 Label in Name（A） | 有文字標籤的元件，其名稱要包含畫面上呈現的文字 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/#label-in-name) |
| 2.4.7 Focus Visible（AA） | 鍵盤可操作的介面要有可見焦點指示 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/#focus-visible) |
| 1.4.3／1.4.11 | 一般文字 4.5:1；UI 元件與狀態 3:1，但**停用（inactive）元件例外** | [WCAG 2.2](https://www.w3.org/TR/WCAG22/#non-text-contrast) |
| 1.4.4／1.4.10 | 文字可放大至 200% 不失內容；320 CSS px 寬不需雙向捲動 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/#resize-text) |
| 4.1.3 Status Messages（AA） | 狀態訊息要能透過 role 等被輔助科技朗讀，不需取得焦點 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/#status-messages) |
| HTML autocomplete | 規格定義 `new-password`（建立帳號或變更密碼時的新密碼）與 `current-password`（對應 username 欄位那組帳號的目前密碼）；也規定 `username` | [WHATWG HTML 4.10.18](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill) |
| `passwordrules` | Apple 文件說這個 HTML 屬性（或 iOS 的 `passwordRules`）可客製自動產生密碼的規則，格式是 `required:`／`allowed:`／`max-consecutive:` 等，並說規則過弱時使用者代理會忽略。**它是 Apple／Safari 的機制，不在 WHATWG 規格內** | [Apple：Customizing Password AutoFill rules](https://developer.apple.com/documentation/security/customizing-password-autofill-rules) |
| 顯示切換的 ARIA | APG 說用 `aria-pressed` 的切換鈕，標籤不得隨狀態改變；若標籤要變，就不要設 `aria-pressed` | [W3C APG Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/) |

**沒取得**：
- `github.com/apple/password-rules-validation-tool`：回 404。
- WebKit 部落格的 password rules 文章：我試的兩個網址都 404。
- 因此 `passwordrules` 只引 Apple Developer 文件，沒有 WebKit 官方文件佐證。
- HTML 規格內沒有專談「input type=password 顯示切換」的條文，這部分只有上面 Understanding 3.3.8 與 APG 兩個來源，沒有更多一手建議。

### B. 變體 B 逐項對照

| # | 項目 | 判定 | 分類 | 依據與說明 |
|---|---|---|---|---|
| 1 | TitleBar：左返回箭頭＋標題「變更密碼」 | 符合 | 原生建議 | HIG 偏好 Back 符號、不用文字；標題 5 字，遠低於建議 15 字上限。這頁是階層推進，不是 sheet，用 Back 合理 |
| 2 | 右上單一主要動作「變更」 | 符合 | 原生建議 | HIG：主要動作放 trailing，且只有一個 |
| 3 | 動作鈕 ✓＋文字，手機只剩圖示 | 有疑慮 | 網頁要求 | HIG 允許符號。但手機純圖示要有無障礙名稱（4.1.2），且名稱要含可見文字「變更」（2.5.3） |
| 4 | 動作鈕只有送出中才停用 | 與 HIG 有落差 | 原生建議＋owner 決策 | 見第四節「建議與理由」第 1、2 點 |
| 5 | inset grouped 列表、label 左、輸入框右 | 符合 | 原生建議 | 與 iOS 設定風格一致。但 HIG 沒有談列內輸入框，是設計慣例延伸，不是明文 |
| 6 | 列高 52px、顯示鈕 44×44 | 符合 | 網頁要求＋原生建議 | 遠超 WCAG 2.5.8 的 24 px；也符合專案 44 CSS px 目標（owner 決策，見 `DESIGN.md`）。HIG 的 44 pt 是原生值，不是 CSS 要求 |
| 7 | 輸入框 `outline: none` | 疑慮／可能缺陷 | 網頁要求 | WCAG 2.4.7。若全域沒補整列焦點樣式就不符。要實測 |
| 8 | `autocomplete` 屬性 | 缺 | 網頁要求 | 1.3.5、3.3.8。兩欄分別加 `current-password`／`new-password` |
| 9 | 未擋貼上（原型沒有阻擋） | 符合（要維持） | 網頁要求 | 3.3.8。正式實作不可加 `onPaste` 阻擋 |
| 10 | 不預填密碼 | 符合 | 原生建議 | HIG Entering data |
| 11 | 規則「至少 8 字元」只在 placeholder | 不符 | 網頁要求＋原生建議 | HIG 說 placeholder 會消失；WCAG 3.3.2 要說明。移進常駐小字 |
| 12 | 「必填」placeholder | 小疑慮 | 推論 | 另有標籤，placeholder 只是補充；但 placeholder 顏色對比通常偏低，若承載資訊須達 4.5:1（1.4.3）。可直接拿掉 |
| 13 | 錯誤文案（4 則） | 大致符合，可再強化 | 原生建議 | 見下方文案審視 |
| 14 | 錯誤就地、紅色小字、`role="alert"` | 大致符合 | 網頁要求＋原生建議 | 貼近欄位下方（列表下）符合 HIG 與 3.3.1。紅字之外有文字，符合「不只靠顏色」。缺欄位關聯與焦點移動（見摘要第 4 點） |
| 15 | 錯誤出現時取代說明小字 | 有疑慮 | 推論 | 說明（含規則與「其他裝置會被登出」）一消失，使用者就看不到規則了。建議錯誤另起一行或保留規則 |
| 16 | 成功後顯示「✓ 已更新」附在說明字後 | 有疑慮 | 網頁要求 | 4.1.3 要能被朗讀，目前那行是一般 `<p>` 沒有 role。要加 `role="status"` 或另設 live region，並考慮成功後導回或明確回饋 |
| 17 | 顯示／隱藏：新密碼列最右、文字鈕 | 位置符合 | 原生建議 | HIG：trailing 端放輔助功能鈕（Text fields 頁）。標籤用法有疑慮，見摘要第 5 點 |
| 18 | 顯示切換的存在本身 | 符合 | 網頁要求（鼓勵項） | 3.3.8 Understanding 說可選擇顯示密碼能幫助部分使用者 |
| 19 | 固定欄寬 `7rem`／`5.5rem` 的 label | 要實測 | 網頁要求＋原生建議 | rem 會隨字級放大，方向對。要在 200%（1.4.4／HIG）與 320 px（1.4.10）實測是否折行或擠壓輸入框 |
| 20 | Cancel | 無（Web 頁） | 原生建議 | Web 頁用返回即可；HIG 的 Cancel＋Done 規則是針對 sheet |
| 21 | 說明文字「其他裝置會被登出，這台維持登入」 | 符合 | 原生建議＋推論 | HIG Writing：標籤不夠時加說明。這是會影響使用者的後果，事前告知是好做法 |
| 22 | 3.3.4 Error Prevention | 要確認 | 網頁要求＋推論 | 變更密碼會修改使用者資料，屬於適用範圍。「檢查並讓人修正」可由驗證滿足；是否要「確認」要看規格。我的看法是：要求輸入目前密碼本身就是一道確認，且錯誤可在送出時修正，應已滿足「已檢查」那一項，但這是推論，不是標準明文 |

#### 錯誤文案審視（原生建議，依 HIG Writing）

| 現行文案 | 判斷 | 建議 |
|---|---|---|
| 「新密碼至少 8 字元」 | 說明了規則，符合「說明怎麼修正」 | 可保留。HIG 的範例更偏向指示語氣，如「請設定至少 8 字元的新密碼」，非必要 |
| 「新密碼不能和目前密碼相同」 | 說明清楚，語氣中性不責備 | 保留 |
| 「目前密碼不正確」 | 陳述事實，沒有指引下一步 | 可選：「目前密碼不正確，請再試一次」（【推論】；HIG 要求說明如何修正，但這裡下一步顯而易見） |
| 「嘗試次數過多，請在 30 分鐘後再試」 | 有原因、有下一步 | 保留。若後端能給實際剩餘時間，應用實際值，不要寫死 30 |

### C. 兩個來源互相拉扯之處

| 情況 | 來源 A | 來源 B | 我的處理 |
|---|---|---|---|
| 按鈕要不要預先停用 | HIG Entering data：可繼續才啟用 | HIG Text fields：驗證要在離開欄位前；Web 上停用鈕難以讓人知道「為什麼不能按」；WCAG 對停用元件對比有豁免，但這代表使用者可能看不清它為何停用（【推論】） | 只對「空欄」停用，內容錯誤交給訊息 |
| 密碼驗證時機 | HIG Text fields：建立密碼時，要在離開欄位前驗證 | HIG Entering data：一輸入就驗證 | 兩者其實一致傾向「早」。但每打一個字就跳紅字會干擾；折衷是離開欄位後驗證 |
| Done vs 具體動詞 | HIG Sheets：Done 用於完成或儲存 | HIG Writing／Buttons：動詞、具體 | 見下 |

## 建議與理由

1. **動作鈕只對空欄停用（含送出中）。**
   - 理由（原生建議）：HIG 希望「必要資料沒填完不能繼續」，所以兩欄皆空時停用符合；
   - 理由（網頁／推論）：Web 的停用鈕對鍵盤與螢幕閱讀器使用者不好探索，也沒辦法告訴他「為什麼」，所以內容不合法（過短、相同）時讓他按下去、看到具體訊息。
   - 這是折衷，**需要 owner 拍板**；若 owner 想完全貼 HIG，可改成「新密碼不到 8 字元或兩欄為空就停用」，代價是要在旁邊另外顯示規則提示。

2. **驗證時機：離開欄位後驗證本地規則，送出後處理伺服器規則。**
   - 本地規則（長度、與目前密碼相同）在 blur 後顯示，並在按「變更」時再檢查一次，避免只填不離開欄位就送出的情況。
   - 伺服器規則（目前密碼錯、限流）只能送出後才知道。
   - 理由（原生建議）：HIG 說密碼要在離開欄位前驗證，且偏向「早」；理由（推論）：每個字元都跳錯誤會讓人焦慮，也會讓螢幕閱讀器反覆朗讀。
   - 這屬於【owner 決策】。如果 owner 偏好最貼近 HIG 的即時行為，也可以在輸入時就顯示（但先用中性灰字提示規則，離開欄位後才轉紅字）。

3. **按鈕字眼沿用「變更」。**
   - HIG Sheets 的 Done 是「完成任務或儲存」，是通用字眼；但 HIG Writing 與 Buttons 偏好具體動詞。
   - 「變更」具體、對應頁面標題「變更密碼」，不會有「儲存」暗示「草稿」的歧義。
   - 若 owner 想和 App 版 modal 完全一致，兩邊應用同一個詞（HIG 要求跨平台一致分組與位置）。這屬於【owner 決策】。

4. **顯示／隱藏：位置維持，標籤與 ARIA 二選一。**
   - 位置維持在新密碼列最右（HIG：trailing 放輔助功能）。
   - 標籤用「顯示密碼」固定不變＋`aria-pressed`。
   - 「目前密碼」列我不建議加切換：使用者通常靠密碼管理員，少一個控制項畫面更簡潔；這是【推論】。
   - 注意：顯示密碼時要避免在公共畫面分享情境洩露，這是產品決策，來源沒有談。

5. **Web 頁不加 Cancel。** HIG 的規則是「Done 要搭配 Cancel 或 Back」，變體 B 已經有 Back。App 版是 modal，維持 Cancel＋變更。

6. **不加「確認新密碼」欄。**
   - 來源沒有要求。
   - 顯示切換加密碼管理員已能降低輸入錯誤；3.3.7 的 Redundant Entry 對「為了安全需重新輸入」有例外，所以這個決定不會違規。
   - 【owner 決策】。

7. **補 `passwordrules`（可選）。**
   - `passwordrules` 只影響 Safari 自動產生的強密碼；Apple 文件說規則過弱時會被忽略。
   - 如果後端密碼規則只有「≥8 字元」，其實不必設。想設的話，內容要與後端規則完全一致，否則自動產生的密碼可能被後端拒絕。
   - 【推論】建議先不加，等後端規則定案。

8. **其他必做。**
   - 成功訊息要能被朗讀（4.1.3）。
   - 兩欄都加 `name`，讓管理員辨識。
   - 在 200% 字級與 320 px 寬度實測 label 欄。
   - 實測焦點可見性。
   - 隱藏 username 欄位幫密碼管理員綁定帳號（推論）。

## 來源清單

**Apple HIG（資料端點內容，已讀）**
- <https://developer.apple.com/design/human-interface-guidelines/text-fields>
- <https://developer.apple.com/design/human-interface-guidelines/entering-data>
- <https://developer.apple.com/design/human-interface-guidelines/lists-and-tables>
- <https://developer.apple.com/design/human-interface-guidelines/toolbars>
- <https://developer.apple.com/design/human-interface-guidelines/sheets>
- <https://developer.apple.com/design/human-interface-guidelines/modality>
- <https://developer.apple.com/design/human-interface-guidelines/buttons>
- <https://developer.apple.com/design/human-interface-guidelines/alerts>
- <https://developer.apple.com/design/human-interface-guidelines/writing>
- <https://developer.apple.com/design/human-interface-guidelines/accessibility>
- <https://developer.apple.com/design/human-interface-guidelines/managing-accounts>
- <https://developer.apple.com/design/human-interface-guidelines/settings>（已讀，內容是 app 設定區的組織，與本頁關係不大，未引用）

**Web 標準**
- <https://www.w3.org/TR/WCAG22/>
- <https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html>
- <https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill>
- <https://developer.apple.com/documentation/security/customizing-password-autofill-rules>
- <https://www.w3.org/WAI/ARIA/apg/patterns/button/>

**專案內部**
- `/Users/ray/Projects/trip-planner-wt-proto/DESIGN.md`（「Web 設計驗收與來源」）
- `/Users/ray/Projects/trip-planner-wt-proto/AGENTS.md`
- `/Users/ray/Projects/trip-planner-wt-proto/src/pages/prototype/ChangePasswordPrototype.tsx`（VariantB）

**沒取得 / 限制**
- HIG 沒有 `passwords-and-passkeys`、`passkeys`、`autofill`、`navigation-bars` 這幾個頁面（資料端點 404，目錄也沒有）。
- `github.com/apple/password-rules-validation-tool` 與 WebKit 部落格的 password rules 文章：404，未取得。
- 原型網址（127.0.0.1:5199）沒有連線檢查；變體 B 的判斷只依原始碼，視覺與全域 CSS（例如是否有補焦點樣式）未實測。
- 以上「推論」標記的項目都是我的判斷，不是來源明文。
