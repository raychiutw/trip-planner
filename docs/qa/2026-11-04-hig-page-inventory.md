# web 頁面完整清單與 mock 場景對照（HIG 取證用）

**目前數字**（#1568 彙整，以 `SCENES` 與路由表為準）：80 個場景、316 張截圖；路由表 54 條：已取證 47、已排除 6、缺口 1；彈出層 22 個：已取證 19、缺口 3。逐項對照與覆蓋率見 review 報告文末「覆蓋率」。

來源：flutter#531、trip-planner#1564。日期：2026-11-04，依 `src/entries/main.tsx` 的路由表產生。

## 狀態說明
- **已取證**：已有 `tests/e2e/hig-scene-fixtures.js` 的場景，手機寬與桌機寬、淺色與深色各一張截圖（`popup-trip-sheet` 只有桌機寬、`add-custom-stop` 只有手機寬）。**不代表每張圖都逐張看過**：看過與沒看的清單在 `2026-11-04-hig-web-screenshot-review.md` 開頭的「web 取證的缺口與現況」。
- **部分**：該頁只在別的場景裡當背景出現，沒有自己的取證。
- **未取證**／**缺口**：沒有場景；欄位內寫原因（路由是「尚未造」，彈出層是「使用者走不到，造不出真實狀態」）。
- **已排除**：不是畫面（純轉址）或不在 HIG 比對範圍，附理由。
- **mock 場景**：能用 Playwright 加 API mock 開出該畫面的場景。`既有 e2e` 欄列出已有 e2e 規格提到該路徑的檔案數，只是起點。路由別名（`/settings/*`）與 `/account/*` 是同一個元件，只取證一次。
- 守門：`tests/unit/hig-page-inventory.test.ts` 比對路由表，新增路由未登記會變紅。

## 路由

| 路由 | 元件 | 狀態 | 既有 e2e（檔案數） | mock 場景 |
|---|---|---|---|---|
| `/account` | AccountPage | 已取證 | 12 | account |
| `/account/appearance` | AppearanceSettingsPage | 已取證 | 3 | account-appearance |
| `/account/notifications` | NotificationsSettingsPage | 已取證 | 3 | account-notifications |
| `/account/sessions` | SessionsPage | 已取證 | 5 | account-sessions |
| `/account/password` | ChangePasswordPage | 已取證 | 0 | change-password、change-password-current-invalid、change-password-too-short、change-password-same、change-password-rate-limited、change-password-success（要旗標，走埠 3001 的建置） |
| `/account/connected-apps` | ConnectedAppsPage | 已取證 | 3 | account-connected-apps |
| `/settings/appearance` | AppearanceSettingsPage | 已取證（路由別名，同元件） | 0 | account-appearance（同一元件，未另開場景） |
| `/settings/notifications` | NotificationsSettingsPage | 已取證（路由別名，同元件） | 0 | account-notifications（同一元件，未另開場景） |
| `/settings/sessions` | SessionsPage | 已取證（路由別名，同元件） | 4 | account-sessions（同一元件，未另開場景） |
| `/settings/connected-apps` | ConnectedAppsPage | 已取證（路由別名，同元件） | 1 | account-connected-apps（同一元件，未另開場景） |
| `/` | LandingPage | 已取證 | 0 | landing |
| `/admin` | Navigate | 已排除（純轉址，不是畫面） | 0 | — |
| `/admin/` | Navigate | 已排除（純轉址，不是畫面） | 0 | — |
| `/manage` | Navigate | 已排除（純轉址，不是畫面） | 0 | — |
| `/manage/` | Navigate | 已排除（純轉址，不是畫面） | 0 | — |
| `/chat` | ChatPage | 已取證 | 6 | chat |
| `/map` | GlobalMapPage | 已取證（場景限制：地圖被擋，畫面是「地圖暫停服務」，不是真實地圖） | 9 | map |
| `/explore` | ExplorePage | 已取證 | 4 | explore |
| `/favorites` | PoiFavoritesPage | 已取證 | 8 | favorites（空狀態）、favorites-list（有一筆收藏） |
| `/favorites/:id/add-to-trip` | AddPoiFavoriteToTripPage | 已取證 | 0 | favorite-add-to-trip（選好行程、載入天數後的表單；`popup-conflict-modal` 另以此頁為背景） |
| `/add-to-trip` | AddPoiFavoriteToTripPage | 已取證 | 4 | add-to-trip（direct mode：帶 place_id／name／lat／lng／address／category 的 query，選行程後載入天數；缺 query 會是「景點資料缺漏」錯誤態，未另取證） |
| `/privacy` | PrivacyPage | 已取證 | 3 | privacy |
| `/login` | LoginPage | 已取證 | 6 | login、login-error、login-rate-limited |
| `/signup` | SignupPage | 已取證 | 3 | signup |
| `/signup/check-email` | EmailVerifyPendingPage | 已取證 | 1 | signup-check-email |
| `/login/forgot` | ForgotPasswordPage | 已取證 | 1 | forgot-password |
| `/auth/password/reset` | ResetPasswordPage | 已取證 | 1 | reset-password |
| `/auth/verify-email` | VerifyEmailPage | 已取證 | 1 | verify-email |
| `/s/:token` | TripSharePage | 已取證 | 14 | trip-share（mock `GET /api/share/:token`；資料取自既有行程 mock，所以起訖時間顯示「—」、副標的國別是 mock 原值） |
| `/developer/apps` | DeveloperAppsPage | 已取證 | 5 | developer-apps |
| `/developer/apps/new` | DeveloperAppNewPage | 已取證 | 3 | developer-apps-new |
| `/oauth/consent` | ConsentPage | 已取證 | 1 | oauth-consent、oauth-consent-unknown-scope、oauth-consent-error |
| `/oauth/authorize` | OauthAuthorizePage | 已取證 | 0 | oauth-authorize、oauth-authorize-scopes、oauth-authorize-login、oauth-authorize-login-error、oauth-authorize-error（走埠 3001 的建置，憑證種進 IndexedDB） |
| `/auth/callback` | AuthCallbackPage | 已取證 | 0 | auth-callback（種入 Google 登入暫存、token 端點不回應，畫面停在「登入中…」；成功與失敗是轉址，不是畫面） |
| `/invite` | InvitePage | 已取證 | 1 | invite、invite-invalid |
| `/trips` | TripsListPage | 已取證 | 21 | trips-list、trips-list-empty、trips-list-error |
| `/trips/new` | NewTripPage | 已取證 | 2 | trips-new |
| `/trip/:tripId` | TripLayout | 已取證 | 26 | trip-detail |
| `map` | MapPage | 已取證（場景限制：地圖被擋，畫面是「地圖暫停服務」，不是真實地圖） | 19 | trip-map |
| `stop/:entryId` | StopDetailRedirect | 已排除（轉址到 `/trips?selected=…&focus=…`，不是畫面） | 9 | — |
| `stop/:entryId/map` | MapPage | 缺口 | 0 | 無場景：與 `map` 同一元件，Google Maps 的 browser key 限制允許網址，localhost 一律 RefererNotAllowedMapError，場景只能拍到「地圖暫停服務」錯誤態，不是單點地圖的真實畫面；只能以真機或允許的網址取證 |
| `print` | TripPrintPage | 已取證 | 1 | trip-print |
| `edit` | EditTripPage | 已取證 | 9 | trip-edit |
| `stop/:entryId/copy` | EntryActionPage | 已取證 | 0 | trip-stop-copy |
| `stop/:entryId/move` | EntryActionPage | 已取證 | 0 | trip-stop-move |
| `stop/:entryId/change-poi` | ChangePoiPage | 已取證（只有初始空搜尋態） | 0 | trip-stop-change-poi |
| `stop/:entryId/edit` | EditEntryPage | 已取證 | 0 | trip-stop-edit |
| `add-stop` | AddStopPage | 已取證 | 5 | trip-add-stop |
| `add-entry` | AddEntryPage | 已取證 | 2 | trip-add-entry |
| `collab` | CollabPage | 已取證 | 9 | trip-collab |
| `health` | TripHealthCheckPage | 已取證 | 3 | trip-health |
| `notes` | TripNotesPage | 已取證 | 4 | trip-notes |
| `add-custom-stop` | (巢狀 element) | 已取證（只有手機寬；地圖位置區是錯誤態） | 3 | trip-add-custom-stop（手機專用路由，桌機寬會轉址到 `add-stop`，不取桌機圖） |
| `*` | LegacyRedirect | 已排除（純轉址，不是畫面） | 0 | — |

## 彈出層（Sheet／Modal／Dialog／Popover／Toast／Banner）

| 元件 | 說明 | 狀態 | mock 場景 |
|---|---|---|---|
| AccountSheet | 帳號頁以 sheet 開在背景頁之上 | 已取證 | `popup-account-sheet` |
| AiConsentSheet | AI 使用同意（聊天送出時 owner 尚未授權 AI） | 已取證 | `popup-ai-consent-sheet` |
| AiDataConsentSheet | AI 資料同意（聊天送出時尚未同意資料處理） | 已取證 | `popup-ai-data-consent-sheet`（只有 consent 模式；owner-missing 模式未造） |
| TripPickerPopover | 探索頁選行程 | 缺口 | 無：元件沒有任何掛載點（`src/` 內只有它自己的檔案與測試引用；`ExplorePage` 只剩註解、`TripsListPage` 剩一組無人使用的 `tripPickerOpen` state），使用者走不到，造不出真實狀態 |
| ShareLinkModal | 分享連結 | 已取證 | `popup-share-link-modal` |
| ConfirmModal | 確認對話框 | 已取證 | `popup-confirm-modal`（只有「登出其他所有裝置」一個呼叫端） |
| ConflictModal | 衝突對話框 | 已取證 | `popup-conflict-modal` |
| InputModal | 輸入對話框 | 已取證 | `popup-input-modal`（探索頁「自訂地區」） |
| NoteAiExclusionsDialog | 筆記 AI 排除 | 已取證 | `popup-note-ai-exclusions-dialog` |
| CollabSheet | 共編設定 | 缺口 | 無：唯一掛載點是 `TripPage` 內的 `<InfoSheet open={activeSheet === 'collab'}>`，而 `activeSheet` 只會被 `TripPageHandle.openSheet()` 設定，全 `src/` 沒有任何呼叫端；`?sheet=collab` 會直接轉址到 `/trip/:id/collab` 頁。使用者走不到 |
| InfoSheet | 資訊 | 缺口 | 無：同上，唯一掛載點與 CollabSheet 相同，沒有入口；造不出真實狀態 |
| TravelPillDialog | 交通方式 | 已取證 | `popup-travel-pill-dialog` |
| TripSheet / TripSheetTabs | 行程 sheet | 已取證（僅桌機寬） | `popup-trip-sheet`（聊天分頁；手機寬該欄 display:none，所以只取桌機寬。地圖分頁受 Google Maps 被擋的限制，見 review 發現 4） |
| TripCardMenu | 行程卡「⋯」錨定選單（`TripsListPage`） | 已取證 | `popup-trip-card-menu`（owner-only 的「封存」項在場景中不出現：選單用 `user.id` 比對 `ownerUserId`，mock 登入帳號對不上；見下「已知缺口」） |
| TripActionsMenu | 行程頁標題列「⋯」錨定選單（`TripStackLayout`、`TripsListPage` 桌機嵌入） | 已取證 | `popup-trip-actions-menu`（同樣沒有「封存」項） |
| RailRowMenu | 時間軸停留點列的「⋯」錨定選單（popover API） | 已取證 | `popup-rail-row-menu` |
| TripSelect | 下拉面板（Headless UI Listbox） | 已取證 | `popup-trip-select`（行程清單排序） |
| TripDatePicker | 日期面板 | 已取證 | `popup-trip-date-picker`（新增行程的出發日；spec 固定「今天」為 2026-11-06） |
| TripTimePicker | 時間面板（時／分兩欄） | 已取證 | `popup-trip-time-picker`（加入行程表單的開始時間） |
| ErrorBanner | 錯誤橫幅 | 已取證 | `popup-error-banner`（另有 `login-error`、`trips-list-error` 也渲染同一元件） |
| ServerStatusBanner | 伺服器狀態橫幅 | 已取證 | `popup-server-status-banner` |
| Toast | 提示訊息 | 已取證 | `popup-toast-error`、`popup-toast-online`（error 與 online 兩種；離線 Toast 在全域橫幅在場時不再出現，#1587 14；success、info 未造） |

## 已知缺口
- `/account/password`、`/oauth/consent`、`/oauth/authorize`、`/auth/callback` 已由 #1565 補場景（見路由表）。
- #1566 補：錨定選單與下拉面板六個元件已造場景（見彈出層表）；`popup-trip-select` 與時間、日期面板各只取一個呼叫端，其他呼叫端（筆記區塊的日期時間、編輯行程的語言下拉等）同一元件，未逐一取證。`TripCardMenu`／`TripActionsMenu` 的「封存」「還原」項（owner-only）沒有場景：mock 登入帳號與行程 `ownerUserId` 對不上，屬缺口。地圖類場景（`map`、`trip-map` 與 `popup-trip-sheet` 的地圖分頁）受 Google Maps 被擋限制，畫面是「地圖暫停服務」，不是真實地圖。
- 彈出層清單由元件檔名比對得出，沒有對應的比對測試；錨定選單（`TripCardMenu`、`TripActionsMenu`、`RailRowMenu`）與下拉面板（`TripDatePicker`、`TripTimePicker`、`TripSelect`）後來已補進上表，目前共 22 列。
- 路由未取證 1 條（見上表「缺口」列）：`stop/:entryId/map`（Google Maps 被擋，只拍得到錯誤態）。已處理：#1566 補 `/add-to-trip`（`/favorites/:id/add-to-trip` 另有獨立場景）；#1567 補 `/s/:token`、`stop/:entryId/{copy,move,change-poi,edit}`、`add-custom-stop`。
- 彈出層缺口 3 個：`TripPickerPopover`、`CollabSheet`、`InfoSheet`，都是沒有入口的元件（死碼，已另開 PR #1584 移除；本 PR 不動產品）。
