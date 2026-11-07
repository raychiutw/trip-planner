// HIG 取證場景需要的兩台 preview server，playwright.hig.config.js（CI／棘輪）與
// playwright.hig-webkit.config.js（跨引擎截圖）共用，避免建置指令字串各寫一份而漂移。
// 預設的 playwright.config.js 不啟動它們（以 testIgnore 排除 HIG specs），所以一般 e2e 不必多建一份。

// CI 的前一步（Build）已經建好 dist，直接 preview；本機沒有 dist，要先建。
const MAIN_CMD = process.env.CI ? 'npx vite preview --port 3000' : 'npm run build && npx vite preview --port 3000';

// 新 api 認證旗標開啟的建置（變更密碼、/oauth/authorize、/auth/callback 要旗標才會渲染）。
// 旗標是建置期常數，無法在同一份建置裡切換，所以另建一份、另開埠；API 網址指向自己，由場景的 page.route 攔截。
const NEWAPI_CMD =
  'VITE_NEW_API_AUTH=1 VITE_API_BASE_URL=http://localhost:3001 npx vite build --outDir dist-newapi && npx vite preview --outDir dist-newapi --port 3001';

const HIG_WEB_SERVERS = [
  { command: MAIN_CMD, port: 3000, reuseExistingServer: true, timeout: 120000 },
  { command: NEWAPI_CMD, port: 3001, reuseExistingServer: true, timeout: 120000 },
];

// 預設 config 以此排除 HIG specs；HIG config 以此納入。
const HIG_SPECS = /hig-(scenes|a11y-collect)\.spec\.js$/;

module.exports = { HIG_WEB_SERVERS, HIG_SPECS };
