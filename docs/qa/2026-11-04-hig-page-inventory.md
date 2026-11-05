# web 頁面完整清單與 mock 場景對照（HIG 取證用）

來源：flutter#531、trip-planner#1564。日期：2026-11-04，依 `src/entries/main.tsx` 的路由表產生。

## 狀態說明
- **已取證**：已有 `tests/e2e/hig-scene-fixtures.js` 的場景，手機寬與桌機寬、淺色與深色各一張截圖，並已逐張檢查（結果見 `2026-11-04-hig-web-screenshot-review.md`；哪些圖沒有逐張看也記在那裡）。
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
| `/account/password` | ChangePasswordPage | 待取證 | 0 | 尚未造：需 mock 目前登入帳號與 `POST /account/password` 的各種回應（成功、目前密碼錯、被限流）；合併後再補場景 |
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
| `/favorites` | PoiFavoritesPage | 已取證 | 8 | favorites |
| `/favorites/:id/add-to-trip` | AddPoiFavoriteToTripPage | 部分（只當彈出層背景） | 0 | 無獨立場景；`popup-conflict-modal` 以此頁為背景，表單畫面被對話框蓋住，不算此頁的取證 |
| `/add-to-trip` | AddPoiFavoriteToTripPage | 未取證 | 4 | 無場景：direct mode 需 place_id／name／lat／lng 等 query 與選行程流程，尚未造 |
| `/privacy` | PrivacyPage | 已取證 | 3 | privacy |
| `/login` | LoginPage | 已取證 | 6 | login、login-error、login-rate-limited |
| `/signup` | SignupPage | 已取證 | 3 | signup |
| `/signup/check-email` | EmailVerifyPendingPage | 已取證 | 1 | signup-check-email |
| `/login/forgot` | ForgotPasswordPage | 已取證 | 1 | forgot-password |
| `/auth/password/reset` | ResetPasswordPage | 已取證 | 1 | reset-password |
| `/auth/verify-email` | VerifyEmailPage | 已取證 | 1 | verify-email |
| `/s/:token` | TripSharePage | 未取證 | 14 | 無場景：公開分享頁，需另造 share 讀取 API 的 mock |
| `/developer/apps` | DeveloperAppsPage | 已取證 | 5 | developer-apps |
| `/developer/apps/new` | DeveloperAppNewPage | 已取證 | 3 | developer-apps-new |
| `/oauth/consent` | ConsentPage | 未取證 | 1 | 無場景：需 OAuth 授權請求參數與 consent API 的 mock |
| `/oauth/authorize` | OauthAuthorizePage | 未取證 | 0 | 無場景：需 OAuth 授權請求參數與 authorize API 的 mock |
| `/invite` | InvitePage | 已取證 | 1 | invite、invite-invalid |
| `/trips` | TripsListPage | 已取證 | 21 | trips-list、trips-list-empty、trips-list-error |
| `/trips/new` | NewTripPage | 已取證 | 2 | trips-new |
| `/trip/:tripId` | TripLayout | 已取證 | 26 | trip-detail |
| `map` | MapPage | 已取證（場景限制：地圖被擋，畫面是「地圖暫停服務」，不是真實地圖） | 19 | trip-map |
| `stop/:entryId` | StopDetailRedirect | 已排除（轉址到 `/trips?selected=…&focus=…`，不是畫面） | 9 | — |
| `stop/:entryId/map` | MapPage | 未取證 | 0 | 無場景：單點地圖頁，且地圖畫面本身受 Google Maps 被擋的限制（見 review 發現 4） |
| `print` | TripPrintPage | 已取證 | 1 | trip-print |
| `edit` | EditTripPage | 已取證 | 9 | trip-edit |
| `stop/:entryId/copy` | EntryActionPage | 未取證 | 0 | 無場景：需 entry 讀取 mock 與複製目標選擇流程 |
| `stop/:entryId/move` | EntryActionPage | 未取證 | 0 | 無場景：需 entry 讀取 mock 與搬移目標選擇流程 |
| `stop/:entryId/change-poi` | ChangePoiPage | 未取證 | 0 | 無場景：需 POI 搜尋與 entry 讀取 mock |
| `stop/:entryId/edit` | EditEntryPage | 未取證 | 0 | 無場景：需 entry 讀取 mock |
| `add-stop` | AddStopPage | 已取證 | 5 | trip-add-stop |
| `add-entry` | AddEntryPage | 已取證 | 2 | trip-add-entry |
| `collab` | CollabPage | 已取證 | 9 | trip-collab |
| `health` | TripHealthCheckPage | 已取證 | 3 | trip-health |
| `notes` | TripNotesPage | 已取證 | 4 | trip-notes |
| `add-custom-stop` | (巢狀 element) | 未取證 | 3 | 無場景：巢狀 element，需補場景 |
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
| ErrorBanner | 錯誤橫幅 | 已取證 | `popup-error-banner`（另有 `login-error`、`trips-list-error` 也渲染同一元件） |
| ServerStatusBanner | 伺服器狀態橫幅 | 已取證 | `popup-server-status-banner` |
| Toast | 提示訊息 | 已取證 | `popup-toast-error`、`popup-toast-offline`（只有 error 與 offline 兩種；success、info、online 未造） |

## 已知缺口
- `/account/password`（變更密碼，trip-planner#1557）已在路由表登記為「待取證」。
- 彈出層清單由元件檔名比對得出，沒有對應的比對測試；造場景時另確認沒有漏：除上表 16 列外，`src/` 內仍有 `TripCardMenu`、`TripActionsMenu`、`RailRowMenu` 的錨定選單與 `TripDatePicker`／`TripTimePicker`／`TripSelect` 的下拉面板，屬 popover／menu 而不是 Sheet／Modal，清單沒有收、也沒有場景。
- 路由未取證 10 條（見上表「未取證」列）：`/add-to-trip`、`/s/:token`、`/oauth/consent`、`/oauth/authorize`、`stop/:entryId/{map,copy,move,change-poi,edit}`、`add-custom-stop`；`/favorites/:id/add-to-trip` 只當彈出層背景出現。
- 彈出層缺口 3 個：`TripPickerPopover`、`CollabSheet`、`InfoSheet`，都是沒有入口的元件（死碼，已另開 PR #1584 移除；本 PR 不動產品）。
