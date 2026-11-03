# web 頁面完整清單與 mock 場景對照（HIG 取證用）

來源：flutter#531、trip-planner#1564。日期：2026-11-04，依 `src/entries/main.tsx` 的路由表產生。

## 狀態說明
- **已取證**：已有截圖與逐項比對（目前全為 0，取證在 #1565～#1567）。
- **已排除**：不是畫面（純轉址）或不在 HIG 比對範圍，附理由。
- **mock 場景**：能用 Playwright 加 API mock 開出該畫面的場景。`既有 e2e` 欄列出已有 e2e 規格提到該路徑的檔案數，只是起點，不等於已有可截圖場景；場景由 #1563 建立。
- 守門：`tests/unit/hig-page-inventory.test.ts` 比對路由表，新增路由未登記會變紅。

## 路由

| 路由 | 元件 | 狀態 | 既有 e2e（檔案數） | mock 場景 |
|---|---|---|---|---|
| `/account` | AccountPage | 待取證 | 12 | 待 #1563 |
| `/account/appearance` | AppearanceSettingsPage | 待取證 | 3 | 待 #1563 |
| `/account/notifications` | NotificationsSettingsPage | 待取證 | 3 | 待 #1563 |
| `/account/sessions` | SessionsPage | 待取證 | 5 | 待 #1563 |
| `/account/connected-apps` | ConnectedAppsPage | 待取證 | 3 | 待 #1563 |
| `/settings/appearance` | AppearanceSettingsPage | 待取證 | 0 | 待 #1563 |
| `/settings/notifications` | NotificationsSettingsPage | 待取證 | 0 | 待 #1563 |
| `/settings/sessions` | SessionsPage | 待取證 | 4 | 待 #1563 |
| `/settings/connected-apps` | ConnectedAppsPage | 待取證 | 1 | 待 #1563 |
| `/` | LandingPage | 待取證 | 0 | 待 #1563 |
| `/admin` | Navigate | 已排除（純轉址，不是畫面） | 0 | — |
| `/admin/` | Navigate | 已排除（純轉址，不是畫面） | 0 | — |
| `/manage` | Navigate | 已排除（純轉址，不是畫面） | 0 | — |
| `/manage/` | Navigate | 已排除（純轉址，不是畫面） | 0 | — |
| `/chat` | ChatPage | 待取證 | 6 | 待 #1563 |
| `/map` | GlobalMapPage | 待取證 | 9 | 待 #1563 |
| `/explore` | ExplorePage | 待取證 | 4 | 待 #1563 |
| `/favorites` | PoiFavoritesPage | 待取證 | 8 | 待 #1563 |
| `/favorites/:id/add-to-trip` | AddPoiFavoriteToTripPage | 待取證 | 0 | 待 #1563 |
| `/add-to-trip` | AddPoiFavoriteToTripPage | 待取證 | 4 | 待 #1563 |
| `/privacy` | PrivacyPage | 待取證 | 3 | 待 #1563 |
| `/login` | LoginPage | 待取證 | 6 | 待 #1563 |
| `/signup` | SignupPage | 待取證 | 3 | 待 #1563 |
| `/signup/check-email` | EmailVerifyPendingPage | 待取證 | 1 | 待 #1563 |
| `/login/forgot` | ForgotPasswordPage | 待取證 | 1 | 待 #1563 |
| `/auth/password/reset` | ResetPasswordPage | 待取證 | 1 | 待 #1563 |
| `/auth/verify-email` | VerifyEmailPage | 待取證 | 1 | 待 #1563 |
| `/s/:token` | TripSharePage | 待取證 | 14 | 待 #1563 |
| `/developer/apps` | DeveloperAppsPage | 待取證 | 5 | 待 #1563 |
| `/developer/apps/new` | DeveloperAppNewPage | 待取證 | 3 | 待 #1563 |
| `/oauth/consent` | ConsentPage | 待取證 | 1 | 待 #1563 |
| `/oauth/authorize` | OauthAuthorizePage | 待取證 | 0 | 待 #1563 |
| `/invite` | InvitePage | 待取證 | 1 | 待 #1563 |
| `/trips` | TripsListPage | 待取證 | 21 | 待 #1563 |
| `/trips/new` | NewTripPage | 待取證 | 2 | 待 #1563 |
| `/trip/:tripId` | TripLayout | 待取證 | 26 | 待 #1563 |
| `map` | MapPage | 待取證 | 19 | 待 #1563 |
| `stop/:entryId` | StopDetailRedirect | 待取證 | 9 | 待 #1563 |
| `stop/:entryId/map` | MapPage | 待取證 | 0 | 待 #1563 |
| `print` | TripPrintPage | 待取證 | 1 | 待 #1563 |
| `edit` | EditTripPage | 待取證 | 9 | 待 #1563 |
| `stop/:entryId/copy` | EntryActionPage | 待取證 | 0 | 待 #1563 |
| `stop/:entryId/move` | EntryActionPage | 待取證 | 0 | 待 #1563 |
| `stop/:entryId/change-poi` | ChangePoiPage | 待取證 | 0 | 待 #1563 |
| `stop/:entryId/edit` | EditEntryPage | 待取證 | 0 | 待 #1563 |
| `add-stop` | AddStopPage | 待取證 | 5 | 待 #1563 |
| `add-entry` | AddEntryPage | 待取證 | 2 | 待 #1563 |
| `collab` | CollabPage | 待取證 | 9 | 待 #1563 |
| `health` | TripHealthCheckPage | 待取證 | 3 | 待 #1563 |
| `notes` | TripNotesPage | 待取證 | 4 | 待 #1563 |
| `add-custom-stop` | (巢狀 element) | 待取證 | 3 | 待 #1563 |
| `*` | LegacyRedirect | 已排除（純轉址，不是畫面） | 0 | — |

## 彈出層（Sheet／Modal／Dialog／Popover／Toast／Banner）

| 元件 | 說明 | 狀態 | mock 場景 |
|---|---|---|---|
| AccountSheet | 帳號頁以 sheet 開在背景頁之上 | 待取證 | 待 #1563 |
| AiConsentSheet | AI 使用同意 | 待取證 | 待 #1563 |
| AiDataConsentSheet | AI 資料同意 | 待取證 | 待 #1563 |
| TripPickerPopover | 探索頁選行程 | 待取證 | 待 #1563 |
| ShareLinkModal | 分享連結 | 待取證 | 待 #1563 |
| ConfirmModal | 確認對話框 | 待取證 | 待 #1563 |
| ConflictModal | 衝突對話框 | 待取證 | 待 #1563 |
| InputModal | 輸入對話框 | 待取證 | 待 #1563 |
| NoteAiExclusionsDialog | 筆記 AI 排除 | 待取證 | 待 #1563 |
| CollabSheet | 共編設定 | 待取證 | 待 #1563 |
| InfoSheet | 資訊 | 待取證 | 待 #1563 |
| TravelPillDialog | 交通方式 | 待取證 | 待 #1563 |
| TripSheet / TripSheetTabs | 行程 sheet | 待取證 | 待 #1563 |
| ErrorBanner | 錯誤橫幅 | 待取證 | 待 #1563 |
| ServerStatusBanner | 伺服器狀態橫幅 | 待取證 | 待 #1563 |
| Toast | 提示訊息 | 待取證 | 待 #1563 |

## 已知缺口
- `/account/password`（變更密碼）在 trip-planner#1557，合併後路由表會多一條，守門測試會提醒補登記。
- 彈出層清單由元件檔名比對得出，沒有對應的比對測試；#1563 建立場景時要順手確認有沒有漏。
