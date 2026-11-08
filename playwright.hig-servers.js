// HIG 取證場景需要的兩台 preview server，playwright.hig.config.js（CI／棘輪）與
// playwright.hig-webkit.config.js（跨引擎截圖）共用，避免建置指令字串各寫一份而漂移。
// 預設的 playwright.config.js 不啟動它們（以 testIgnore 排除 HIG specs），所以一般 e2e 不必多建一份。

// 主站（埠 3000）：多數場景用 page.route 回罐頭資料、驗畫面不驗認證，所以建置時把 auth 換成穿透版
// （E2E_AUTH_PASSTHROUGH=1，見 vite.config.ts 的 authPassthrough；請求仍是同源 /api/...，罐頭照常攔截）。
// 一律另建 dist-e2e：CI 的 Build 步驟建的是正式設定（API 網址指向 production），不能拿來跑 e2e。
const MAIN_CMD = 'E2E_AUTH_PASSTHROUGH=1 npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 3000';

// 真 auth 的建置（埠 3001）：變更密碼、/oauth/authorize、/auth/callback 要真的 auth client（憑證由場景種進 IndexedDB、
// token 端點由場景攔截；「沒有憑證 → 顯示登入表單」這類場景也要真的還原邏輯），所以不套穿透版。
// API 網址指向自己，由場景的 page.route 攔截。
const NEWAPI_CMD =
  'VITE_API_BASE_URL=http://localhost:3001 npx vite build --outDir dist-newapi && npx vite preview --outDir dist-newapi --port 3001';

const HIG_WEB_SERVERS = [
  { command: MAIN_CMD, port: 3000, reuseExistingServer: true, timeout: 120000 },
  { command: NEWAPI_CMD, port: 3001, reuseExistingServer: true, timeout: 120000 },
];

// 預設 config 以此排除 HIG specs；HIG config 以此納入。
const HIG_SPECS = /hig-(scenes|a11y-collect)\.spec\.js$/;

module.exports = { HIG_WEB_SERVERS, HIG_SPECS };
